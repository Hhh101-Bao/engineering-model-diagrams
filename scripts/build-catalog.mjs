import fs from 'node:fs';import path from 'node:path';
import {definitions} from '../skills/engineering-model-diagrams/assets/catalog/definitions.mjs';
import {renderCatalog} from '../skills/engineering-model-diagrams/scripts/render-catalog.mjs';
import {scientificThemeNames,themes} from '../skills/engineering-model-diagrams/scripts/styles.mjs';
const root=path.resolve('.'),dest=path.join(root,'docs/gallery'),manifest=[],errors=[];
fs.mkdirSync(dest,{recursive:true});
const args=process.argv.slice(2),only=args.includes('--only')?args[args.indexOf('--only')+1]:null;
for(const model of definitions.filter(m=>!only||m.id===only)){
  try{const r=await renderCatalog(model,{out:path.join(dest,model.id),theme:'steel-teal'});manifest.push({id:model.id,title:model.title,category:model.category,source:model.source,locator:model.locator,scope:model.scope,figureFamily:r.figureFamily,glyphs:r.glyphs,widthMm:r.widthMm,layers:model.nodes.length,edges:model.edges.length});console.log('OK',model.id);}
  catch(e){errors.push({id:model.id,error:e.message});console.error('FAIL',model.id,e.message);}
}
if(!only){
  for(const theme of scientificThemeNames){try{await renderCatalog(definitions.find(d=>d.id==='residual-basic'),{out:path.join(root,'docs/palettes',theme),theme});console.log('PALETTE',theme);}catch(e){errors.push({id:theme,error:e.message});}}
  fs.writeFileSync(path.join(dest,'catalog.json'),JSON.stringify({schema:'source-model-catalog/1',status:'rendered-awaiting-visual-review',models:manifest,errors},null,2)+'\n');
  const cats=[['cv-backbones','计算机视觉 · 骨干与分类'],['cv-dense','计算机视觉 · 分割与基础模型'],['cv-detection','计算机视觉 · 目标检测'],['remote-segmentation','遥感 · 语义分割'],['remote-change','遥感 · 变化检测'],['vision-language','视觉语言'],['modules-cnn','模块 · 卷积与残差'],['modules-transformer','模块 · Transformer'],['modules-multiscale','模块 · 多尺度融合'],['modules-attention','模块 · 注意力与门控'],['modules-remote','模块 · 遥感特征交互']];
  const lines=['# 分类模型与模块图库','','下图均是依据原论文或作者代码重新绘制的结构示意，不是作者官方出图。优先表达有出处的模块、连接与尺度；省略内容、具体变体和示意比例逐项说明。展示图不代表已运行对应模型训练或验证精度。','','空间特征、token、窗口、门控和矩阵采用不同的语义几何。重复的token、网格和矩阵单元是示意采样，真实数量以维度标注为准。CLIP矩阵对角线表示配对位置，不表示测得的相似度值。','','[返回主页](../README.md) · [五套科研配色](palettes.md)','','渲染任一条目：','','```text','node skills/engineering-model-diagrams/scripts/render-catalog.mjs --model MODEL_ID --theme steel-teal --out output/model','```',''];
  for(const [cat,title]of cats){const group=manifest.filter(m=>m.category===cat);if(!group.length)continue;lines.push('## '+title,'');for(const m of group)lines.push('### '+m.title,'',`ID: \`${m.id}\` · ${m.layers}模块 / ${m.edges}连接 · 成图宽${m.widthMm}mm`,'',`![${m.title}](gallery/${m.id}.png)`,'',`[PDF](gallery/${m.id}.pdf) · [SVG](gallery/${m.id}.svg) · [三维GLB](gallery/${m.id}.glb) · [离线三维](gallery/${m.id}.3d.html) · [结构JSON](gallery/${m.id}.ir.json) · [体积配置](gallery/${m.id}.volume.json)`,'',`依据：[原论文或作者代码](${m.source})，${m.locator}。`,'',`范围：${m.scope}`,'');}
  fs.writeFileSync(path.join(root,'docs/gallery.md'),lines.join('\n')+'\n');
  const pl=['# 五套科研配色','','五套主题采用相同的结构和几何，只改变语义角色配色，便于实际比较。每个主题都可通过自然语言或CLI用于新的论文和模型图。publication为steel-teal的别名。','','```text','node skills/engineering-model-diagrams/scripts/compile-model.mjs MODEL.ir.json --theme sage-earth --out output/model','```',''];
  for(const t of scientificThemeNames)pl.push('## '+themes[t].label,'',`theme: \`${t}\``,'',`![${t}](palettes/${t}.png)`,'',`[PDF](palettes/${t}.pdf) · [SVG](palettes/${t}.svg) · [体积配置](palettes/${t}.volume.json)`,'');
  fs.writeFileSync(path.join(root,'docs/palettes.md'),pl.join('\n')+'\n');
}
if(errors.length){console.error(JSON.stringify(errors));process.exitCode=1;}
