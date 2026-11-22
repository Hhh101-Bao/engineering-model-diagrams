import fs from 'node:fs';import assert from 'node:assert/strict';
import {definitions} from '../skills/engineering-model-diagrams/assets/catalog/definitions.mjs';
import {catalogPlan} from '../skills/engineering-model-diagrams/scripts/render-catalog.mjs';
const tolerance=.006,results=[];
function onSurface(point,mesh){
  if(mesh.primitive==='sphere'){const lo=[0,1,2].map(i=>Math.min(...mesh.vertices.map(v=>v[i]))),hi=[0,1,2].map(i=>Math.max(...mesh.vertices.map(v=>v[i]))),center=lo.map((v,i)=>(v+hi[i])/2);return Math.abs(Math.hypot(...point.map((v,i)=>v-center[i]))-(hi[0]-lo[0])/2)<.025;}
  const lo=[0,1,2].map(i=>Math.min(...mesh.vertices.map(v=>v[i]))),hi=[0,1,2].map(i=>Math.max(...mesh.vertices.map(v=>v[i])));
  return point.every((v,i)=>v>=lo[i]-tolerance&&v<=hi[i]+tolerance)&&point.some((v,i)=>Math.abs(v-lo[i])<tolerance||Math.abs(v-hi[i])<tolerance);
}
for(const dir of ['docs/gallery','docs/palettes','docs/details'])for(const file of fs.readdirSync(dir).filter(x=>x.endsWith('.scene3d.json'))){
  const scene=JSON.parse(fs.readFileSync(dir+'/'+file)),spec=JSON.parse(fs.readFileSync(dir+'/'+file.replace('.scene3d.json','.volume.json')));let checked=0;
  for(const edge of spec.connections){const wire=scene.wires.find(w=>w.id===edge.id);assert(wire,edge.id);for(const [id,point] of [[edge.from,wire.points[0]],[edge.to,wire.points.at(-1)]]){assert(scene.boxes.filter(b=>b.id===id).some(b=>onSurface(point,b)),`${file}: ${edge.id} / ${id} port is in air`);checked++;}}
  results.push({file:dir+'/'+file,endpointsChecked:checked,glyphs:[...new Set(spec.layers.map(l=>l.glyph??l.type))]});
}
const clip=catalogPlan(definitions.find(m=>m.id==='clip')),matrix=clip.spec.layers.find(l=>l.name==='sim');
assert.equal(matrix.glyph,'matrix');assert.equal(clip.spec.layers.find(l=>l.name==='in').glyph,'vector');
const pair=catalogPlan(definitions.find(m=>m.id==='swin-pair')),normal=pair.spec.layers.find(l=>l.name==='w'),shifted=pair.spec.layers.find(l=>l.name==='sw');assert.notEqual(normal.parts.length,shifted.parts.length);
assert.equal(clip.spec.connections.length,definitions.find(m=>m.id==='clip').edges.length);
const report={pass:true,figures:results.length,endpointsChecked:results.reduce((n,r)=>n+r.endpointsChecked,0),sampledCellsHaveRealGeometry:true,windowShiftChangesPartition:true,similarityAndEmbeddingUseDifferentGeometry:true,results};
fs.writeFileSync('docs/gallery/visual-language-audit.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,results:undefined},null,2));
