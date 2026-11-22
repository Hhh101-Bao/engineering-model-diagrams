#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {validateIR,resolveShapes} from './model-ir.mjs';
import {renderTypst} from './typst_backend.mjs';
import {exportScene3D} from './export-scene3d.mjs';
import {themeFor} from './styles.mjs';
import {glyphGeometry,partPort} from './visual-language.mjs';
const require=createRequire(import.meta.url),ELK=require('./vendor/elk.bundled.cjs');
const nativeType={input:'custom',output:'custom',conv:'conv',convblock:'conv',pool:'pool',gap:'gap',linear:'fc',concat:'concat',add:'sum',multiply:'sum'};
const round=x=>+x.toFixed(4),safe=s=>String(s).replace(/[\r\n|]/g,' ');
const units=s=>[...String(s)].reduce((n,c)=>n+(/[\u2e80-\uffff]/.test(c)?1:/[MW@]/.test(c)?.8:.55),0);
function lines(text,budget=11){const out=[];let line='';for(const token of String(text).match(/[A-Za-z0-9_]+(?:[-/][A-Za-z0-9_]+)*|\s+|./gu)??[]){if(line.trim()&&units(line+token)>budget){out.push(line.trim());line='';}if(!line&&/^\s+$/.test(token))continue;line+=token;}if(line.trim())out.push(line.trim());return out;}
function surfacePort(b,frac,isSource,direction){
  if(b.parts){const port=direction==='RIGHT'?(isSource?'east':'west'):(isSource?'south':'north'),spread=(direction==='RIGHT'?b.h:b.w)*.45*(frac-.5),hit=partPort(b.parts,b,port,spread,b.projection);return [b.bodyX+hit.point[0],b.bodyY+b.projH-hit.point[1],hit.z];}
  if(direction==='RIGHT'){const spread=Math.max(.15,b.h-b.ox)*.65*(frac-.5),radius=b.sphere?Math.sqrt(Math.max(0,.45**2-spread**2)):0;
    return [b.bodyX+(b.sphere?.45+(isSource?radius:-radius):isSource?b.projW:0),b.bodyY+b.projH/2+spread];}
  const partWidth=isSource?b.widths.at(-1):b.widths[0],center=b.sliceGap?(isSource?b.w-partWidth/2:partWidth/2):b.w/2;
  const dx=(b.sphere?b.w:partWidth)*.65*(frac-.5),radius=b.sphere?Math.sqrt(Math.max(0,.45**2-dx**2)):0;
  return [b.bodyX+center+dx+(isSource?0:b.ox),b.bodyY+(b.sphere?.45+(isSource?radius:-radius):isSource?b.projH:0)];
}
function geometry(n,projectionDepth=.22){
  const shape=n.shape??[null,null,null],symbolic=shape.some(x=>typeof x==='string'||x===null),repeat=n.repeat??1;
  const label=[...lines(n.label),(n.repeat??1)>1?`×${n.repeat}`:null,shape.map(x=>x??'?').join('×')+(n.shapeStatus==='unknown'?' ?':'')].filter(Boolean);
  const semantic=glyphGeometry(n,'#A7B8C3',{projection:projectionDepth});
  return {...semantic,repeat,label,symbolic,projection:projectionDepth};
}
export async function planVolumes(ir,{spacing=1.6}={}){
  const validation=validateIR(ir);if(!validation.pass)throw Error(validation.errors.join('\n'));
  const resolved=resolveShapes(ir);if(resolved.errors.length)throw Error(resolved.errors.join('\n'));
  ir=resolved.ir;
  const theme=themeFor(ir.render?.theme),colors=theme.colors;
  const width=ir.render?.widthMm??220,minFont=ir.render?.minFontPt??8,depth=ir.render?.depthMultiplier??.42;
  const direction=ir.render?.direction??'RIGHT';if(!['RIGHT','DOWN'].includes(direction))throw Error('direction must be RIGHT or DOWN');
  if(!(depth>0))throw Error('A nonzero projection depth is required; no 2D fallback');
  const colorFor=n=>colors[n.visual?.colorRole]??colors[n.op]??colors.custom;
  const g=new Map(ir.nodes.map(n=>{const b=geometry(n,depth);if(b.parts)b.parts=glyphGeometry(n,colorFor(n),{projection:depth}).parts;return [n.id,b];}));
  let scale=.75,laid,children;
  let converged=false;
  for(let pass=0;pass<24;pass++){
    const labelPt=minFont*8.5/7,cmPerUnit=labelPt*25.4/72/10/scale;
    children=ir.nodes.map(n=>{
      const b=g.get(n.id),ox=b.sphere?0:b.d*depth,projH=b.h+ox,projW=b.w+ox;
      const labelW=Math.max(...b.label.map(units))*cmPerUnit+1.0,labelH=b.label.length*cmPerUnit*1.6;
      const vertical=direction==='DOWN',w=vertical?projW+.6/scale+labelW:Math.max(projW+.3,labelW),h=vertical?Math.max(projH+.4,labelH+.4):projH+.65/scale+labelH+.2;
      b.bodyX=vertical?.1:(w-projW)/2;b.bodyY=vertical?(h-projH)/2:.1;b.ox=ox;b.projH=projH;b.projW=projW;b.labelH=labelH;b.labelGap=.4/scale;b.boxW=w;b.boxH=h;
      b.labelCenterX=vertical?projW+.6/scale+labelW/2:w/2;b.labelCenterY=vertical?h/2:b.bodyY+projH+b.labelGap+labelH/2;
      return {id:n.id,width:w*100,height:h*100,layoutOptions:{'elk.portConstraints':'FIXED_POS'},ports:[]};
    });
    const byId=new Map(children.map(n=>[n.id,n]));
    const portFor=(nodeId,eid,isSource)=>{
      const peers=ir.edges.filter(e=>(isSource?e.from:e.to)===nodeId),i=peers.findIndex(e=>e.id===eid),frac=(i+1)/(peers.length+1);
      const b=g.get(nodeId),[x,y]=surfacePort(b,frac,isSource,direction),side=direction==='RIGHT'?(isSource?'EAST':'WEST'):(isSource?'SOUTH':'NORTH');
      const port={id:`p_${eid}_${isSource?'a':'b'}`,x:x*100,y:y*100,width:0,height:0,layoutOptions:{'elk.port.side':side}};
      byId.get(nodeId).ports.push(port);return port.id;
    };
    const edges=ir.edges.map(e=>({id:e.id,sources:[portFor(e.from,e.id,true)],targets:[portFor(e.to,e.id,false)]}));
    const elk=new ELK();
    laid=await elk.layout({id:'model',layoutOptions:{'elk.algorithm':'layered','elk.direction':direction,'elk.edgeRouting':'ORTHOGONAL','elk.spacing.nodeNode':String((spacing+.5)*100),'elk.layered.spacing.nodeNodeBetweenLayers':String(spacing*100),'elk.spacing.edgeNode':'30','elk.layered.spacing.edgeNodeBetweenLayers':'40','elk.padding':'[top=0,left=0,bottom=0,right=0]','elk.randomSeed':'42','elk.layered.considerModelOrder.strategy':'NODES_AND_EDGES'},children,edges});
    const nextScale=(width-8)/10/(laid.width/100);
    if(Math.abs(nextScale/scale-1)<.005){converged=true;break;}
    if(nextScale<.08)throw Error('Labels do not fit the requested physical width with visible volumes. Shorten captions, switch direction, increase width, or split overview/detail; no 2D fallback.');
    scale=nextScale;
  }
  if(!converged)throw Error('Physical label/layout sizing did not converge. Shorten captions, switch direction, increase width, or split overview/detail; no 2D fallback.');
  const layers=laid.children.map(c=>{
    const n=ir.nodes.find(n=>n.id===c.id),b=g.get(n.id),x=c.x/100+b.bodyX,y=-(c.y/100+b.bodyY+b.projH/2);
    const labelAt=[round((c.x/100)+b.labelCenterX),round(-(c.y/100+b.labelCenterY))];
    return {name:n.id,type:nativeType[n.op]??'custom',semanticOp:n.op,meaning:n.meaning??n.op,widths:b.widths,height:b.h,depth:b.d,glyph:b.kind,...(b.parts?{parts:b.parts,marks:b.marks??[]}:{}),opacity:1,
      ...(b.sliceGap?{sliceGap:b.sliceGap}:{}),
      ...(n.op==='concat'?{axis:n.params?.axis??0}:{}),
      ...(b.sphere?{radius:.45,symbol:n.op==='multiply'?'×':'+',broadcast:!!n.params?.broadcast}:{}),
      channels:Array(b.widths.length+1).fill(''),tensor:n.shape.map(v=>typeof v==='number'?v:null),
      label:b.label,labelAt,at:[round(x),round(y)],fill:colorFor(n),...(n.visual?.colorRole?{colorRole:n.visual.colorRole}:{}),...(theme.bands[n.op]?{bandfill:theme.bands[n.op]}:{}),'show-connection':false,
      evidence:n.evidence,sourceShape:n.shape};
  });
  const connections=laid.edges.map(e=>{
    const original=ir.edges.find(k=>k.id===e.id),s=e.sections?.[0];if(!s)throw Error(`Cannot route ${e.id}`);
    const convert=p=>[round(p.x/100),round(-p.y/100)];
    // ELK clamps ports to the label-inclusive node boundary. Recompute body ports
    // from immutable geometry rather than reusing the modified input ports.
    const absolute=(id,isSource)=>{const c=laid.children.find(n=>n.id===id),b=g.get(id),peers=ir.edges.filter(k=>(isSource?k.from:k.to)===id),i=peers.findIndex(k=>k.id===e.id),frac=(i+1)/(peers.length+1),[x,y,z]=surfacePort(b,frac,isSource,direction);return {x:c.x+100*x,y:c.y+100*y,z};};
    const a=absolute(original.from,true),b=absolute(original.to,false);
    const first=direction==='RIGHT'?{x:s.startPoint.x,y:a.y}:{x:a.x,y:s.startPoint.y};
    const last=direction==='RIGHT'?{x:s.endPoint.x,y:b.y}:{x:b.x,y:s.endPoint.y};
    let points=[a,first,s.startPoint,...(s.bendPoints??[]),s.endPoint,last,b].map(convert).filter((p,i,arr)=>!i||p[0]!==arr[i-1][0]||p[1]!==arr[i-1][1]);
    for(let i=1;i<points.length-1;){const [a,b,c]=points.slice(i-1,i+2);if((a[0]===b[0]&&b[0]===c[0])||(a[1]===b[1]&&b[1]===c[1]))points.splice(i,1);else i++;}
    return {id:e.id,from:original.from,to:original.to,type:'direct',fromPort:direction==='DOWN'?'south':'east',toPort:direction==='DOWN'?'north':'west',fromPoint:points[0],toPoint:points.at(-1),...(a.z!==undefined?{fromDepth:a.z}:{}),...(b.z!==undefined?{toDepth:b.z}:{}),via:points.slice(1,-1),evidence:original.evidence};
  });
  const spec={backend:'neural-netz',title:ir.title,widthMm:width,...(ir.render?.maxHeightMm?{maxHeightMm:ir.render.maxHeightMm}:{}),minFontPt:minFont,depthMultiplier:depth,strokeThickness:.7,palette:'cold',fonts:theme.fonts,showRelu:false,showLegend:false,layers,connections};
  if(spec.layers.some(l=>!(l.depth>0)||!(l.height>0)||l.widths.some(w=>!(w>0))))throw Error('Volume geometry invariant failed');
  const nodeRects=laid.children.map(c=>({id:c.id,x:c.x/100,y:c.y/100,w:c.width/100,h:c.height/100}));
  const geometryErrors=[];
  for(const e of connections){
    const pts=[e.fromPoint,...e.via,e.toPoint];
    for(let i=1;i<pts.length;i++){
      const a=pts[i-1],b=pts[i];
      if(Math.abs(a[0]-b[0])>.01&&Math.abs(a[1]-b[1])>.01)geometryErrors.push(`Nonorthogonal route: ${e.id}`);
      for(const c of laid.children.filter(c=>![e.from,e.to].includes(c.id))){const body=g.get(c.id),x=c.x/100+body.bodyX,y=c.y/100+body.bodyY,w=body.projW,h=body.projH;const ay=-a[1],by=-b[1];if(Math.abs(a[0]-b[0])<.01?a[0]>x+.01&&a[0]<x+w-.01&&Math.max(ay,by)>y+.01&&Math.min(ay,by)<y+h-.01:ay>y+.01&&ay<y+h-.01&&Math.max(a[0],b[0])>x+.01&&Math.min(a[0],b[0])<x+w-.01)geometryErrors.push(`Route crosses volume: ${e.id}/${c.id}`);}
    }
  }
  if(geometryErrors.length)throw Error([...new Set(geometryErrors)].join('\n'));
  return {ir,spec,layout:{nodes:nodeRects,edges:connections},warnings:[...validation.warnings,...resolved.warnings],geometries:Object.fromEntries(g),autoLayout:true};
}

