import fs from 'node:fs';
import crypto from 'node:crypto';

export const knownOps=new Set(['input','output','conv','convblock','pool','gap','linear','relu','sigmoid','softmax','norm','dropout','identity','upsample','concat','add','multiply','attention','custom']);
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const number=x=>Number.isInteger(x)&&x>0;
export function validateIR(ir,{checkFiles=false}={}){
  const errors=[],warnings=[];
  if(ir.schema!=='paper-model/1')errors.push('schema must be paper-model/1');
  if(!Array.isArray(ir.nodes)||!ir.nodes.length)errors.push('nodes must be nonempty');
  if(!Array.isArray(ir.edges))errors.push('edges must be an array');
  if(!Array.isArray(ir.sources)||!ir.sources.length)errors.push('sources must identify the actual article/image/description');
  if(!Array.isArray(ir.evidence)||!ir.evidence.length)errors.push('evidence is required');
  if(errors.length)return {pass:false,errors,warnings};
  const sources=new Map(),facts=new Map(),ids=new Set(),edgeIds=new Set();
  for(const s of ir.sources){
    if(!s.id||sources.has(s.id))errors.push(`Invalid/duplicate source: ${s.id}`);sources.set(s.id,s);
    if(!s.uri&&!s.path)errors.push(`Source needs uri or path: ${s.id}`);
    if(s.sha256&&!/^[0-9a-f]{64}$/i.test(s.sha256))errors.push(`Invalid source SHA-256: ${s.id}`);
    if(checkFiles&&s.path&&s.sha256){if(!fs.existsSync(s.path))errors.push(`Source file missing: ${s.id}`);else if(crypto.createHash('sha256').update(fs.readFileSync(s.path)).digest('hex')!==s.sha256)errors.push(`Source hash differs: ${s.id}`);}
  }
  for(const e of ir.evidence){
    if(!e.id||facts.has(e.id))errors.push(`Invalid/duplicate evidence: ${e.id}`);facts.set(e.id,e);
    if(!sources.has(e.source))errors.push(`Unknown evidence source: ${e.id}`);
    if(!e.locator||!e.statement)errors.push(`Evidence needs locator and paraphrased statement: ${e.id}`);
    if(!['stated','inferred','uncertain'].includes(e.status??'stated'))errors.push(`Invalid evidence status: ${e.id}`);
    if(e.status==='inferred'&&!e.reason)errors.push(`Inferred evidence needs reason: ${e.id}`);
  }
  const refs=(obj,kind)=>{if(!Array.isArray(obj.evidence)||!obj.evidence.length)errors.push(`Missing evidence: ${kind} ${obj.id}`);else for(const id of obj.evidence)if(!facts.has(id))errors.push(`Unknown evidence ${id} for ${obj.id}`);};
  for(const n of ir.nodes){
    if(!/^[A-Za-z][A-Za-z0-9_-]*$/.test(n.id??'')||ids.has(n.id))errors.push(`Invalid/duplicate node id: ${n.id}`);ids.add(n.id);
    if(!n.op||!n.label)errors.push(`Missing op/label: ${n.id}`);refs(n,'node');
    if(!knownOps.has(n.op)&&!n.meaning)errors.push(`New operator requires meaning: ${n.id}`);
    if(n.shape&&(!Array.isArray(n.shape)||!n.shape.length||n.shape.some(v=>v!==null&&!number(v)&&!(typeof v==='string'&&v.trim()))))errors.push(`Invalid shape: ${n.id}`);
    if(n.shape&&!['stated','inferred','unknown'].includes(n.shapeStatus??''))errors.push(`shapeStatus required for declared shape: ${n.id}`);
    if(n.shapeStatus==='inferred'&&!n.shapeReason)errors.push(`Inferred shape needs shapeReason: ${n.id}`);
    if(n.repeat!==undefined&&(!number(n.repeat)))errors.push(`Invalid repeat: ${n.id}`);
    if(!knownOps.has(n.op)||['custom','attention'].includes(n.op))warnings.push(`Abstract operator retained without invented internals: ${n.id}`);
  }
  for(const e of ir.edges){
    if(!e.id||edgeIds.has(e.id))errors.push(`Invalid/duplicate edge id: ${e.id}`);edgeIds.add(e.id);
    if(!ids.has(e.from)||!ids.has(e.to))errors.push(`Unknown edge endpoint: ${e.id}`);refs(e,'edge');
  }
  if(ir.render?.mode&&ir.render.mode!=='volume')errors.push('This paper workflow requires volume mode; 2D fallback is disabled');
  return {pass:!errors.length,errors,warnings};
}

