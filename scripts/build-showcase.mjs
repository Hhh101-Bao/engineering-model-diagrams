/** Reproducible homepage figures, rendered by the actual volume backend. */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {renderTypst} from '../skills/engineering-model-diagrams/scripts/typst_backend.mjs';
import {themes} from '../skills/engineering-model-diagrams/scripts/styles.mjs';
const root=path.resolve('.'),dir=path.join(root,'docs/assets'),examples=path.join(root,'examples/showcase');
fs.mkdirSync(dir,{recursive:true});fs.mkdirSync(examples,{recursive:true});
const palette={encoder:'#8FAAC4',encoderBand:'#6688A7',decoder:'#83B4AF',decoderBand:'#5A938F',bridge:'#B3A4C5',bridgeBand:'#9382AA',fusion:'#D8BC80',input:'#CBD3DC',output:'#91B6A1'};
const common={backend:'neural-netz',widthMm:280,minFontPt:8.3,fonts:themes.publication.fonts,palette:'cold',showRelu:true,showLegend:false,depthMultiplier:.23,strokeThickness:.8};
const unet=JSON.parse(fs.readFileSync('skills/engineering-model-diagrams/assets/examples/unet-neural-netz.json','utf8'));
Object.assign(unet,common,{title:'Multi-scale encoder-decoder | schematic'});
const names={image:['Input','3 × 256 × 256'],enc1:['Encoder 1','32 × 256 × 256'],enc2:['Encoder 2','64 × 128 × 128'],enc3:['Encoder 3','128 × 64 × 64'],bridge:['Bottleneck','256 × 32 × 32'],dec3:['Decoder 3','128 × 64 × 64'],dec2:['Decoder 2','64 × 128 × 128'],dec1:['Decoder 1','32 × 256 × 256'],mask:['Prediction','1 × 256 × 256']};
for(const l of unet.layers){l.label=names[l.name];l.fill=l.name.startsWith('enc')?palette.encoder:l.name.startsWith('dec')?palette.decoder:l.name==='bridge'?palette.bridge:l.name==='mask'?palette.output:palette.input;l.bandfill=l.name.startsWith('enc')?palette.encoderBand:l.name.startsWith('dec')?palette.decoderBand:palette.bridgeBand;l['show-relu']=false;l.at[0]*=1.5;l.labelAt[0]*=1.5;if(l.type==='conv')l.sliceGap=l.depth*common.depthMultiplier+.55;}
for(const c of unet.connections){if(c.labelAt)c.labelAt[0]*=1.5;if(c.label==='Skip + Concat'){c.label='skip + concatenate';c.opacity=.55;}}
const fusion=JSON.parse(fs.readFileSync('skills/engineering-model-diagrams/assets/examples/dual-stream-neural-netz.json','utf8'));
Object.assign(fusion,common,{title:'Dual-stream feature fusion | schematic',widthMm:280});
const fn={rgb:'RGB input',depth:'Depth input',rgb_enc:'Visual encoder',depth_enc:'Depth encoder',concat:'Concatenate',projection:'1 × 1 projection',attention:'Attention',sum:'Residual add',fused:'Fused features'};
for(const l of fusion.layers){l.label=fn[l.name];l.fill=['rgb','depth'].includes(l.name)?palette.input:l.name.endsWith('_enc')||l.name==='projection'?palette.encoder:l.name==='concat'?palette.fusion:l.name==='attention'?palette.bridge:palette.output;l.bandfill=palette.encoderBand;l['show-relu']=false;if(l.type==='conv'&&l.widths.length>1)l.sliceGap=l.depth*common.depthMultiplier+.55;}
const cnn=JSON.parse(fs.readFileSync('skills/engineering-model-diagrams/assets/examples/cnn-neural-netz.json','utf8'));
Object.assign(cnn,common,{title:'Hierarchical convolutional encoder | schematic',widthMm:280,showLegend:false});
let stage=0,cx=0;for(const l of cnn.layers){l.fill=l.type==='conv'?palette.encoder:['pool','gap'].includes(l.type)?palette.fusion:l.type==='fc'?palette.bridge:palette.input;l.bandfill=palette.encoderBand;l['show-relu']=false;if(l.type==='conv')l.label='Conv stage '+(++stage);else if(l.type==='pool')l.label='Max pool';else if(l.type==='gap')l.label='GAP';else if(l.type==='fc')l.label='Classifier';else l.label='Input';if(l.type==='conv')l.sliceGap=l.depth*common.depthMultiplier+.55;const w=l.widths.reduce((a,b)=>a+b,0)+(l.sliceGap??0)*(l.widths.length-1);l.at=[cx,0];l.labelAt=[cx+(w+l.depth*common.depthMultiplier)/2,-(l.height+l.depth*common.depthMultiplier)/2-1.6];l.label=[l.label,l.tensor.join(' × ')];l.channels=Array(l.widths.length+1).fill('');l['show-connection']=false;cx+=Math.max(w+l.depth*common.depthMultiplier+2.0,5.2);}
cnn.connections=cnn.layers.slice(1).map((l,i)=>({from:cnn.layers[i].name,to:l.name,type:'direct',fromPort:'east',toPort:'west'}));
const cases=[['encoder-decoder',unet],['dual-stream',fusion],['convolutional-encoder',cnn]];
for(const [name,spec] of cases){fs.writeFileSync(path.join(examples,name+'.volume.json'),JSON.stringify(spec,null,2)+'\n');await renderTypst(spec,{out:path.join(dir,name),previewSize:2800});}
// A technical figure with a caption; no product-poster framing or decorative cards.
fs.copyFileSync(path.join(root,'docs/gallery/clip.svg'),path.join(dir,'hero-architecture.svg'));
const poster=`#set page(width: 240mm, height: auto, margin: 5mm)
#set text(font: ("Arial", "Liberation Sans"), size: 9pt, fill: rgb("#263039"))
#text[CLIP — contrastive pretraining]
#v(3mm)
#image("hero-architecture.svg", width: 100%)
#v(2mm)
#text(size: 8pt)[Rows: image embeddings. Columns: text embeddings. The diagonal marks paired examples; cells are schematic, not measured scores.]
`;
fs.writeFileSync(path.join(dir,'hero.typ'),poster);
const bundled=path.join(root,'skills/engineering-model-diagrams/scripts/vendor/typst/typst.exe');
const exe=process.env.ENGINEERING_TYPST??(fs.existsSync(bundled)?bundled:'typst');
const run=(exe,args)=>{const r=spawnSync(exe,args,{encoding:'utf8',windowsHide:true});if(r.status!==0)throw Error(r.stderr||r.error?.message);};
for(const ext of ['pdf','svg'])run(exe,['compile','--root',dir,path.join(dir,'hero.typ'),path.join(dir,'hero.'+ext)]);
run('pdftoppm',['-singlefile','-scale-to','2600','-png',path.join(dir,'hero.pdf'),path.join(dir,'hero')]);
console.log(JSON.stringify({figures:cases.map(c=>c[0]),hero:path.join(dir,'hero.png')}));
