/** Rebuild the reviewed Swin mechanism panels from editable volume sources. */
import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {renderTypst} from '../skills/engineering-model-diagrams/scripts/typst_backend.mjs';
import {exportScene3D} from '../skills/engineering-model-diagrams/scripts/export-scene3d.mjs';
const dir=path.resolve('docs/details');
for(const name of ['regular-block-final','shifted-block-final']){const out=path.join(dir,name),spec=JSON.parse(fs.readFileSync(out+'.volume.json')),ir=JSON.parse(fs.readFileSync(out+'.ir.json'));exportScene3D({ir,spec},out);await renderTypst(spec,{out,previewSize:2400});}
const bundled=path.resolve('skills/engineering-model-diagrams/scripts/vendor/typst/typst.exe'),exe=process.env.ENGINEERING_TYPST??(fs.existsSync(bundled)?bundled:'typst');
const run=(e,a)=>{const r=spawnSync(e,a,{encoding:'utf8',windowsHide:true});if(r.status!==0)throw Error(r.stderr||r.error?.message);};
for(const ext of ['pdf','svg'])run(exe,['compile','--root',dir,path.join(dir,'swin-blocks-final.typ'),path.join(dir,'swin-blocks-final.'+ext)]);
run('pdftoppm',['-singlefile','-scale-to','2400','-png',path.join(dir,'swin-blocks-final.pdf'),path.join(dir,'swin-blocks-final')]);
console.log('Rebuilt Swin detail panels');
