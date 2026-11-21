import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {planVolumes,compileModel} from '../skills/engineering-model-diagrams/scripts/compile-model.mjs';
import {validateTypstSpec} from '../skills/engineering-model-diagrams/scripts/typst_backend.mjs';
import {checkMesh3D} from '../skills/engineering-model-diagrams/scripts/review-workflow.mjs';
import {definitions} from '../skills/engineering-model-diagrams/assets/catalog/definitions.mjs';
import {catalogPlan} from '../skills/engineering-model-diagrams/scripts/render-catalog.mjs';
import {scientificThemeNames,themeFor} from '../skills/engineering-model-diagrams/scripts/styles.mjs';
const testSource={schema:'paper-model/1',title:'Synthetic geometry regression fixture',sources:[{id:'fixture',uri:'fixture://geometry-test'}],evidence:[{id:'f',source:'fixture',locator:'Inline test definition',statement:'Synthetic test graph, not a published architecture.',status:'stated'}],uncertainties:[],render:{mode:'volume',widthMm:180,minFontPt:8,direction:'DOWN'}};
const node=(id,op,shape,extra={})=>({id,op,label:id,shape,shapeStatus:'stated',evidence:['f'],...extra}),edge=(from,to)=>({id:from+'_'+to,from,to,evidence:['f']});
const separated={...structuredClone(testSource),nodes:[node('input','input',[64,128,128]),node('block','convblock',[64,128,128],{repeat:2}),node('output','output',[64,128,128])],edges:[edge('input','block'),edge('block','output')]};
const planned=await planVolumes(separated),block=planned.spec.layers.find(n=>n.name==='block');assert.ok(block.sliceGap>block.depth*planned.spec.depthMultiplier+.5);
function onSurface(l,p){let x=l.at[0],y=l.at[1]-l.height/2-l.depth*planned.spec.depthMultiplier/2,offset=l.depth*planned.spec.depthMultiplier;
  for(const w of l.widths){const poly=[[x,y],[x+w,y],[x+w+offset,y+offset],[x+w+offset,y+l.height+offset],[x+offset,y+l.height+offset],[x,y+l.height]];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],dx=b[0]-a[0],dy=b[1]-a[1],u=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy);if(u>=-.001&&u<=1.001&&Math.abs((p[0]-a[0])*dy-(p[1]-a[1])*dx)<.005)return true;}x+=w+(l.sliceGap??0);}return false;}
for(const c of planned.spec.connections){assert.ok(onSurface(planned.spec.layers.find(n=>n.name===c.from),c.fromPoint),'Source lies in air');assert.ok(onSurface(planned.spec.layers.find(n=>n.name===c.to),c.toPoint),'Target lies in air');}
const concat={...structuredClone(testSource),render:{...testSource.render,direction:'RIGHT',widthMm:200},nodes:[node('a','input',[64,16,16]),node('b','input',[64,16,16]),node('stack','concat',[64,16,32],{params:{axis:2}})],edges:[edge('a','stack'),edge('b','stack')]};
const cp=await planVolumes(concat);assert.equal(cp.spec.layers.find(n=>n.name==='stack').axis,2);validateTypstSpec(cp.spec);
const fixture=path.resolve('tmp/v04-regression');fs.mkdirSync(fixture,{recursive:true});await compileModel(separated,{out:path.join(fixture,'separated-down')});await compileModel(concat,{out:path.join(fixture,'width-concat')});
const sample=definitions.find(m=>m.id==='residual-basic'),plans=scientificThemeNames.map(theme=>catalogPlan(sample,{theme}));
assert.equal(scientificThemeNames.length,5);assert.equal(new Set(scientificThemeNames.map(id=>themeFor(id).colors.conv)).size,5);
for(const p of plans.slice(1)){assert.deepEqual(p.spec.connections,plans[0].spec.connections);assert.deepEqual(p.spec.layers.map(({fill,...l})=>l),plans[0].spec.layers.map(({fill,...l})=>l));}
assert.throws(()=>themeFor('unknown-palette'));
const meshes=[];for(const directory of ['docs/gallery','docs/palettes'])for(const file of fs.readdirSync(directory).filter(f=>f.endsWith('.glb'))){const result=checkMesh3D(path.join(directory,file));assert.ok(result.pass,file);meshes.push({file:directory+'/'+file,...result});}
const report={pass:true,separatedRepeatDepthAndGap:true,downPortsTouchActualFirstAndLastSolids:true,widthAxisConcatPreservedAndCompiled:true,fiveThemesPreserveGeometry:true,meshes};
fs.writeFileSync('docs/gallery/runtime-audit.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,meshes:meshes.length},null,2));
