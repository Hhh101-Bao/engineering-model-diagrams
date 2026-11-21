import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ELK=require('./vendor/elk.bundled.cjs');
export const skillRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const xml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const upstream=JSON.parse(fs.readFileSync(path.join(skillRoot,'assets/upstream/nn-components.json'),'utf8'));
const componentNames={input:'Input Tensor',output:'Output Tensor',conv:'Conv Layer',pool:'Pooling Layer',upsample:'Deconv Layer',linear:'FC Layer',feature:'Feature Map',norm:'BatchNorm',add:'Add',concat:'Concat',multiply:'Multiply'};
const originals=Object.fromEntries(Object.entries(componentNames).map(([type,title])=>{
  const s=upstream.find(n=>n.title===title)?.xml??'';
  return [type,{fill:s.match(/fillColor=(#[A-Fa-f0-9]{6})/)?.[1]??'#E8EDF4',stroke:s.match(/strokeColor=(#[A-Fa-f0-9]{6})/)?.[1]??'#516176'}];
}));
const types=['input','output','conv','convblock','pool','upsample','linear','attention','norm','activation','add','concat','multiply','feature','dropout','softmax','embedding','block','loss'];
const operators=['add','concat','multiply'];
const grayscale=color=>{const rgb=color.slice(1).match(/../g).map(h=>parseInt(h,16));const gray=Math.round(rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722).toString(16).padStart(2,'0');return '#'+gray.repeat(3);};
const roleColors={input:'neutral',output:'output',conv:'encoder',convblock:'encoder',pool:'encoder',upsample:'decoder',linear:'output',attention:'attention',norm:'neutral',activation:'neutral',add:'fusion',concat:'fusion',multiply:'fusion',feature:'neutral',dropout:'neutral',softmax:'output',embedding:'encoder',block:'encoder',loss:'attention'};
export function palette(theme,type){
  const p=JSON.parse(fs.readFileSync(path.join(skillRoot,'assets/themes.json'),'utf8'));
  if(theme==='upstream')return originals[type]??originals.conv;
  if(!p[theme])throw Error(`Unknown theme: ${theme}`);
  return p[theme][roleColors[type]];
}
export function validate(spec){
  const errors=[], warnings=[];
  if(spec.version!==1)errors.push('version must be 1');
  if(!Array.isArray(spec.nodes)||!spec.nodes.length)errors.push('nodes must be a nonempty array');
  if(!Array.isArray(spec.edges))errors.push('edges must be an array');
  if(errors.length)return {errors,warnings};
  const ids=new Set(), edgeIds=new Set(), groupIds=new Set();
  for(const g of spec.groups??[]){if(!g.id||groupIds.has(g.id))errors.push(`Invalid/duplicate group ${g.id}`);groupIds.add(g.id);}
  for(const n of spec.nodes){
    if(!/^[A-Za-z][A-Za-z0-9_-]*$/.test(n.id??'')||ids.has(n.id))errors.push(`Invalid/duplicate node id: ${n.id}`);
    ids.add(n.id);
    if(!types.includes(n.type))errors.push(`Unknown node type: ${n.type}`);
    if(typeof n.label!=='string'||!n.label.trim())errors.push(`Empty node label: ${n.id}`);
    if(n.group&&!groupIds.has(n.group))errors.push(`Unknown group ${n.group} for ${n.id}`);
    if(n.tensor&&(!Array.isArray(n.tensor)||n.tensor.some(x=>x!==null&&(!Number.isInteger(x)||x<1))))errors.push(`tensor must use positive integers or null: ${n.id}`);
    if(n.tensor?.includes(null))warnings.push(`Unknown tensor dimension: ${n.id}`);
    if(n.width!==undefined&&(!Number.isFinite(n.width)||n.width<48))errors.push(`width must be at least 48: ${n.id}`);
  }
  for(const e of spec.edges){
    if(!e.id||edgeIds.has(e.id))errors.push(`Missing/duplicate edge id: ${e.id}`);edgeIds.add(e.id);
    if(!ids.has(e.from)||!ids.has(e.to))errors.push(`Unknown endpoint: ${e.id}`);
    if(e.from===e.to)errors.push(`Self edge not supported: ${e.id}`);
    if(e.kind&&!['data','skip','auxiliary'].includes(e.kind))errors.push(`Unknown edge kind: ${e.id}`);
    for(const side of [e.fromSide,e.toSide].filter(Boolean))if(!['N','S','E','W'].includes(side))errors.push(`Invalid port side: ${e.id}`);
    if(e.via&&(!Array.isArray(e.via)||e.via.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y))))errors.push(`Invalid waypoints: ${e.id}`);
  }
  for(const n of spec.nodes.filter(n=>operators.includes(n.type))){
    const inputs=spec.edges.filter(e=>e.to===n.id).map(e=>spec.nodes.find(k=>k.id===e.from));
    if(inputs.length<2)errors.push(`${n.type} requires at least two inputs: ${n.id}`);
    const shapes=inputs.map(x=>x?.tensor);
    if(shapes.length&&shapes.every(s=>s&&s.every(Number.isInteger))){
      if(n.type==='concat'){
        const axis=n.axis??0;
        if(!Number.isInteger(axis)||axis<0||axis>=shapes[0].length)errors.push(`Invalid concat axis: ${n.id}`);
        else{
          if(shapes.some(s=>s.length!==shapes[0].length||s.some((v,i)=>i!==axis&&v!==shapes[0][i])))errors.push(`Concat non-axis dimensions differ: ${n.id}`);
          const out=[...shapes[0]];out[axis]=shapes.reduce((sum,s)=>sum+s[axis],0);
          if(n.tensor&&JSON.stringify(n.tensor)!==JSON.stringify(out))errors.push(`Concat output shape differs: ${n.id}`);
        }
      }else if(shapes.some(s=>JSON.stringify(s)!==JSON.stringify(shapes[0])))errors.push(`Elementwise input shapes differ: ${n.id}`);
      else if(n.tensor&&JSON.stringify(n.tensor)!==JSON.stringify(shapes[0]))errors.push(`Elementwise output shape differs: ${n.id}`);
    }else warnings.push(`Operator dimensions not fully checked: ${n.id}`);
  }
  if(spec.layout?.mode==='fixed')for(const n of spec.nodes)if(!Number.isFinite(n.x)||!Number.isFinite(n.y))errors.push(`Fixed layout requires x/y: ${n.id}`);
  const width=spec.widthMm??180;
  if(!Number.isFinite(width)||width<30||width>1000)errors.push('widthMm must be between 30 and 1000');
  if(!['paper','mono','upstream'].includes(spec.theme??'paper'))errors.push('Unknown theme');
  return {errors,warnings};
}
export function measure(text,size,metrics,bold=false){return [...String(text)].reduce((s,c)=>s+(metrics[bold?'bold':'normal'][c]??1),0)*size;}
function wrap(text,maxWidth,size,metrics,bold=false){
  const lines=[];
  for(const para of String(text??'').split('\n')){
    let line='';
    for(const token of para.match(/[A-Za-z0-9_./×+-]+|\s+|[^A-Za-z0-9_./×+\-\s]/gu)??['']){
      if(line&&measure(line+token,size,metrics,bold)>maxWidth){lines.push(line.trim());line='';}
      if(measure(token,size,metrics,bold)>maxWidth){
        for(const ch of token){if(line&&measure(line+ch,size,metrics,bold)>maxWidth){lines.push(line.trim());line='';}line+=ch;}
      }else line+=token;
    }
    if(line.trim()||!lines.length)lines.push(line.trim());
  }
  return lines;
}
function port(n,side,fraction=.5){
  return side==='W'?{x:n.x,y:n.y+n.h*fraction}:side==='E'?{x:n.x+n.w,y:n.y+n.h*fraction}:side==='N'?{x:n.x+n.w*fraction,y:n.y}:{x:n.x+n.w*fraction,y:n.y+n.h};
}
function direction(a,b){if(a.x===b.x)return a.y>b.y?'N':'S';return a.x>b.x?'W':'E';}
const compact=points=>points.filter((p,i)=>!i||p.x!==points[i-1].x||p.y!==points[i-1].y);
export async function layout(spec,metrics,previous){
  const nodes=spec.nodes.map(n=>{
    const op=operators.includes(n.type), w=n.width??132;
    const labelLines=wrap(n.label,w-24,18,metrics,true);
    const detailLines=wrap(n.detail??(n.tensor?n.tensor.map(x=>x??'?').join('×'):''),w-24,16,metrics);
    const h=op?Math.max(112,60+labelLines.length*22+detailLines.filter(Boolean).length*20):Math.max(76,22+labelLines.length*22+(detailLines.filter(Boolean).length?10+detailLines.length*20:0));
    return {...n,w,h,labelLines,detailLines};
  });
  const byId=Object.fromEntries(nodes.map(n=>[n.id,n]));
  let edges;
  const sourceLayout={options:spec.layout??{},positions:spec.nodes.map(n=>({id:n.id,x:n.x??null,y:n.y??null}))};
  const canReuse=previous&&previous.nodes?.length===nodes.length&&nodes.every(n=>previous.nodes.some(p=>p.id===n.id&&p.w===n.w&&p.h===n.h))&&JSON.stringify(spec.edges)===JSON.stringify(previous.sourceEdges)&&JSON.stringify(sourceLayout)===JSON.stringify(previous.sourceLayout);
  if(canReuse){
    for(const n of nodes){const p=previous.nodes.find(p=>p.id===n.id);n.x=p.x;n.y=p.y;}
    edges=previous.edges.map(e=>({...e}));
  }else if(spec.layout?.mode==='fixed'){
    const sides={};
    const routeSpecs=spec.edges.map(e=>{
      const a=byId[e.from], b=byId[e.to];
      const dx=b.x+b.w/2-a.x-a.w/2,dy=b.y+b.h/2-a.y-a.h/2;
      let fromSide=e.fromSide??(Math.abs(dx)>Math.abs(dy)?(dx>=0?'E':'W'):(dy>=0?'S':'N'));
      let toSide=e.toSide??({E:'W',W:'E',N:'S',S:'N'}[fromSide]);
      return {...e,fromSide,toSide};
    });
    for(const e of routeSpecs)for(const [id,side] of [[e.from,e.fromSide],[e.to,e.toSide]])(sides[`${id}/${side}`]??=[]).push(e.id);
    const endpoint=(id,side,eid)=>{const list=sides[`${id}/${side}`];return port(byId[id],side,(list.indexOf(eid)+1)/(list.length+1));};
    edges=routeSpecs.map(e=>{
      const a=endpoint(e.from,e.fromSide,e.id), b=endpoint(e.to,e.toSide,e.id);
      let points;
      if(e.via)points=[a,...e.via,b];
      else if(a.x===b.x||a.y===b.y)points=[a,b];
      else if(e.fromSide==='N'&&e.toSide==='N'){
        const lane=Math.min(a.y,b.y)-(e.lane??30);points=[a,{x:a.x,y:lane},{x:b.x,y:lane},b];
      }else if(['E','W'].includes(e.fromSide)&&['E','W'].includes(e.toSide)){
        const mid=(a.x+b.x)/2;points=[a,{x:mid,y:a.y},{x:mid,y:b.y},b];
      }else if(['N','S'].includes(e.fromSide)&&['N','S'].includes(e.toSide)){
        const mid=(a.y+b.y)/2;points=[a,{x:a.x,y:mid},{x:b.x,y:mid},b];
      }else points=[a,{x:b.x,y:a.y},b];
      return {...e,points:compact(points)};
    });
  }else{
    const elk=new ELK();
    const graph=await elk.layout({id:'root',layoutOptions:{'elk.algorithm':'layered','elk.direction':spec.layout?.direction??'RIGHT','elk.edgeRouting':'ORTHOGONAL','elk.spacing.nodeNode':'64','elk.layered.spacing.nodeNodeBetweenLayers':'40','elk.padding':'[top=0,left=0,bottom=0,right=0]','elk.randomSeed':'42','elk.layered.considerModelOrder.strategy':'NODES_AND_EDGES'},children:nodes.map(n=>({id:n.id,width:n.w,height:n.h})),edges:spec.edges.map(e=>({id:e.id,sources:[e.from],targets:[e.to],...(e.label?{labels:[{id:e.id+'_label',text:e.label,width:measure(e.label,16,metrics)+12,height:24}]}:{})}))});
    for(const child of graph.children){byId[child.id].x=child.x;byId[child.id].y=child.y;}
    edges=graph.edges.map(e=>{
      const source=spec.edges.find(k=>k.id===e.id), section=e.sections?.[0];
      if(!section)throw Error(`ELK did not route ${e.id}`);
      const points=[section.startPoint,...(section.bendPoints??[]),section.endPoint];
      return {...source,points,fromSide:direction(port(byId[source.from],'N'),section.startPoint),labelPosition:e.labels?.[0]?{x:e.labels[0].x+e.labels[0].width/2,y:e.labels[0].y+17}:undefined};
    });
  }
  const groups=(spec.groups??[]).map(g=>{
    const children=nodes.filter(n=>n.group===g.id);if(!children.length)throw Error(`Empty group ${g.id}`);
    const x=Math.min(...children.map(n=>n.x))-8, y=Math.min(...children.map(n=>n.y))-39;
    return {...g,x,y,w:Math.max(...children.map(n=>n.x+n.w))+8-x,h:Math.max(...children.map(n=>n.y+n.h))+16-y};
  });
  return {nodes,edges,groups,sourceEdges:spec.edges,sourceLayout,reused:!!canReuse};
}
export function makeScene(spec,laid,metrics){
  const {nodes,edges,groups}=structuredClone(laid);
  const all=[...nodes.map(n=>({x:n.x,y:n.y})),...groups.map(g=>({x:g.x,y:g.y})),...edges.flatMap(e=>e.points)];
  const minX=Math.min(...all.map(p=>p.x)), minY=Math.min(...all.map(p=>p.y));
  const shiftX=28-minX, shiftY=(spec.title?88:28)-minY;
  for(const n of [...nodes,...groups]){n.x+=shiftX;n.y+=shiftY;}
  for(const e of edges){for(const p of e.points){p.x+=shiftX;p.y+=shiftY;}if(e.labelPosition){e.labelPosition.x+=shiftX;e.labelPosition.y+=shiftY;}}
  const width=Math.max(...nodes.map(n=>n.x+n.w),...groups.map(g=>g.x+g.w),...edges.flatMap(e=>e.points.map(p=>p.x)))+28;
  let contentBottom=Math.max(...nodes.map(n=>n.y+n.h),...groups.map(g=>g.y+g.h),...edges.flatMap(e=>e.points.map(p=>p.y)));
  const primitives=[];
  const rect=(x,y,w,h,fill,stroke,extra={})=>primitives.push({kind:'rect',x,y,w,h,fill,stroke,radius:6,...extra});
  const text=(label,x,y,size,fill,bold=false,extra={})=>primitives.push({kind:'text',text:String(label),x,y,size,fill,bold,...extra});
  if(spec.title){text(spec.title,28,30,24,'#172B43',true,{role:'title'});if(spec.subtitle)text(spec.subtitle,28,56,16,'#5C6C80',false,{role:'subtitle'});}
  for(const g of groups){rect(g.x,g.y,g.w,g.h,'#F7F9FC','#CBD5E1',{dash:[5,4],role:'group',id:g.id});text(g.label,g.x+13,g.y+25,16,'#52657D',true,{owner:g.id,role:'group-label'});}
  for(const e of edges){
    const stroke=e.kind==='auxiliary'?'#97A0AE':e.kind==='skip'?'#58758F':'#53677F';
    primitives.push({kind:'line',points:e.points,stroke,strokeWidth:e.kind==='skip'?1.6:1.8,...(e.kind==='auxiliary'?{dash:[5,4]}:{}),role:'edge',id:e.id});
    const b=e.points.at(-1),a=e.points.at(-2);const angle=Math.atan2(b.y-a.y,b.x-a.x),L=7,W=3;
    primitives.push({kind:'polygon',points:[b,{x:b.x-L*Math.cos(angle)+W*Math.sin(angle),y:b.y-L*Math.sin(angle)-W*Math.cos(angle)},{x:b.x-L*Math.cos(angle)-W*Math.sin(angle),y:b.y-L*Math.sin(angle)+W*Math.cos(angle)}],fill:stroke,role:'arrow'});
    if(e.label){
      let label=e.labelPosition;
      if(!label){const segs=e.points.slice(1).map((p,i)=>({a:e.points[i],b:p,L:Math.hypot(p.x-e.points[i].x,p.y-e.points[i].y)})).sort((a,b)=>b.L-a.L);const s=segs[0];label={x:(s.a.x+s.b.x)/2,y:(s.a.y+s.b.y)/2-9};}
      const w=measure(e.label,16,metrics)+10;rect(label.x-w/2,label.y-17,w,23,'#FFFFFF',null,{radius:2,role:'edge-label',id:e.id});text(e.label,label.x,label.y,16,'#52657D',false,{anchor:'middle',role:'edge-label-text'});
    }
  }
  for(const n of nodes){
    const color=palette(spec.theme??'paper',n.type),op=operators.includes(n.type);
    if(op){
      rect(n.x,n.y,n.w,n.h,color.fill,color.stroke,{radius:12,strokeWidth:1.6,role:'node',id:n.id});
      primitives.push({kind:'ellipse',x:n.x+n.w/2-16,y:n.y+9,w:32,h:32,fill:'#FFFFFF',stroke:color.stroke,strokeWidth:1.3,role:'operator-badge'});
      if(n.type==='concat')text('C',n.x+n.w/2,n.y+32,20,color.stroke,true,{anchor:'middle',owner:n.id,role:'node-label'});
      else{
        const x=n.x+n.w/2,y=n.y+25,d=7;
        const points=n.type==='add'?[[{x:x-d,y},{x:x+d,y}],[{x,y:y-d},{x,y:y+d}]]:[[{x:x-d,y:y-d},{x:x+d,y:y+d}],[{x:x-d,y:y+d},{x:x+d,y:y-d}]];
        for(const segment of points)primitives.push({kind:'line',points:segment,stroke:color.stroke,strokeWidth:1.9,role:'operator-symbol'});
      }
      let yy=n.y+58;
      for(const line of n.labelLines){text(line,n.x+n.w/2,yy,18,'#20354B',true,{anchor:'middle',owner:n.id,role:'node-label'});yy+=22;}
      yy+=8;
      for(const line of n.detailLines.filter(Boolean)){text(line,n.x+n.w/2,yy,16,'#5B6878',false,{anchor:'middle',owner:n.id,role:'node-detail'});yy+=20;}
    }else{
      rect(n.x,n.y,n.w,n.h,color.fill,color.stroke,{radius:n.type==='input'||n.type==='output'?12:5,strokeWidth:1.4,role:'node',id:n.id});
      rect(n.x,n.y,4,n.h,color.stroke,null,{radius:1,role:'accent'});
      const total=n.labelLines.length*22+(n.detailLines.filter(Boolean).length?10+n.detailLines.length*20:0);
      let yy=n.y+(n.h-total)/2+18;
      for(const line of n.labelLines){text(line,n.x+n.w/2,yy,18,'#20354B',true,{anchor:'middle',owner:n.id,role:'node-label'});yy+=22;}
      if(n.detailLines.filter(Boolean).length){yy+=8;for(const line of n.detailLines){text(line,n.x+n.w/2,yy,16,'#5B6878',false,{anchor:'middle',owner:n.id,role:'node-detail'});yy+=20;}}
    }
  }
  if(spec.legend!==false){
    const labels=spec.legend??[...new Set(nodes.map(n=>n.type))].filter(t=>operators.includes(t)).map(t=>({label:{add:'Add: elementwise',concat:'C: concatenate',multiply:'Multiply: elementwise'}[t],type:t}));
    let lx=28,ly=contentBottom+42;
    for(const item of labels){const w=measure(item.label,16,metrics)+35;if(lx+w>width-20&&lx>28){lx=28;ly+=28;}const c=palette(spec.theme??'paper',item.type??'feature');rect(lx,ly-12,12,12,c.fill,c.stroke,{radius:2,role:'legend-key'});text(item.label,lx+21,ly,16,'#637185',false,{role:'legend'});lx+=w;}
    if(labels.length)contentBottom=ly;
  }
  const height=contentBottom+28;
  if(spec.theme==='mono')for(const p of primitives)for(const key of ['fill','stroke'])if(p[key])p[key]=grayscale(p[key]);
  return {version:1,title:spec.title??'',widthMm:spec.widthMm??180,width,height,primitives,nodes,edges,groups,fontFiles:metrics.fonts,reusedLayout:laid.reused,sourceNodeIds:spec.nodes.map(n=>n.id),sourceEdgeIds:spec.edges.map(e=>e.id)};
}
export function toSVG(scene){
  const body=scene.primitives.map(p=>{
    const style=`${p.fill?` fill="${p.fill}"`:' fill="none"'}${p.stroke?` stroke="${p.stroke}" stroke-width="${p.strokeWidth??1.4}"`:''}${p.dash?` stroke-dasharray="${p.dash.join(' ')}"`:''}`;
    if(p.kind==='rect')return `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${p.radius??0}"${style}/>`;
    if(p.kind==='ellipse')return `<ellipse cx="${p.x+p.w/2}" cy="${p.y+p.h/2}" rx="${p.w/2}" ry="${p.h/2}"${style}/>`;
    if(p.kind==='line'||p.kind==='polygon')return `<${p.kind==='line'?'polyline':'polygon'} points="${p.points.map(q=>`${q.x},${q.y}`).join(' ')}"${style} stroke-linecap="round" stroke-linejoin="round"/>`;
    return `<text x="${p.x}" y="${p.y}" font-size="${p.size}" font-weight="${p.bold?700:400}" text-anchor="${p.anchor??'start'}" fill="${p.fill}">${xml(p.text)}</text>`;
  }).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.widthMm}mm" height="${scene.height*scene.widthMm/scene.width}mm" viewBox="0 0 ${scene.width} ${scene.height}" role="img" aria-label="${xml(scene.title)}"><title>${xml(scene.title)}</title><g font-family="Arial,Microsoft YaHei,DejaVu Sans,sans-serif">${body}</g></svg>`;
}
export function toDrawio(scene,spec){
  const cells=['<mxCell id="0"/>','<mxCell id="1" parent="0"/>'];
  const base='html=0;whiteSpace=wrap;fontFamily=Arial;fontColor=#20354B;';
  for(const g of scene.groups)cells.push(`<mxCell id="group-${xml(g.id)}" value="${xml(g.label)}" style="${base}rounded=1;dashed=1;fillColor=#F7F9FC;strokeColor=#CBD5E1;verticalAlign=top;align=left;spacingTop=10;spacingLeft=12;fontSize=16;connectable=0;" vertex="1" parent="1"><mxGeometry x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" as="geometry"/></mxCell>`);
  for(const n of scene.nodes){
    const op=operators.includes(n.type),color=palette(spec.theme??'paper',n.type),label=[...(op?[{add:'+',concat:'C',multiply:'×'}[n.type]]:[]),...n.labelLines,...n.detailLines].filter(Boolean).join('\n');
    cells.push(`<mxCell id="node-${xml(n.id)}" value="${xml(label)}" style="${base}rounded=1;fillColor=${color.fill};strokeColor=${color.stroke};strokeWidth=1.4;fontSize=18;fontStyle=${op?1:0};" vertex="1" parent="1"><mxGeometry x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" as="geometry"/></mxCell>`);
  }
  const sideFraction=(n,p)=>({x:Math.max(0,Math.min(1,(p.x-n.x)/n.w)),y:Math.max(0,Math.min(1,(p.y-n.y)/n.h))});
  for(const e of scene.edges){
    const a=scene.nodes.find(n=>n.id===e.from), b=scene.nodes.find(n=>n.id===e.to),exit=sideFraction(a,e.points[0]),entry=sideFraction(b,e.points.at(-1));
    cells.push(`<mxCell id="edge-${xml(e.id)}" value="${xml(e.label??'')}" style="${base}edgeStyle=none;endArrow=block;endFill=1;strokeColor=#53677F;strokeWidth=1.8;fontSize=16;exitX=${exit.x};exitY=${exit.y};entryX=${entry.x};entryY=${entry.y};${e.kind==='auxiliary'?'dashed=1;':''}" edge="1" source="node-${xml(e.from)}" target="node-${xml(e.to)}" parent="1"><mxGeometry relative="1" as="geometry"><Array as="points">${e.points.slice(1,-1).map(p=>`<mxPoint x="${p.x}" y="${p.y}"/>`).join('')}</Array></mxGeometry></mxCell>`);
  }
  let textIndex=0;
  for(const p of scene.primitives.filter(p=>p.kind==='text'&&['title','subtitle','legend'].includes(p.role))){const w=Math.max(80,p.text.length*17);cells.push(`<mxCell id="annotation-${++textIndex}" value="${xml(p.text)}" style="${base}text;strokeColor=none;fillColor=none;align=left;verticalAlign=bottom;fontSize=${p.size};fontStyle=${p.bold?1:0};" vertex="1" parent="1"><mxGeometry x="${p.x}" y="${p.y-p.size}" width="${w}" height="${p.size+4}" as="geometry"/></mxCell>`);}
  const document=`<?xml version="1.0" encoding="UTF-8"?><mxfile host="app.diagrams.net" version="24.7.17"><diagram name="${xml(spec.title??'Model')}" id="model"><mxGraphModel dx="${scene.width}" dy="${scene.height}" grid="1" gridSize="10" page="0"><root>${cells.join('')}</root></mxGraphModel></diagram></mxfile>`;
  return spec.theme==='mono'?document.replace(/#[A-Fa-f0-9]{6}/g,grayscale):document;
}
function overlap(a,b,pad=0){return a.x+pad<b.x+b.w&&a.x+a.w-pad>b.x&&a.y+pad<b.y+b.h&&a.y+a.h-pad>b.y;}
function segmentHits(a,b,r){
  const eps=1.5;
  if(Math.abs(a.x-b.x)<.01)return a.x>r.x+eps&&a.x<r.x+r.w-eps&&Math.max(a.y,b.y)>r.y+eps&&Math.min(a.y,b.y)<r.y+r.h-eps;
  if(Math.abs(a.y-b.y)<.01)return a.y>r.y+eps&&a.y<r.y+r.h-eps&&Math.max(a.x,b.x)>r.x+eps&&Math.min(a.x,b.x)<r.x+r.w-eps;
  return false;
}
export function checkScene(scene,spec,metrics){
  const errors=[],warnings=[];
  for(let i=0;i<scene.nodes.length;i++)for(let j=i+1;j<scene.nodes.length;j++)if(overlap(scene.nodes[i],scene.nodes[j],.5))errors.push(`Node overlap: ${scene.nodes[i].id}/${scene.nodes[j].id}`);
  for(const e of scene.edges){
    for(let i=1;i<e.points.length;i++){
      const a=e.points[i-1],b=e.points[i];
      if(Math.abs(a.x-b.x)>.01&&Math.abs(a.y-b.y)>.01)errors.push(`Nonorthogonal segment: ${e.id}`);
      for(const n of scene.nodes)if(n.id!==e.from&&n.id!==e.to&&segmentHits(a,b,n))errors.push(`Edge ${e.id} crosses node ${n.id}`);
      for(const g of scene.groups){const r={x:g.x,y:g.y,w:g.w,h:32};if(segmentHits(a,b,r))errors.push(`Edge ${e.id} crosses group header ${g.id}`);}
    }
    for(const [nodeId,point] of [[e.from,e.points[0]],[e.to,e.points.at(-1)]]){
      const n=scene.nodes.find(n=>n.id===nodeId),d=Math.min(Math.abs(point.x-n.x),Math.abs(point.x-n.x-n.w),Math.abs(point.y-n.y),Math.abs(point.y-n.y-n.h));
      if(d>.1||point.x<n.x-.1||point.x>n.x+n.w+.1||point.y<n.y-.1||point.y>n.y+n.h+.1)errors.push(`Detached endpoint: ${e.id}/${nodeId}`);
    }
  }
  const texts=scene.primitives.filter(p=>p.kind==='text');
  for(const t of texts){
    const w=measure(t.text,t.size,metrics,t.bold),x=t.anchor==='middle'?t.x-w/2:t.anchor==='end'?t.x-w:t.x;
    const box={x,y:t.y-t.size*.85,w,h:t.size};
    if(box.x<-.1||box.x+box.w>scene.width+.1||box.y<-.1||box.y+box.h>scene.height+.1)errors.push(`Text outside canvas: ${t.text}`);
    if(t.owner&&t.role.startsWith('node')){const n=scene.nodes.find(n=>n.id===t.owner);if(box.x<n.x+5||box.x+w>n.x+n.w-5||box.y<n.y||box.y+box.h>n.y+n.h)errors.push(`Label overflow: ${t.owner}/${t.text}`);}
    if(t.role==='edge-label-text')for(const n of scene.nodes)if(overlap(box,n))errors.push(`Edge label overlaps node ${n.id}`);
    for(const e of scene.edges)for(let i=1;i<e.points.length;i++)if(segmentHits(e.points[i-1],e.points[i],box))errors.push(`Edge ${e.id} crosses text: ${t.text}`);
  }
  const minFontPt=Math.min(...texts.filter(p=>p.text).map(p=>p.size))*scene.widthMm*72/25.4/scene.width;
  if(minFontPt<(spec.minFontPt??7.5)-.01)errors.push(`Final font ${minFontPt.toFixed(2)}pt is below ${spec.minFontPt??7.5}pt; increase widthMm or reorganize layout.`);
  if(JSON.stringify([...scene.sourceNodeIds].sort())!==JSON.stringify(spec.nodes.map(n=>n.id).sort()))errors.push('Node set changed during rendering');
  if(JSON.stringify([...scene.sourceEdgeIds].sort())!==JSON.stringify(spec.edges.map(n=>n.id).sort()))errors.push('Edge set changed during rendering');
  for(const e of spec.edges){const actual=scene.edges.find(a=>a.id===e.id);if(!actual||actual.from!==e.from||actual.to!==e.to)errors.push(`Changed edge topology: ${e.id}`);}
  for(const n of spec.nodes){const actual=scene.nodes.find(a=>a.id===n.id);if(!actual||actual.type!==n.type||JSON.stringify(actual.tensor)!==JSON.stringify(n.tensor))errors.push(`Changed node semantics: ${n.id}`);}
  for(const g of scene.groups)for(const n of scene.nodes.filter(n=>n.group!==g.id))if(overlap(g,n))errors.push(`Group ${g.id} overlaps unrelated node ${n.id}`);
  return {pass:!errors.length,errors:[...new Set(errors)],warnings,counts:{nodes:scene.nodes.length,edges:scene.edges.length,groups:scene.groups.length},size:{widthMm:scene.widthMm,heightMm:scene.height*scene.widthMm/scene.width,minFontPt:+minFontPt.toFixed(2)},fonts:scene.fontFiles,layoutReused:scene.reusedLayout};
}
