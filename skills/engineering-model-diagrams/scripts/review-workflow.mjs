#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const required=['ir.json','volume.json','png','glb'];
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
export function checkMesh3D(file){
  const b=fs.readFileSync(file),errors=[];
  if(b.readUInt32LE(0)!==0x46546c67||b.readUInt32LE(4)!==2||b.readUInt32LE(8)!==b.length)throw Error('Invalid GLB header');
  const len=b.readUInt32LE(12),g=JSON.parse(b.subarray(20,20+len).toString()),binStart=20+len+8,binSize=b.readUInt32LE(20+len);
  if(g.textures?.length||g.images?.length)errors.push('Image textures are forbidden in this volume workflow');
  if(binStart+binSize!==b.length)errors.push('Invalid GLB binary chunk');
  let volumes=0,triangles=0;
  for(const mesh of g.meshes??[])for(const p of mesh.primitives){
    if((p.mode??4)!==4)continue;
    const a=g.accessors[p.attributes.POSITION],v=g.bufferViews[a.bufferView];
    if(a.componentType!==5126||a.type!=='VEC3')throw Error('Expected float XYZ mesh positions');
    const start=binStart+(v.byteOffset??0)+(a.byteOffset??0),stride=v.byteStride??12;
    const points=Array.from({length:a.count},(_,i)=>[0,1,2].map(k=>b.readFloatLE(start+i*stride+k*4)));
    if(start+(a.count-1)*stride+12>binStart+(v.byteOffset??0)+v.byteLength||points.flat().some(v=>!Number.isFinite(v)))errors.push(`Invalid mesh coordinates: ${mesh.name}`);
    const spans=[0,1,2].map(i=>Math.max(...points.map(p=>p[i]))-Math.min(...points.map(p=>p[i])));
    if(spans.some(s=>s<=0))errors.push(`Flat mesh: ${mesh.name}`);
    // A volume must contain four non-coplanar vertices, not a tilted image plane.
    const origin=points[0],vec=points.map(p=>p.map((v,i)=>v-origin[i]));let nonCoplanar=false;
    outer:for(let i=1;i<vec.length;i++)for(let j=i+1;j<vec.length;j++){const a=vec[i],c=vec[j],cross=[a[1]*c[2]-a[2]*c[1],a[2]*c[0]-a[0]*c[2],a[0]*c[1]-a[1]*c[0]];for(const d of vec)if(Math.abs(cross.reduce((s,v,k)=>s+v*d[k],0))>1e-8){nonCoplanar=true;break outer;}}
    if(!nonCoplanar)errors.push(`Coplanar mesh: ${mesh.name}`);
    const count=g.accessors[p.indices]?.count??a.count;triangles+=count/3;volumes++;
  }
  if(!volumes)errors.push('No volume triangle meshes');
  return {pass:!errors.length,errors,volumes,triangles,imageTextures:0};
}
export function prepareReview(prefix){
  const out=path.resolve(prefix),ir=read(out+'.ir.json');
  return {schema:'paper-model-review/1',artifactSha256:Object.fromEntries(required.map(ext=>[ext,hash(out+'.'+ext)])),
    semantic:{pass:false,checkedNodes:[],checkedEdges:[],sourcesRead:[],notes:'Fill only after reading actual source. Required nodes: '+ir.nodes.map(n=>n.id).join(', ')+'; edges: '+ir.edges.map(e=>e.id).join(', ')},
    visual:{pass:false,inspectedImages:[],checks:{connectedPorts:false,readableLabels:false,coherentProjection:false,noUnrelatedCrossing:false},notes:'Fill after inspecting actual PNG at the intended size.'},limitations:[]};
}
export function finalizeReview(prefix,review){
  const out=path.resolve(prefix),ir=read(out+'.ir.json'),spec=read(out+'.volume.json'),run=read(out+'.workflow.json'),r=typeof review==='string'?read(review):review,errors=[];
  if(r.schema!=='paper-model-review/1')errors.push('Invalid review schema');
  for(const ext of required)if(r.artifactSha256?.[ext]!==hash(out+'.'+ext))errors.push(`Review is stale or incomplete: ${ext}`);
  for(const [key,expected] of [['checkedNodes',ir.nodes.map(n=>n.id)],['checkedEdges',ir.edges.map(e=>e.id)],['sourcesRead',ir.sources.map(s=>s.id)]])if(expected.some(id=>!r.semantic?.[key]?.includes(id)))errors.push(`Unreviewed items: semantic.${key}`);
  if(!r.semantic?.pass||!r.semantic?.notes?.trim())errors.push('Semantic review has not passed');
  if(!r.visual?.pass||!r.visual?.notes?.trim()||!r.visual?.inspectedImages?.some(p=>path.resolve(p)===out+'.png'))errors.push('Actual PNG visual review is required');
  for(const key of ['connectedPorts','readableLabels','coherentProjection','noUnrelatedCrossing'])if(r.visual?.checks?.[key]!==true)errors.push(`Visual check did not pass: ${key}`);
  if(run.flatFallback!==false||!(spec.depthMultiplier>0)||spec.layers.some(l=>!(l.height>0)||!(l.depth>0)||l.widths.some(w=>!(w>0))||l.image))errors.push('Volume/no-texture invariant failed');
  const mesh=checkMesh3D(out+'.glb');errors.push(...mesh.errors);
  if(errors.length)throw Error(errors.join('\n'));
  const limitations=[...new Set([...(ir.uncertainties??[]),...(run.warnings??[]),...(r.limitations??[])])];
  const result={...run,status:limitations.length?'reviewed-with-limitations':'reviewed',review:{file:out+'.review.json',artifactSha256:r.artifactSha256,semanticPass:true,visualPass:true,mesh},limitations};
  fs.writeFileSync(out+'.review.json',JSON.stringify(r,null,2)+'\n');fs.writeFileSync(out+'.workflow.json',JSON.stringify(result,null,2)+'\n');return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const [prefix,mode,file]=process.argv.slice(2);if(!prefix)throw Error('Usage: node review-workflow.mjs PREFIX --prepare | --review REVIEW.json');
    if(mode==='--prepare'){const target=path.resolve(prefix)+'.review.json';if(fs.existsSync(target))throw Error('Existing review retained; use a new output prefix or explicitly remove only the stale review after inspection');fs.writeFileSync(target,JSON.stringify(prepareReview(prefix),null,2)+'\n');console.log(target);}
    else if(mode==='--review')console.log(JSON.stringify(finalizeReview(prefix,file),null,2));else throw Error('Choose --prepare or --review');
  }catch(e){console.error(e.message);process.exitCode=1;}
}