function broadcast(shapes){
  const rank=Math.max(...shapes.map(s=>s.length)),out=[];
  for(let i=0;i<rank;i++){
    const dims=shapes.map(s=>s.length-rank+i<0?1:s[s.length-rank+i]).filter(x=>x!==1);
    const known=[...new Set(dims.filter(x=>x!==null).map(String))];
    if(known.length>1)throw Error('Broadcast input dimensions differ');
    out.push(dims.includes(null)?null:dims[0]??1);
  }return out;
}
function infer(node,inputs){
  const a=inputs[0],p=node.params??{};
  if(!a)return undefined;
  if(['output','identity','relu','sigmoid','softmax','norm','dropout'].includes(node.op))return [...a];
  const chw=(node.axes??'CHW')==='CHW';
  if(node.op==='gap'&&chw&&a.length===3)return [a[0],1,1];
  if(node.op==='linear'&&p.outChannels!==undefined&&(a.length===1||chw&&a.length===3))return a.length===3?[p.outChannels,1,1]:[p.outChannels];
  if(['conv','convblock','pool','upsample'].includes(node.op)&&chw&&a.length===3){
    if(node.op==='upsample'&&p.scale)return [p.outChannels??a[0],...a.slice(1).map(x=>number(x)?x*p.scale:null)];
    if(p.stride===undefined||p.kernel===undefined||p.padding===undefined)return undefined;
    const k=Array.isArray(p.kernel)?p.kernel:[p.kernel,p.kernel],s=Array.isArray(p.stride)?p.stride:[p.stride,p.stride],pad=Array.isArray(p.padding)?p.padding:[p.padding,p.padding];
    return [p.outChannels??a[0],...a.slice(1).map((x,i)=>number(x)?Math.floor((x+2*pad[i]-(p.dilation??1)*(k[i]-1)-1)/s[i])+1:null)];
  }
  if(['add','multiply','concat'].includes(node.op)){
    if(inputs.length<2)return undefined;
    if(node.op==='multiply'&&p.broadcast)return broadcast(inputs);
    if(node.op==='concat'){
      const axis=p.axis??0,out=[...a];if(!Number.isInteger(axis)||axis<0||axis>=a.length)throw Error(`Invalid concat axis: ${node.id}`);
      if(inputs.some(s=>s.length!==a.length||s.some((v,i)=>i!==axis&&v!==null&&a[i]!==null&&v!==a[i])))throw Error(`Concat input dimensions differ: ${node.id}`);
      const ds=inputs.map(s=>s[axis]);out[axis]=ds.every(number)?ds.reduce((x,y)=>x+y,0):ds.some(v=>v===null)?null:ds.join('+');return out;
    }
    if(inputs.some(s=>s.length!==a.length||s.some((v,i)=>v!==null&&a[i]!==null&&v!==a[i])))throw Error(`Elementwise input dimensions differ: ${node.id}`);
    return [...a];
  }
  return undefined;
}
export function resolveShapes(ir){
  const result=structuredClone(ir),warnings=[],errors=[],byId=new Map(result.nodes.map(n=>[n.id,n]));
  for(let pass=0;pass<=result.nodes.length;pass++){
    let changed=false;
    for(const n of result.nodes){
      const incoming=result.edges.filter(e=>e.to===n.id&&e.kind!=='auxiliary').map(e=>byId.get(e.from)?.shape);
      if(!incoming.length||incoming.some(x=>!x))continue;
      try{
        const derived=infer(n,incoming);
        if(!derived)continue;
        if(derived.some(v=>typeof v==='number'&&!number(v)))throw Error(`Invalid derived dimension: ${n.id}`);
        if(n.shape){if(n.shape.length!==derived.length||n.shape.some((v,i)=>number(v)&&number(derived[i])&&v!==derived[i]))throw Error(`Declared and derived shapes differ: ${n.id}`);}
        else{n.shape=derived;n.shapeStatus='inferred';n.shapeReason=`Derived using ${n.op} from ${result.edges.filter(e=>e.to===n.id).map(e=>e.from).join(', ')} and explicit parameters`;changed=true;}
      }catch(e){errors.push(e.message);}
    }if(!changed)break;
  }
  for(const n of result.nodes)if(!n.shape||n.shape.some(x=>x===null)){warnings.push(`Unresolved dimensions retained: ${n.id}`);n.shape??=[null,null,null];n.shapeStatus??='unknown';}
  return {ir:result,errors:[...new Set(errors)],warnings};
}
