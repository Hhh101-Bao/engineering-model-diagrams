import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {scientificThemeNames,themes} from '../skills/engineering-model-diagrams/scripts/styles.mjs';
const dir=path.resolve('docs/assets');fs.mkdirSync(dir,{recursive:true});
const titles={'steel-teal':'STEEL + TEAL','ocean-sand':'OCEAN + SAND','sage-earth':'SAGE + EARTH','plum-slate':'PLUM + SLATE','graphite-amber':'GRAPHITE + AMBER'};
const roles=[['conv','Backbone'],['pool','Downsample'],['concat','Fusion'],['attention','Attention'],['output','Output']];
const cards=scientificThemeNames.map(id=>`[#text(size:10pt,weight:"bold")[${titles[id]}] #v(1mm) #text(size:8pt,fill:rgb("#627486"))[${id}] #v(4mm) ${roles.map(([key,label])=>`#rect(width:100%,height:7mm,radius:1mm,fill:rgb("${themes[id].colors[key]}"),stroke:none) #v(0.4mm) #text(size:7.5pt, ${JSON.stringify(label+' · '+themes[id].colors[key])}) #v(2.5mm)`).join('\n')}]`);
const source=`#set page(width:285mm,height:auto,margin:12mm,fill:rgb("#F5F7FA"))
#set text(font:("Arial","Liberation Sans"),fill:rgb("#24384B"))
#text(size:22pt,weight:"bold")[Five scientific palettes]
#v(2mm)
#text(size:10pt,fill:rgb("#627486"))[Consistent semantic roles. Low saturation. Flexible selection.]
#v(7mm)
#grid(columns:(1fr,1fr,1fr,1fr,1fr),gutter:5mm,${cards.join(',\n')})
`;
fs.writeFileSync(path.join(dir,'scientific-palettes.typ'),source);
const bundled=path.resolve('skills/engineering-model-diagrams/scripts/vendor/typst/typst.exe'),exe=process.env.ENGINEERING_TYPST??(fs.existsSync(bundled)?bundled:'typst');
const run=(e,a)=>{const r=spawnSync(e,a,{encoding:'utf8',windowsHide:true});if(r.status!==0)throw Error(r.stderr||r.error?.message);};
for(const ext of ['pdf','svg'])run(exe,['compile',path.join(dir,'scientific-palettes.typ'),path.join(dir,'scientific-palettes.'+ext)]);
run('pdftoppm',['-singlefile','-scale-to','2400','-png',path.join(dir,'scientific-palettes.pdf'),path.join(dir,'scientific-palettes')]);
