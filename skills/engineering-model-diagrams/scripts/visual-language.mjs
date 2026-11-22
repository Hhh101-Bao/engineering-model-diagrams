/** Source semantics select geometry; color is never the sole model identifier. */
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function tint(hex,amount=.7){const c=hex.slice(1).match(/../g).map(x=>parseInt(x,16));return '#'+c.map(x=>Math.round(x+(255-x)*amount).toString(16).padStart(2,'0')).join('');}
export const glyphKinds=new Set(['tensor','operation','tokens','vector','matrix','patches','windows','pyramid','masks','operator']);
export function chooseGlyph(n){
  const explicit=typeof n.visual==='string'?n.visual:n.visual?.glyph;
  if(explicit){if(!glyphKinds.has(explicit))throw Error('Unknown visual glyph: '+explicit);return explicit;}
  if(['add','multiply'].includes(n.op))return 'operator';
  const shape=n.shape??[];
  if(['norm','attention','dropout','relu','sigmoid','softmax'].includes(n.op)||n.op==='linear'&&n.axes==='tokens')return 'operation';
  if(shape.length===2&&(n.axes==='tokens'||(n.axes??'CHW')!=='CHW'))return 'tokens';
  if(shape.length===1||shape.length===3&&shape[1]===1&&shape[2]===1)return 'vector';
  if(shape.length===3&&['input','output','conv','convblock','upsample'].includes(n.op))return 'tensor';
  if(['input','output','conv','convblock'].includes(n.op))return 'tensor';
  return 'operation';
}
function spatial(value){
  if(typeof value==='number')return clamp(.65+.34*Math.log2(Math.max(1,value)),.75,3.7);
  const divisor=String(value??'').match(/[HW]\s*\/\s*(\d+)/i)?.[1];
  return divisor?clamp(3.8/Number(divisor)**.28,.8,3.8):2.6;
}
export function glyphGeometry(n,fill,{projection=.42}={}){
  const kind=chooseGlyph(n),config=typeof n.visual==='object'?n.visual:{},shape=n.shape??[],C=typeof shape[0]==='number'?shape[0]:64;
  let h=spatial(shape[1]),d=spatial(shape[2]),w=['input','output'].includes(n.op)?.13:clamp(.12+.085*Math.log2(Math.max(C,2)),.22,.95),parts,marks;
  if(kind==='operator')return {kind,w:.9,h:.9,d:.9,widths:[.9],sphere:true};
  if(kind==='operation'){w=config.width??1.9;h=.7;d=.22;parts=[{x:0,y:0,z:0,w,h,d,fill:tint(fill,.58),tone:.58}];}
  if(kind==='tokens'||kind==='vector'){
    const count=7;w=kind==='tokens'?2.9:2.15;h=kind==='tokens'?1.05:.64;d=.25;
    const gap=.18,cell=(w-gap*(count-1))/count;
    parts=Array.from({length:count},(_,i)=>({x:i*(cell+gap),y:0,z:0,w:cell,h,d,fill:i===0&&config.cls?fill:tint(fill,.35),tone:i===0&&config.cls?0:.35})).filter((_,i)=>i!==3);
    marks=[{x:w/2,y:h/2,text:'⋯'}];
  }
  if(kind==='matrix'){
    w=h=2.8;d=.16;const count=5,gap=.035,cell=(w-gap*(count-1))/count;
    parts=[{x:0,y:0,z:.12,w,h,d:.04,fill:'#E5E8EB',fixedFill:true},...Array.from({length:count*count},(_,i)=>{const r=Math.floor(i/count),c=i%count;return {x:c*(cell+gap),y:(count-1-r)*(cell+gap),z:0,w:cell,h:cell,d:.12,fill:config.diagonal&&r===c?fill:tint(fill,.85),tone:config.diagonal&&r===c?0:.85};})];
  }
  if(kind==='patches'||kind==='windows'){
    w=kind==='patches'?.12:w;if(config.spatialSize)h=d=config.spatialSize;const count=config.grid??3,gap=.07,cellH=(h-gap*(count-1))/count,cellD=(d-gap*(count-1))/count;
    parts=Array.from({length:count*count},(_,i)=>({x:0,y:Math.floor(i/count)*(cellH+gap),z:(i%count)*(cellD+gap),w,h:cellH,d:cellD,fill:tint(fill,kind==='patches'?.55:.25),tone:kind==='patches'?.55:.25}));
    if(config.shifted){const splits=length=>[0,...Array.from({length:count},(_,i)=>(i+.5)*length/count),length],ys=splits(h),zs=splits(d);parts=[];for(let i=0;i<ys.length-1;i++)for(let j=0;j<zs.length-1;j++)parts.push({x:0,y:ys[i]+gap/2,z:zs[j]+gap/2,w,h:ys[i+1]-ys[i]-gap,d:zs[j+1]-zs[j]-gap,fill:tint(fill,.25),tone:.25});}
  }
  if(kind==='pyramid'){
    w=1.2;h=5.7;d=2.7;
    parts=Array.from({length:4},(_,i)=>({x:i*.18,y:i*1.5,z:0,w:.36+i*.10,h:1.2-i*.15,d:d-i*.5,fill:tint(fill,i*.10),tone:i*.10}));
  }
  if(kind==='masks'){
    h=2.7;d=2.7;const gap=d*projection+.28;w=.12*3+gap*2;
    parts=Array.from({length:3},(_,i)=>({x:i*(.12+gap),y:0,z:0,w:.12,h,d,fill:tint(fill,i*.13),tone:i*.13}));
  }
  if(kind==='tensor'&&!['conv','convblock'].includes(n.op))parts=[{x:0,y:0,z:0,w,h,d,fill}];
  if(config.size)[w,h,d]=config.size;
  if(parts&&config.size)throw Error('Set glyph size through its semantic parameters, not a mismatched outer box');
  const repeat=kind==='tensor'&&['conv','convblock'].includes(n.op)?Math.min(n.repeat??1,3):1,sliceGap=repeat>1?d*projection+.6:0;
  return {kind,w:w*repeat+sliceGap*(repeat-1),h,d,widths:Array(repeat).fill(w),sliceGap,parts,marks,sphere:false};
}
/** Intersect an actual cuboid face, so sampled tokens/windows do not leave ports in air. */
export function partPort(parts,{w,h,d},port,spread=0,projection=.28){
  const target=port==='east'?[w+d*projection,(h+d*projection)/2+spread]:port==='west'?[0,(h+d*projection)/2+spread]:port==='north'?[w/2+d*projection+spread,h+d*projection]:[w/2+spread,0];
  const candidates=parts.map(p=>{
    const high=['east','north'].includes(port),z=p.z+(high?p.d:0),offset=z*projection;
    let point;
    if(port==='east'||port==='west')point=[p.x+(port==='east'?p.w:0)+offset,clamp(target[1],p.y+offset,p.y+p.h+offset)];
    else point=[clamp(target[0],p.x+offset,p.x+p.w+offset),p.y+(port==='north'?p.h:0)+offset];
    return {point,z,distance:Math.hypot(point[0]-target[0],point[1]-target[1])};
  });
  return candidates.sort((a,b)=>a.distance-b.distance)[0];
}
