#!/usr/bin/env node
/** Render curated source-backed macro schematics using the real volume engine. */
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {definitions} from '../assets/catalog/definitions.mjs';
import {themeFor} from './styles.mjs';import {renderTypst} from './typst_backend.mjs';import {exportScene3D} from './export-scene3d.mjs';
import {compileModel} from './compile-model.mjs';
import {glyphGeometry,partPort} from './visual-language.mjs';
import {profileCatalog} from './catalog-profiles.mjs';
const round=x=>+x.toFixed(5),ops={conv:'conv',pool:'pool',gap:'gap',linear:'fc',add:'sum',multiply:'sum',concat:'concat'};
const units=s=>[...s].reduce((n,c)=>n+(/[\u2e80-\uffff]/.test(c)?1:.55),0);
function volume(n,t,rowSpacing=6.8){
  const chw=n.shape?.length===3,H=n.shape?.[1],W=n.shape?.[2],C=n.shape?.[0],size=v=>typeof v==='number'?Math.min(3.6,Math.max(1.25,1.35+.29*Math.log2(Math.max(1,v)))):2.75;
  let h=chw?size(H):2.6,d=chw?size(W):1.6,w=['input','output'].includes(n.op)?.22:Math.min(1.5,.55+(typeof C==='number'?.08*Math.log2(Math.max(C,2)):.45));
  if(['add','multiply'].includes(n.op))h=d=w=.9;
  if(n.size)[w,h,d]=n.size;
  const color=t.colors[n.visual?.colorRole]??t.colors[n.op]??t.colors.custom;
  const geometry=glyphGeometry(n,color,{projection:.42});({w,h,d}=geometry);
  const x=n.col*5.4,y=-n.row*rowSpacing,ox=geometry.sphere?0:d*.42;
  const label=[...n.label,...(n.shape?[n.shape.map(x=>x??'?').join(' × ')]:[])];
  return {...n,...geometry,w,h,d,x,y,ox,label,rect:{x1:x,x2:x+w+ox,y1:y-(h+ox)/2,y2:y+(h+ox)/2},color};
}
function route(a,b,obstacles,used=[],fromNormal=[1,0],toNormal=[-1,0]){
  const clear=.45,escape=.55,start=a.map((v,i)=>v+fromNormal[i]*escape),end=b.map((v,i)=>v+toNormal[i]*escape);
  const xs=[...new Set([start[0],end[0],...obstacles.flatMap(r=>[r.x1-clear,r.x2+clear]),...used.filter(([p,q])=>p[0]===q[0]).flatMap(([p])=>[p[0]-.32,p[0]+.32])].map(round))].sort((a,b)=>a-b),ys=[...new Set([start[1],end[1],...obstacles.flatMap(r=>[r.y1-clear,r.y2+clear]),...used.filter(([p,q])=>p[1]===q[1]).flatMap(([p])=>[p[1]-.32,p[1]+.32])].map(round))].sort((a,b)=>a-b);
  const inside=(x,y)=>obstacles.some(r=>x>r.x1+.005&&x<r.x2-.005&&y>r.y1+.005&&y<r.y2-.005);
  const crosses=(p,q)=>obstacles.some(r=>p[0]===q[0]?p[0]>r.x1+.005&&p[0]<r.x2-.005&&Math.max(p[1],q[1])>r.y1+.005&&Math.min(p[1],q[1])<r.y2-.005:p[1]>r.y1+.005&&p[1]<r.y2-.005&&Math.max(p[0],q[0])>r.x1+.005&&Math.min(p[0],q[0])<r.x2-.005);
  const congestion=(p,q)=>used.reduce((cost,[u,v])=>{if(p[0]===q[0]&&u[0]===v[0]&&p[0]===u[0])return cost+40*Math.max(0,Math.min(Math.max(p[1],q[1]),Math.max(u[1],v[1]))-Math.max(Math.min(p[1],q[1]),Math.min(u[1],v[1])));if(p[1]===q[1]&&u[1]===v[1]&&p[1]===u[1])return cost+40*Math.max(0,Math.min(Math.max(p[0],q[0]),Math.max(u[0],v[0]))-Math.max(Math.min(p[0],q[0]),Math.min(u[0],v[0])));return cost;},0);
  const xi=x=>xs.indexOf(round(x)),yi=y=>ys.indexOf(round(y)),begin=[xi(start[0]),yi(start[1]),0],goal=[xi(end[0]),yi(end[1])],key=(x,y,d)=>`${x},${y},${d}`;
  const queue=[{state:begin,cost:0,score:0}],costs=new Map([[key(...begin),0]]),parents=new Map();let finish;
  while(queue.length){queue.sort((a,b)=>b.score-a.score);const current=queue.pop(),[x,y,dir]=current.state,k=key(x,y,dir);if(current.cost!==costs.get(k))continue;if(x===goal[0]&&y===goal[1]){finish=k;break;}
    for(const [dx,dy,nd] of [[1,0,1],[-1,0,1],[0,1,2],[0,-1,2]]){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=xs.length||yy>=ys.length||inside(xs[xx],ys[yy]))continue;const p=[xs[x],ys[y]],q=[xs[xx],ys[yy]];if(crosses(p,q))continue;
      const v=current.cost+Math.abs(p[0]-q[0])+Math.abs(p[1]-q[1])+congestion(p,q)+(dir&&dir!==nd?.7:0),kk=key(xx,yy,nd);if(v>=(costs.get(kk)??Infinity))continue;costs.set(kk,v);parents.set(kk,k);queue.push({state:[xx,yy,nd],cost:v,score:v+Math.abs(xs[xx]-end[0])+Math.abs(ys[yy]-end[1])});}
  }
  if(!finish)throw Error('No collision-free route between catalog ports');
  const points=[];while(finish){const [x,y]=finish.split(',').map(Number);points.push([xs[x],ys[y]]);finish=parents.get(finish);}points.reverse();points.unshift(a);points.push(b);
  for(let i=1;i<points.length-1;){const[p,q,r]=points.slice(i-1,i+2);if((p[0]===q[0]&&q[0]===r[0])||(p[1]===q[1]&&q[1]===r[1]))points.splice(i,1);else i++;}return points;
}
export function catalogPlan(model,{theme='steel-teal',widthMm}={}){
  model=profileCatalog(model);
  const t=themeFor(theme),vs=model.nodes.map(n=>volume(n,t,model.rowSpacing)),byId=new Map(vs.map(v=>[v.id,v])),maxcol=Math.max(...vs.map(v=>v.col));
  const width=widthMm??model.figureWidth??Math.max(180,Math.min(280,50+maxcol*28));
  // Reserve captions in physical font units, then translate them into diagram units.
  const estimatedScale=(width-8)/10/(maxcol*5.4+6),unitCm=8.5*8.5/7*25.4/72/10/estimatedScale;
  const obstacles=vs.flatMap(v=>v.parts?v.parts.map(p=>({x1:v.x+p.x+p.z*.42,x2:v.x+p.x+p.w+(p.z+p.d)*.42,y1:v.rect.y1+p.y+p.z*.42,y2:v.rect.y1+p.y+p.h+(p.z+p.d)*.42})):[v.rect]);const labelPositions=new Map();
  for(const v of vs){const downward=model.edges.some(([a,b])=>a===v.id&&byId.get(b).col===v.col&&byId.get(b).row>v.row),textWidth=Math.max(...v.label.map(units))*unitCm+1.2,textHeight=v.label.length*unitCm*1.55,labelY=downward?v.rect.y2+.75+textHeight/2:v.rect.y1-.75-textHeight/2,labelX=v.x+(v.w+v.ox)/2;labelPositions.set(v.id,[labelX,labelY]);obstacles.push({x1:labelX-textWidth/2,x2:labelX+textWidth/2,y1:labelY-textHeight/2,y2:labelY+textHeight/2});}
  for(let i=0;i<vs.length;i++)for(let j=i+1;j<vs.length;j++){const a=vs[i].rect,b=vs[j].rect;if(Math.min(a.x2,b.x2)-Math.max(a.x1,b.x1)>0&&Math.min(a.y2,b.y2)-Math.max(a.y1,b.y1)>0)throw Error('Overlapping catalog volumes: '+vs[i].id+'/'+vs[j].id);}
  const used=[];
  const connections=model.edges.map(([from,to],i)=>{
    const a=byId.get(from),b=byId.get(to),outs=model.edges.filter(e=>e[0]===from),ins=model.edges.filter(e=>e[1]===to),oi=outs.findIndex(e=>e[1]===to),ii=ins.findIndex(e=>e[0]===from);
    const vertical=a.col===b.col,forward=vertical?b.row>a.row:b.col>a.col,fromPort=vertical?(forward?'south':'north'):(forward?'east':'west');
    let toPort=vertical?(forward?'north':'south'):(forward?'west':'east');
    // A caption above a middle node blocks its north entry; enter the side instead.
    if(toPort==='north'&&labelPositions.get(b.id)[1]>b.rect.y2)toPort='west';
    if(toPort==='south'&&labelPositions.get(b.id)[1]<b.rect.y1)toPort='east';
    const normal={east:[1,0],west:[-1,0],north:[0,1],south:[0,-1]};
    const port=(v,p,index,count)=>{const spread=(index-(count-1)/2)*Math.min(.3,Math.min(v.w,v.h)*.4/Math.max(1,count-1)),sphere=['add','multiply'].includes(v.op);if(v.parts){const hit=partPort(v.parts,v,p,spread,.42);return [v.x+hit.point[0],v.rect.y1+hit.point[1],hit.z];}if(sphere){const r=Math.sqrt(.45**2-spread**2);return p==='east'?[v.x+.45+r,v.y+spread]:p==='west'?[v.x+.45-r,v.y+spread]:p==='north'?[v.x+.45+spread,v.y+r]:[v.x+.45+spread,v.y-r];}return p==='east'?[v.rect.x2,v.y+spread]:p==='west'?[v.x,v.y+spread]:p==='north'?[v.x+v.w/2+v.ox+spread,v.rect.y2]:[v.x+v.w/2+spread,v.rect.y1];};
    const source=port(a,fromPort,oi,outs.length),target=port(b,toPort,ii,ins.length);
    let points;
    try{points=route(source.slice(0,2).map(round),target.slice(0,2).map(round),obstacles,used,normal[fromPort],normal[toPort]);}
    catch(error){throw Error(`${model.id}: ${from} → ${to}: ${error.message}`);}
    for(let k=1;k<points.length;k++)used.push([points[k-1],points[k]]);
    return {id:'e'+i,from,to,type:'direct',fromPort,toPort,fromPoint:points[0],toPoint:points.at(-1),...(source[2]!==undefined?{fromDepth:source[2]}:{}),...(target[2]!==undefined?{toDepth:target[2]}:{}),via:points.slice(1,-1)};
  });
  const layers=vs.map(v=>({name:v.id,type:ops[v.op]??'custom',semanticOp:v.op,widths:v.widths,height:v.h,depth:v.d,glyph:v.kind,...(v.parts?{parts:v.parts,marks:v.marks??[]}:{}),...(v.sliceGap?{sliceGap:v.sliceGap}:{}),opacity:1,at:[v.x,v.y],label:v.label,labelAt:labelPositions.get(v.id),channels:['',''],tensor:(v.shape??[null,null,null]).map(x=>typeof x==='number'?x:null),sourceShape:v.shape??[null,null,null],fill:v.color,'show-connection':false,'show-relu':false,...(['add','multiply'].includes(v.op)?{radius:.45,symbol:v.op==='add'?'+':'×',broadcast:true}:{})}));
  // Macro concat blocks may include resizing/projection; keep that scope explicit.
  for(const l of layers.filter(l=>l.type==='concat'))l.type='custom';
  const source={id:'primary',uri:model.source,kind:'primary-publication-or-author-code'};
  const ir={schema:'paper-model/1',title:model.title,sources:[source],evidence:[{id:'architecture',source:'primary',locator:model.locator,statement:model.scope,status:'stated'}],nodes:model.nodes.map(n=>({id:n.id,op:n.op,meaning:n.label.join(' / '),label:n.label.join(' / '),...(n.shape?{shape:n.shape,shapeStatus:'stated'}:{}),axes:n.shape?.length===2?'tokens':'CHW',evidence:['architecture']})),edges:model.edges.map(([from,to],i)=>({id:'e'+i,from,to,evidence:['architecture']})),uncertainties:[model.scope,'Source-backed macro redraw; not an official author figure. Volumes use compressed schematic dimensions.'],render:{mode:'volume',theme,widthMm:width}};
  for(const n of ir.nodes){const source=model.nodes.find(x=>x.id===n.id);n.visual=source.visual;if(source.repeat)n.repeat=source.repeat;}
  return {ir:model.ir?{...structuredClone(model.ir),render:{...model.ir.render,theme,widthMm:width}}:ir,spec:{backend:'neural-netz',title:model.title,widthMm:width,minFontPt:8.5,depthMultiplier:.42,strokeThickness:.65,fonts:t.fonts,showRelu:false,showLegend:false,layers,connections},metadata:model};
}
export async function renderCatalog(model,options={}){
  if(model.ir&&!model.grid){const ir=structuredClone(model.ir);ir.render.theme=options.theme??'steel-teal';if(options.widthMm)ir.render.widthMm=options.widthMm;const run=await compileModel(ir,{out:options.out??model.id,spacing:2.2});const out=path.resolve(options.out??model.id);fs.writeFileSync(out+'.source.md',`# ${model.title}\n\n${model.source}\n\n${model.scope}\n\nSource-backed redraw, not an official author figure.\n`);return {id:model.id,category:model.category,...run.compiled};}
  const planned=catalogPlan(model,options),out=path.resolve(options.out??model.id);fs.mkdirSync(path.dirname(out),{recursive:true});
  fs.writeFileSync(out+'.ir.json',JSON.stringify(planned.ir,null,2)+'\n');fs.writeFileSync(out+'.volume.json',JSON.stringify(planned.spec,null,2)+'\n');
  fs.writeFileSync(out+'.source.md',`# ${model.title}\n\nPrimary source: ${model.source}\n\nLocator: ${model.locator}\n\nScope: ${model.scope}\n\nSource-backed macro redraw, not an official author figure.\n`);
  exportScene3D(planned,out);const report=await renderTypst(planned.spec,{out,previewSize:options.previewSize??2200,typst:options.typst});return {id:model.id,category:model.category,figureFamily:planned.metadata.figureFamily,glyphs:[...new Set(planned.spec.layers.map(l=>l.glyph))],...report};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const args=process.argv.slice(2),get=k=>{const i=args.indexOf(k);return i<0?undefined:args[i+1];};if(args.includes('--list')){console.log(JSON.stringify(definitions.map(({id,title,category})=>({id,title,category})),null,2));}else{const id=get('--model'),model=definitions.find(m=>m.id===id);if(!model)throw Error('Choose --model ID from --list');console.log(JSON.stringify(await renderCatalog(model,{out:get('--out'),theme:get('--theme'),widthMm:get('--width-mm')?Number(get('--width-mm')):undefined}),null,2));}}
  catch(e){console.error(e.message);process.exitCode=1;}
}
