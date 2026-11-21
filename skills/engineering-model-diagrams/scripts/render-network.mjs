#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {renderTypst} from './typst_backend.mjs';
import {themeFor} from './styles.mjs';

function python(explicit){
  const candidates=[explicit,process.env.ENGINEERING_PYTHON,path.resolve(path.dirname(process.execPath),'../../python/python.exe'),'python','python3','py'].filter(Boolean);
  for(const exe of candidates){const args=exe==='py'?['-3']:[];const p=spawnSync(exe,[...args,'-c','import pypdf'],{encoding:'utf8',windowsHide:true});if(p.status===0)return {exe,args};}
  throw Error('PlotNeuralNet compilation needs Python 3 + pypdf. Set ENGINEERING_PYTHON or use neural-netz.');
}

export async function renderNetwork(input,options={}){
  const spec=typeof input==='string'?JSON.parse(fs.readFileSync(input,'utf8')):structuredClone(input);
  if(!Array.isArray(spec.layers))throw Error('A volume diagram needs layers with spatial dimensions and thickness. The old nodes/edges card format belongs to render.mjs; it is not a volume renderer.');
  const out=path.resolve(options.out??'network-volume');
  if(options.widthMm)spec.widthMm=Number(options.widthMm);
  const backend=String(options.backend??spec.backend??spec.renderer??'neural-netz').toLowerCase();
  if(options.theme){const t=themeFor(options.theme),ops={fc:'linear',convres:'convblock',sum:'add',deconv:'conv',unpool:'pool'};spec.fonts=t.fonts;for(const l of spec.layers){const op=l.semanticOp??ops[l.type]??l.type;l.fill=t.colors[op]??t.colors.custom;l.bandfill=l.fill;}}
  if(['neural-netz','typst'].includes(backend))return renderTypst(spec,{out,typst:options.typst,previewSize:options.previewSize});
  if(!['plotneuralnet','plot'].includes(backend))throw Error(`Unknown volume backend: ${backend}`);
  fs.mkdirSync(path.dirname(out),{recursive:true});
  const config=out+'.input.json';fs.writeFileSync(config,JSON.stringify(spec,null,2)+'\n');
  const py=python(options.python),script=path.join(path.dirname(fileURLToPath(import.meta.url)),'plotneuralnet_backend.py');
  const args=[...py.args,script,config,'--out',out];
  if(options.compiler)args.push('--compiler',options.compiler);
  if(options.cacheDir)args.push('--cache-dir',path.resolve(options.cacheDir));
  const p=spawnSync(py.exe,args,{encoding:'utf8',windowsHide:true,maxBuffer:12*1024*1024,timeout:options.timeout??660000});
  if(p.status!==0)throw Error(p.stderr||p.error?.message||p.stdout||'PlotNeuralNet compilation failed');
  return JSON.parse(fs.readFileSync(out+'.backend.json','utf8'));
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),input=args.shift(),options={};
  for(let i=0;i<args.length;i++){
    const map={'--out':'out','--backend':'backend','--theme':'theme','--width-mm':'widthMm','--typst':'typst','--python':'python','--compiler':'compiler','--cache-dir':'cacheDir','--preview-size':'previewSize'};
    if(!map[args[i]]||!args[i+1])throw Error(`Unknown or incomplete option: ${args[i]}`);
    const key=map[args[i]];options[key]=args[++i];
  }
  try{if(!input)throw Error('Usage: node render-network.mjs VOLUME.json --out PREFIX [--backend neural-netz|plotneuralnet]');console.log(JSON.stringify(await renderNetwork(input,options),null,2));}catch(e){console.error(e.message);process.exitCode=1;}
}