function evidenceReport(ir){
  const lines=[`# ${ir.title??'Model'} · 结构与出处`,'','此文件由模型中间表示生成；出处指针需要结合原文/原图核对，自动引用检查不能证明理解正确。','', '| 模块 | 算子 | 维度 | 状态 | 依据 |','|---|---|---|---|---|'];
  for(const n of ir.nodes)lines.push(`| ${safe(n.label)} | ${safe(n.op)} | ${safe(n.shape?.map(v=>v??'?').join('×')??'?')} | ${n.shapeStatus??'unknown'} | ${n.evidence.map(safe).join(', ')} |`);
  lines.push('','## 来源证据','');for(const e of ir.evidence){const source=ir.sources.find(s=>s.id===e.source);lines.push(`- **${safe(e.id)}** · ${e.status??'stated'} · ${safe(e.locator)}：${safe(e.statement)}${e.reason?'；推导：'+safe(e.reason):''}（${source.uri??source.path}）`);}
  lines.push('','## 待确认','');for(const q of ir.uncertainties??[])lines.push('- '+safe(q));if(!(ir.uncertainties?.length))lines.push('输入未列出额外待确认项；仍需实际语义与视觉复核。');return lines.join('\n')+'\n';
}
export async function compileModel(input,options={}){
  const raw=typeof input==='string'?JSON.parse(fs.readFileSync(input,'utf8')):input;
  if(options.theme)raw.render={...raw.render,theme:options.theme};
  const first=validateIR(raw,{checkFiles:!!options.checkSources});if(!first.pass)throw Error(first.errors.join('\n'));
  const planned=await planVolumes(raw,options),out=path.resolve(options.out??'paper-model');fs.mkdirSync(path.dirname(out),{recursive:true});
  fs.writeFileSync(out+'.ir.json',JSON.stringify(planned.ir,null,2)+'\n');
  fs.writeFileSync(out+'.volume.json',JSON.stringify(planned.spec,null,2)+'\n');
  fs.writeFileSync(out+'.layout.json',JSON.stringify(planned.layout,null,2)+'\n');
  fs.writeFileSync(out+'.evidence.md',evidenceReport(planned.ir));
  exportScene3D(planned,out);
  const compiled=await renderTypst(planned.spec,{out,previewSize:options.previewSize??2400,typst:options.typst});
  const report={schema:'paper-model-run/1',status:'compiled-awaiting-visual-review',backend:'neural-netz',flatFallback:false,autoLayout:true,
    nodes:planned.ir.nodes.length,edges:planned.ir.edges.length,sourceIds:planned.ir.sources.map(s=>s.id),warnings:planned.warnings,
    geometry:{allTensorDepthsPositive:planned.spec.layers.every(l=>l.depth>0),projectionDepth:planned.spec.depthMultiplier,genuine3DMesh:out+'.glb'},compiled,
    requiredReview:'Inspect PNG and source evidence; write a review JSON with semantic and visual conclusions. Compilation alone is not a quality pass.'};
  fs.writeFileSync(out+'.workflow.json',JSON.stringify(report,null,2)+'\n');return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),input=args.shift(),options={};
  for(let i=0;i<args.length;i++){if(args[i]==='--out')options.out=args[++i];else if(args[i]==='--typst')options.typst=args[++i];else if(args[i]==='--theme')options.theme=args[++i];else if(args[i]==='--spacing')options.spacing=Number(args[++i]);else if(args[i]==='--check-sources')options.checkSources=true;else throw Error(`Unknown option: ${args[i]}`);}
  try{if(!input)throw Error('Usage: node compile-model.mjs MODEL.ir.json --out PREFIX [--check-sources]');console.log(JSON.stringify(await compileModel(input,options),null,2));}catch(e){console.error(e.message);process.exitCode=1;}
}
