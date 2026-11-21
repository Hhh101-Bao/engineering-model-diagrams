#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {validate,layout,makeScene,toSVG,toDrawio,checkScene,skillRoot} from './engine.mjs';

export function findPython(explicit){
  const candidates=[explicit,process.env.ENGINEERING_PYTHON,path.resolve(path.dirname(process.execPath),'../../python/python.exe'),'python','python3','py'].filter(Boolean);
  for(const exe of candidates){const prefix=exe==='py'?['-3']:[];const p=spawnSync(exe,[...prefix,'-c','import reportlab; print("ok")'],{encoding:'utf8',windowsHide:true});if(p.status===0)return {exe,prefix};}
  throw Error('Python 3 + reportlab required. Set ENGINEERING_PYTHON or install: python -m pip install reportlab');
}
function pythonRun(py,args){const p=spawnSync(py.exe,[...py.prefix,...args],{encoding:'utf8',windowsHide:true,maxBuffer:10*1024*1024});if(p.status!==0)throw Error(p.stderr||p.error?.message||'Python export failed');return p.stdout.trim();}
export function selectView(original,view){
  if(!view)return structuredClone(original);
  const owner=original.nodes.find(n=>n.id===view);
  if(!owner?.module)throw Error(`No stored module definition for ${view}; add its real internal structure before expanding.`);
  return {version:1,widthMm:original.widthMm,theme:original.theme,minFontPt:original.minFontPt,...structuredClone(owner.module),viewOf:view};
}
export async function render(input,options={}){
  const original=JSON.parse(fs.readFileSync(input,'utf8'));
  const spec=selectView(original,options.view);
  if(options.theme)spec.theme=options.theme;
  if(options.widthMm)spec.widthMm=Number(options.widthMm);
  const validation=validate(spec);
  if(validation.errors.length)throw Error(validation.errors.join('\n'));
  const output=path.resolve(options.out??path.join(path.dirname(input),path.basename(input,'.json')));
  fs.mkdirSync(path.dirname(output),{recursive:true});
  const sourcePath=output+'.source.json';
  fs.writeFileSync(sourcePath,JSON.stringify(spec,null,2)+'\n');
  const py=findPython(options.python);
  const helper=path.join(skillRoot,'scripts/export_pdf.py');
  const metrics=JSON.parse(pythonRun(py,[helper,'--metrics',sourcePath]));
  if(metrics.missing.length)throw Error(`Missing font glyphs: ${metrics.missing.join(' ')}; configure ENGINEERING_FONT_* variables.`);
  const previous=options.reuseLayout?JSON.parse(fs.readFileSync(options.reuseLayout,'utf8')):undefined;
  const laid=await layout(spec,metrics,previous);
  const scene=makeScene(spec,laid,metrics);
  const check=checkScene(scene,spec,metrics);check.warnings.push(...validation.warnings);
  fs.writeFileSync(output+'.layout.json',JSON.stringify(laid,null,2)+'\n');
  fs.writeFileSync(output+'.scene.json',JSON.stringify(scene,null,2)+'\n');
  fs.writeFileSync(output+'.check.json',JSON.stringify(check,null,2)+'\n');
  if(!check.pass&&!options.allowIssues)throw Error(`Quality check failed (diagnostics saved to ${output}.check.json):\n${check.errors.join('\n')}`);
  fs.writeFileSync(output+'.svg',toSVG(scene));
  fs.writeFileSync(output+'.drawio',toDrawio(scene,spec));
  pythonRun(py,[helper,output+'.scene.json',output+'.pdf']);
  if(options.png!==false){
    const bundled=path.resolve(path.dirname(process.execPath),'../../native/poppler/bin/pdftoppm.exe');
    const candidates=[process.env.ENGINEERING_PDFTOPPM,'pdftoppm',bundled].filter(Boolean);
    let result;
    for(const exe of candidates){result=spawnSync(exe,['-singlefile','-scale-to',String(options.previewSize??1800),'-png',output+'.pdf',output],{encoding:'utf8',windowsHide:true});if(result.status===0)break;}
    if(result?.status!==0)throw Error('PDF/SVG created, but PNG preview needs pdftoppm (Poppler). Set ENGINEERING_PDFTOPPM or use --no-png.');
  }
  return {output,...check};
}
const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
  const args=process.argv.slice(2),input=args.shift(),options={};
  for(let i=0;i<args.length;i++){
    const a=args[i];
    if(a==='--no-png')options.png=false;
    else if(a==='--allow-issues')options.allowIssues=true;
    else if(['--out','--theme','--width-mm','--python','--reuse-layout','--view','--preview-size'].includes(a)){
      const key={'--width-mm':'widthMm','--reuse-layout':'reuseLayout','--preview-size':'previewSize'}[a]??a.slice(2);
      if(!args[i+1]||args[i+1].startsWith('--'))throw Error(`Missing value for ${a}`);options[key]=args[++i];
    }else throw Error(`Unknown option: ${a}`);
  }
  if(!input){console.error('Usage: node render.mjs SPEC.json --out PREFIX [--view NODE_ID] [--theme paper|mono|upstream] [--reuse-layout FILE]');process.exitCode=1;}
  else try{console.log(JSON.stringify(await render(path.resolve(input),options),null,2));}catch(e){console.error(e.message);process.exitCode=1;}
}
