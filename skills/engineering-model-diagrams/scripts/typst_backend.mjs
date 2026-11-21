#!/usr/bin/env node
/** neural-netz 0.3.0 + local placement extension. Generates real vector feature volumes. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const folder=path.dirname(fileURLToPath(import.meta.url));
const vendor=path.join(folder,'vendor/neural-netz');
const typstTypes=new Set(['input','conv','convres','pool','unpool','deconv','concat','gap','fc','sum','convsoftmax','softmax','output','custom']);
const anchors=new Set(['west','west_upper','west_lower','east','true_west','true_east','north','south','anchor','near','northeast','southeast','northwest','southwest']);
const run=(exe,args)=>{const p=spawnSync(exe,args,{encoding:'utf8',windowsHide:true,maxBuffer:10*1024*1024});if(p.status!==0)throw Error(p.stderr||p.error?.message||`Exit code ${p.status}`);return p.stdout;};
function findTypst(explicit){
  const candidates=[explicit,process.env.ENGINEERING_TYPST,'typst',path.join(folder,'vendor/typst/typst.exe'),path.resolve('tmp/tools/typst/typst.exe')].filter(Boolean);
  for(const exe of candidates){const p=spawnSync(exe,['--version'],{encoding:'utf8',windowsHide:true});if(p.status===0)return {exe,version:p.stdout.trim()};}
  throw Error('Typst >=0.14 required. Set ENGINEERING_TYPST, put typst on PATH, or provide --typst EXE.');
}
function typ(value,key=''){
  if(value===null)return 'none';
  if(typeof value==='boolean'||typeof value==='number')return String(value);
  if(typeof value==='string')return ['fill','bandfill'].includes(key)&&/^#[0-9a-f]{6}$/i.test(value)?`rgb(${JSON.stringify(value)})`:JSON.stringify(value);
  if(Array.isArray(value)){
    if(key==='label')return '['+value.map((s,i)=>`#text(weight: ${JSON.stringify(i?'regular':'bold')}, ${JSON.stringify(String(s))})`).join('#linebreak()')+']';
    return '('+value.map(v=>typ(v)).join(', ')+(value.length===1?',':'')+')';
  }
  return '('+Object.entries(value).map(([k,v])=>`${JSON.stringify(k)}: ${typ(v,k)}`).join(', ')+')';
}
export function validateTypstSpec(spec){
  if(!Array.isArray(spec.layers)||!spec.layers.length)throw Error('layers must contain feature-volume definitions');
  const names=new Set();
  for(const layer of spec.layers){
    if(!typstTypes.has(layer.type))throw Error(`Unsupported neural-netz layer type: ${layer.type}`);
    if(!layer.name||names.has(layer.name))throw Error(`Missing or duplicate layer name: ${layer.name}`);names.add(layer.name);
    if(layer.at&&(!Array.isArray(layer.at)||layer.at.length!==2||!layer.at.every(Number.isFinite)))throw Error(`Invalid at coordinate: ${layer.name}`);
    for(const key of ['height','depth','width'])if(layer[key]!==undefined&&(!Number.isFinite(layer[key])||layer[key]<0))throw Error(`Invalid ${key}: ${layer.name}`);
    if(layer.widths&&(!Array.isArray(layer.widths)||!layer.widths.length||layer.widths.some(x=>!Number.isFinite(x)||x<=0)))throw Error(`Invalid widths: ${layer.name}`);
    if(layer.sliceGap!==undefined&&(!Number.isFinite(layer.sliceGap)||layer.sliceGap<0||!['conv','convres'].includes(layer.type)))throw Error(`sliceGap requires a nonnegative conv separation: ${layer.name}`);
    if(layer.tensor&&(!Array.isArray(layer.tensor)||!layer.tensor.length||layer.tensor.some(x=>x!==null&&(!Number.isInteger(x)||x<=0))))throw Error(`Invalid tensor: ${layer.name}`);
    if(layer.image&&layer.image!=='default')throw Error('This adapter accepts the bundled default image only; edit the emitted .typ to use your own image asset.');
  }
  for(const connection of spec.connections??[]){
    if(!names.has(connection.from)||!names.has(connection.to))throw Error(`Unknown connection endpoint: ${connection.from} -> ${connection.to}`);
    if(!['direct','skip'].includes(connection.type??'skip'))throw Error(`Unsupported connection type: ${connection.type}`);
    for(const side of [connection.fromPort,connection.toPort,connection['from-port'],connection['to-port']].filter(Boolean))if(!anchors.has(side))throw Error(`Unknown volume anchor: ${side}`);
    if(connection.via&&(!Array.isArray(connection.via)||connection.via.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite))))throw Error('via requires [x,y] waypoints');
    for(const key of ['laneX','laneY','lane-x','lane-y'])if(connection[key]!==undefined&&!Number.isFinite(connection[key]))throw Error(`Invalid ${key}`);
    for(const key of ['fromPoint','toPoint'])if(connection[key]&&(!Array.isArray(connection[key])||connection[key].length!==2||!connection[key].every(Number.isFinite)))throw Error(`Invalid ${key}`);
    if(connection.route&&!['orthogonal'].includes(connection.route))throw Error('route must be orthogonal');
    if((connection.laneX!==undefined||connection['lane-x']!==undefined)&&(connection.laneY!==undefined||connection['lane-y']!==undefined))throw Error('Choose laneX or laneY, not both');
    if(connection.via&&(connection.laneX!==undefined||connection.laneY!==undefined||connection['lane-x']!==undefined||connection['lane-y']!==undefined))throw Error('Choose via or an automatic lane, not both');
  }
  for(const layer of spec.layers.filter(l=>['sum','concat'].includes(l.type))){
    const incoming=(spec.connections??[]).filter(c=>c.to===layer.name).map(c=>spec.layers.find(l=>l.name===c.from));
    if(layer.at&&incoming.length<2)throw Error(`${layer.type} requires at least two explicit inputs: ${layer.name}`);
    const shapes=incoming.map(l=>l.tensor);
    if(shapes.length>=2&&shapes.every(s=>s&&s.every(Number.isInteger))){
      const expected=[...shapes[0]];
      if(layer.type==='concat'){
        const axis=layer.axis??0;
        if(!Number.isInteger(axis)||axis<0||axis>=expected.length)throw Error(`Invalid concat axis: ${layer.name}`);
        if(shapes.some(s=>s.length!==expected.length||s.some((v,i)=>i!==axis&&v!==expected[i])))throw Error(`Concat dimensions differ: ${layer.name}`);
        expected[axis]=shapes.reduce((sum,s)=>sum+s[axis],0);
      }else if(layer.semanticOp==='multiply'&&layer.broadcast){
        const rank=Math.max(...shapes.map(s=>s.length)),dims=[];
        for(let i=0;i<rank;i++){const values=[...new Set(shapes.map(s=>s[s.length-rank+i]??1).filter(x=>x!==1))];if(values.length>1)throw Error(`Multiply dimensions differ: ${layer.name}`);dims.push(values[0]??1);}expected.splice(0,expected.length,...dims);
      }else if(shapes.some(s=>JSON.stringify(s)!==JSON.stringify(expected)))throw Error(`Sum input dimensions differ: ${layer.name}`);
      if(layer.tensor&&layer.tensor.every(Number.isInteger)&&JSON.stringify(layer.tensor)!==JSON.stringify(expected))throw Error(`Output tensor differs: ${layer.name}`);
    }
  }
  if(!Number.isFinite(spec.widthMm??200)||(spec.widthMm??200)<80)throw Error('widthMm must be >= 80');
  if(!Number.isFinite(spec.minFontPt??8)||(spec.minFontPt??8)<5)throw Error('minFontPt must be >= 5');
}
function source(spec,assetName,scale,fontScale){
  const layers=spec.layers.map(l=>{
    const n={...l,...(l.at?{'show-connection':false}:{})};
    if(l.labelAt){n['label-at']=l.labelAt;delete n.labelAt;}
    if(l.sliceGap!==undefined){n['slice-gap']=l.sliceGap;delete n.sliceGap;}
    if(!['conv','convres','custom','input'].includes(l.type)&&l.widths&&!l.width)n.width=l.widths.reduce((a,b)=>a+b,0);
    if(l.tensor&&!l.channels){
      if(['conv','convres','custom'].includes(l.type)&&l.widths){
        n.channels=[...l.widths.map(()=>l.tensor[0]),l.tensor[1]===l.tensor[2]?l.tensor[1]:`${l.tensor[1]}×${l.tensor[2]}`];
      }else n.channels=[l.tensor.map(x=>x??'?').join('×')];
    }
    return n;
  });
  const connections=(spec.connections??[]).map(c=>{
    const n={...c};for(const [camel,kebab] of [['fromPort','from-port'],['toPort','to-port'],['labelAt','label-at'],['laneX','lane-x'],['laneY','lane-y'],['fromPoint','from-point'],['toPoint','to-point']])if(c[camel]!==undefined){n[kebab]=c[camel];delete n[camel];}return n;
  });
  return `// Compile with: typst compile --package-path ${assetName}/packages THIS_FILE.typ\n`+
    `// Geometry: neural-netz 0.3.0; at/direct/font-scale are documented local extensions.\n`+
    `#import ${JSON.stringify(assetName+'/src/placed.typ')}: draw-network\n`+
    `#set document(title: ${JSON.stringify(spec.title??'Neural network architecture')})\n`+
    `#set page(width: auto, height: auto, margin: 4mm)\n`+
    `#set text(font: (${(spec.fonts??['New Computer Modern','Microsoft YaHei']).map(x=>JSON.stringify(x)).join(', ')}), size: 8pt)\n`+
    `#draw-network(${typ(layers)}, connections: ${typ(connections)}, palette: ${JSON.stringify(spec.palette??'cold')}, show-legend: ${spec.showLegend??false}, legend-title: ${JSON.stringify(spec.legendTitle??'Layers')}, scale: ${scale*100}%, font-scale: ${fontScale}, stroke-thickness: ${spec.strokeThickness??0.85}, depth-multiplier: ${spec.depthMultiplier??0.22}, show-relu: ${spec.showRelu??true})\n`;
}
export async function renderTypst(input,options={}){
  const spec=typeof input==='string'?JSON.parse(fs.readFileSync(input,'utf8')):structuredClone(input);
  validateTypstSpec(spec);
  const tool=findTypst(options.typst), out=path.resolve(options.out??'network-volume');
  fs.mkdirSync(path.dirname(out),{recursive:true});
  const assets=out+'.assets';fs.cpSync(vendor,assets,{recursive:true});
  const sourcePath=out+'.typ',assetName=path.basename(assets),cache=path.join(assets,'.cache');
  const args=['compile','--root',path.dirname(out),'--package-path',path.join(assets,'packages'),'--package-cache-path',cache];
  const width=spec.widthMm??200,minFont=spec.minFontPt??8;
  let scale=spec.geometryScale??0.65, measured=0,passes=0,svg;
  for(;passes<5;passes++){
    const fontScale=minFont/(7*scale);
    fs.writeFileSync(sourcePath,source(spec,assetName,scale,fontScale),'utf8');
    run(tool.exe,[...args,sourcePath,out+'.svg']);
    svg=fs.readFileSync(out+'.svg','utf8');
    const viewBox=svg.match(/viewBox="([^"]+)"/)?.[1].split(/\s+/).map(Number);
    if(!viewBox)throw Error('Cannot read the exported SVG physical size');
    measured=viewBox[2]*25.4/72;
    if(Math.abs(measured-width)<0.25)break;
    scale*=(width-8)/(measured-8);
  }
  if(Math.abs(measured-width)>0.5)throw Error(`Could not fit ${width}mm without shrinking typography; produced ${measured.toFixed(2)}mm. Reduce label length or split the figure.`);
  run(tool.exe,[...args,sourcePath,out+'.pdf']);
  const png=spawnSync(process.env.ENGINEERING_PDFTOPPM??'pdftoppm',['-singlefile','-scale-to',String(options.previewSize??2400),'-png',out+'.pdf',out],{encoding:'utf8',windowsHide:true});
  if(png.status!==0)throw Error(png.stderr||'pdftoppm required for PNG preview');
  fs.writeFileSync(out+'.source.json',JSON.stringify(spec,null,2)+'\n');
  const provenance=JSON.parse(fs.readFileSync(path.join(vendor,'provenance.json'),'utf8'));
  const report={backend:'neural-netz',typstVersion:tool.version,upstream:provenance['neural-netz'],widthMm:+measured.toFixed(3),targetWidthMm:width,minDeclaredFontPt:minFont,geometryScale:scale,passes:passes+1,layers:spec.layers.length,explicitConnections:spec.connections?.length??0,editableSource:sourcePath,portableDependencies:assets,files:['typ','source.json','svg','pdf','png'].map(ext=>out+'.'+ext),limitations:['Named at/direct/font-scale parameters are local extensions, original source is retained as lib.typ.','Paper-space collision checks require inspecting the PNG; no claim of automatic collision-free placement.','SVG uses vector glyph outlines; edit the .typ or source.json for text changes.']};
  fs.writeFileSync(out+'.compile.json',JSON.stringify(report,null,2)+'\n');
  return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),input=args.shift(),opts={};
  for(let i=0;i<args.length;i++){if(args[i]==='--out')opts.out=args[++i];else if(args[i]==='--typst')opts.typst=args[++i];else if(args[i]==='--preview-size')opts.previewSize=Number(args[++i]);else throw Error(`Unknown option ${args[i]}`);}
  try{if(!input)throw Error('Usage: node typst_backend.mjs INPUT.json --out PREFIX [--typst EXE]');console.log(JSON.stringify(await renderTypst(input,opts),null,2));}catch(error){console.error(error.message);process.exitCode=1;}
}
