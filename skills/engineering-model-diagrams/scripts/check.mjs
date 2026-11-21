#!/usr/bin/env node
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {validate,checkScene,skillRoot} from './engine.mjs';
import {findPython} from './render.mjs';
const [source,scenePath]=process.argv.slice(2);
if(!source){console.error('Usage: node check.mjs SPEC.json [SCENE.json]');process.exit(1);}
try{
  const spec=JSON.parse(fs.readFileSync(source,'utf8')), result=validate(spec);
  if(scenePath&&!result.errors.length){
    const py=findPython(),p=spawnSync(py.exe,[...py.prefix,path.join(skillRoot,'scripts/export_pdf.py'),'--metrics',source],{encoding:'utf8',windowsHide:true});
    if(p.status!==0)throw Error(p.stderr);
    const metrics=JSON.parse(p.stdout);
    Object.assign(result,checkScene(JSON.parse(fs.readFileSync(scenePath,'utf8')),spec,metrics));
    if(metrics.missing.length)result.errors.push(`Missing glyphs: ${metrics.missing.join(' ')}`);
  }
  result.pass=!result.errors.length;console.log(JSON.stringify(result,null,2));process.exitCode=result.pass?0:1;
}catch(e){console.error(e.message);process.exitCode=1;}
