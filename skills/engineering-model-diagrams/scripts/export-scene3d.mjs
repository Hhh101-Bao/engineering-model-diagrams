import fs from 'node:fs';
const boxVertices=()=>[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
const triangles=[0,2,1,0,3,2,4,5,6,4,6,7,0,4,7,0,7,3,1,2,6,1,6,5,0,1,5,0,5,4,3,7,6,3,6,2];
function sphere(cx,cy,r){const vertices=[],indices=[],rows=12,cols=20;for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++){const a=Math.PI*i/rows,b=2*Math.PI*j/cols;vertices.push([cx+r*Math.sin(a)*Math.cos(b),cy+r*Math.cos(a),r*Math.sin(a)*Math.sin(b)]);}for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){const a=i*(cols+1)+j,b=a+cols+1;indices.push(a,b,a+1,a+1,b,b+1);}return {vertices,indices};}
const rgb=hex=>hex.slice(1).match(/../g).map(s=>parseInt(s,16)/255);
function cone(points){
  const pairs=points.slice(1).map((p,i)=>({a:points[i],b:p,length:Math.hypot(...p.map((v,k)=>v-points[i][k]))})),s=pairs.sort((a,b)=>b.length-a.length)[0];
  if(!s||s.length<.01)return null;
  const direction=s.b.map((v,i)=>(v-s.a[i])/s.length),tip=s.a.map((v,i)=>v+(s.b[i]-v)*.62),len=Math.min(.30,s.length*.35),r=len*.32,origin=tip.map((v,i)=>v-direction[i]*len);
  const ref=Math.abs(direction[2])<.9?[0,0,1]:[0,1,0],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],raw=cross(direction,ref),norm=Math.hypot(...raw),u=raw.map(v=>v/norm),v=cross(direction,u),vertices=[tip,origin],indices=[];
  for(let j=0;j<12;j++){const a=j*Math.PI/6;vertices.push(origin.map((x,i)=>x+r*(u[i]*Math.cos(a)+v[i]*Math.sin(a))));}
  for(let j=0;j<12;j++){const a=j+2,b=(j+1)%12+2;indices.push(0,a,b,1,b,a);}return {vertices,indices};
}
export function exportScene3D(planned,out){
  const boxes=[],wires=[],arrows=[],symbols=[],depth=planned.spec.depthMultiplier;
  for(const layer of planned.spec.layers){
    const h=layer.height,d=layer.depth,originY=layer.at[1]-h/2-(layer.type==='sum'?0:d*depth/2);
    if(layer.type==='sum'){
      const cx=layer.at[0]+layer.radius,cy=layer.at[1],r=layer.radius;
      boxes.push({id:layer.name,label:layer.label.join(' · '),color:layer.fill,...sphere(cx,cy,r),part:1,op:layer.semanticOp,shape:layer.sourceShape,primitive:'sphere'});
      for(let j=0;j<2;j++){const angle=(layer.semanticOp==='multiply'?Math.PI/4:0)+j*Math.PI/2,vertices=boxVertices().map(p=>{const x=(p[0]-.5)*r,y=(p[1]-.5)*r*.12;return [cx+x*Math.cos(angle)-y*Math.sin(angle),cy+x*Math.sin(angle)+y*Math.cos(angle),r+.015+p[2]*.035];});symbols.push({id:layer.name+'_symbol_'+j,label:layer.symbol,color:'#254F46',vertices,indices:triangles,part:j+1,op:'operator-symbol',primitive:'symbol'});}
      continue;
    }
    let x=layer.at[0];
    for(const [index,w] of layer.widths.entries()){
      if(index>0&&layer.sliceGap){
        const wire={id:layer.name+'_repeat_'+index,from:layer.name+'_part_'+index,to:layer.name+'_part_'+(index+1),points:[[x-layer.sliceGap,layer.at[1]-d*depth,d],[x,layer.at[1],0]]};
        wires.push(wire);const arrow=cone(wire.points);if(arrow)arrows.push({id:wire.id+'_arrow',label:'Sequential repeat',color:'#3B6873',...arrow,part:1,op:'dataflow-arrow',primitive:'cone',from:wire.from,to:wire.to});
      }
      const vertices=boxVertices().map(p=>[x+p[0]*w,originY+p[1]*h,p[2]*d]);
      boxes.push({id:layer.name,label:layer.label.join(' · '),color:layer.fill,vertices,indices:triangles,part:index+1,op:layer.semanticOp,shape:layer.sourceShape,primitive:'cuboid'});x+=w+(layer.sliceGap??0);
    }
  }
  for(const edge of planned.spec.connections){
    const a=planned.spec.layers.find(n=>n.name===edge.from),b=planned.spec.layers.find(n=>n.name===edge.to),points=[edge.fromPoint,...edge.via,edge.toPoint];
    const down=(planned.ir.render?.direction??'RIGHT')==='DOWN';
    const portDepth=(layer,port,fallback)=>layer.type==='sum'?0:['north','east','true_east','northeast','northwest'].includes(port)?layer.depth:['south','west','true_west','southeast','southwest'].includes(port)?0:fallback;
    const za=portDepth(a,edge.fromPort,down?0:a.depth),zb=portDepth(b,edge.toPort,down?b.depth:0);
    const wire={id:edge.id,from:edge.from,to:edge.to,points:points.map((p,i)=>{const z=za+(zb-za)*i/(points.length-1);return [p[0]-z*depth,p[1]-z*depth,z];})};wires.push(wire);
    const arrow=cone(wire.points);if(arrow)arrows.push({id:edge.id+'_arrow',label:edge.from+' → '+edge.to,color:'#3B6873',...arrow,part:1,op:'dataflow-arrow',primitive:'cone',from:edge.from,to:edge.to});
  }
  const scene={title:planned.ir.title,boxes,wires,arrows,symbols,projectionDepth:depth,description:'Actual 3D volume meshes, operator symbols and directional cones generated from the model graph. Unknown dimensions use schematic nonzero geometry.'};
  const buffers=[],views=[],accessors=[],meshes=[],nodes=[],materials=[];
  let offset=0;
  function buffer(array,target){const bytes=Buffer.from(array.buffer,array.byteOffset,array.byteLength),pad=(4-bytes.length%4)%4;const idx=views.length;views.push({buffer:0,byteOffset:offset,byteLength:bytes.length,target});buffers.push(bytes,Buffer.alloc(pad));offset+=bytes.length+pad;return idx;}
  const posAccessor=points=>{const a=new Float32Array(points.flat()),idx=accessors.length;accessors.push({bufferView:buffer(a,34962),componentType:5126,count:points.length,type:'VEC3',min:[0,1,2].map(i=>Math.min(...points.map(p=>p[i]))),max:[0,1,2].map(i=>Math.max(...points.map(p=>p[i])))});return idx;};
  for(const b of [...boxes,...arrows,...symbols]){
    const position=posAccessor(b.vertices),index=accessors.length;accessors.push({bufferView:buffer(new Uint16Array(b.indices),34963),componentType:5123,count:b.indices.length,type:'SCALAR'});
    const material=materials.length;materials.push({name:b.op,pbrMetallicRoughness:{baseColorFactor:[...rgb(b.color),1],metallicFactor:0,roughnessFactor:.75},doubleSided:true});
    const mesh=meshes.length;meshes.push({name:b.id+'_'+b.part,primitives:[{attributes:{POSITION:position},indices:index,material}]});nodes.push({name:b.label,mesh,extras:{nodeId:b.id,op:b.op,shape:b.shape,part:b.part,from:b.from,to:b.to}});
  }
  const lineMaterial=materials.length;materials.push({name:'dataflow',pbrMetallicRoughness:{baseColorFactor:[.2,.35,.4,1],metallicFactor:0,roughnessFactor:1}});
  for(const w of wires){const p=[];for(let i=1;i<w.points.length;i++)p.push(w.points[i-1],w.points[i]);const mesh=meshes.length;meshes.push({name:w.id,primitives:[{attributes:{POSITION:posAccessor(p)},mode:1,material:lineMaterial}]});nodes.push({name:w.id,mesh,extras:{from:w.from,to:w.to}});}
  const binary=Buffer.concat(buffers),gltf={asset:{version:'2.0',generator:'engineering-model-diagrams 0.3'},scene:0,scenes:[{nodes:nodes.map((_,i)=>i)}],nodes,meshes,materials,buffers:[{byteLength:binary.length}],bufferViews:views,accessors,extras:{title:scene.title,sourceSchema:planned.ir.schema}};
  let json=Buffer.from(JSON.stringify(gltf));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,0x20)]);
  const head=Buffer.alloc(12);head.writeUInt32LE(0x46546c67,0);head.writeUInt32LE(2,4);head.writeUInt32LE(12+8+json.length+8+binary.length,8);
  const jhead=Buffer.alloc(8);jhead.writeUInt32LE(json.length,0);jhead.writeUInt32LE(0x4e4f534a,4);
  const bhead=Buffer.alloc(8);bhead.writeUInt32LE(binary.length,0);bhead.writeUInt32LE(0x004e4942,4);
  fs.writeFileSync(out+'.glb',Buffer.concat([head,jhead,json,bhead,binary]));
  fs.writeFileSync(out+'.scene3d.json',JSON.stringify(scene,null,2)+'\n');
  const data=JSON.stringify(scene).replace(/</g,'\\u003c');
  const viewer=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>模型三维几何</title><style>body{margin:0;font:15px Arial,"Microsoft YaHei",sans-serif;background:#f1f4f7;color:#24384b}header{padding:16px 24px;background:white;border-bottom:1px solid #d5dde5}h1{font-size:20px;margin:0 0 6px}p{margin:0;color:#5e7081}canvas{display:block;width:100%;height:75vh;touch-action:none}footer{padding:12px 24px}select{max-width:95%;font:inherit;padding:6px}</style><header><h1 id="title"></h1><p>拖动旋转，滚轮缩放，双击复位。画面由真实三维顶点实时投影；没有使用模型截图或贴图。</p></header><canvas id="view"></canvas><footer><select id="nodes"><option value="">选择模块查看含义和维度</option></select><p id="info"></p></footer><script>const S=${data};
const c=document.getElementById('view'),ctx=c.getContext('2d'),list=document.getElementById('nodes'),info=document.getElementById('info');document.getElementById('title').textContent=S.title;
let selected='',yaw=-.25,pitch=.25,zoom=1,drag=null;const unique=new Map(S.boxes.map(b=>[b.id,b]));for(const b of unique.values()){const o=document.createElement('option');o.value=b.id;o.textContent=b.label;list.append(o);}list.onchange=()=>{selected=list.value;info.textContent=unique.get(selected)?.label??'';draw();};
const all=S.boxes.flatMap(b=>b.vertices),lo=[0,1,2].map(i=>Math.min(...all.map(p=>p[i]))),hi=[0,1,2].map(i=>Math.max(...all.map(p=>p[i]))),center=lo.map((v,i)=>(v+hi[i])/2),span=Math.max(...hi.map((v,i)=>v-lo[i]));
function rot(p){let [x,y,z]=p.map((v,i)=>v-center[i]);const xx=x*Math.cos(yaw)+z*Math.sin(yaw),zz=-x*Math.sin(yaw)+z*Math.cos(yaw);return [xx,y*Math.cos(pitch)-zz*Math.sin(pitch),y*Math.sin(pitch)+zz*Math.cos(pitch)];}
function project(p){const [x,y,z]=rot(p),f=span*3/(span*3-z),scale=Math.min(c.width,c.height)*.83/span*zoom;return [c.width/2+x*scale*f,c.height/2-y*scale*f,z];}
function draw(){const r=c.getBoundingClientRect();c.width=Math.round(r.width*devicePixelRatio);c.height=Math.round(r.height*devicePixelRatio);ctx.clearRect(0,0,c.width,c.height);ctx.lineWidth=devicePixelRatio;ctx.strokeStyle='#547d88';for(const w of S.wires){ctx.beginPath();w.points.map(project).forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.stroke();}const faces=[];for(const b of [...S.boxes,...S.arrows,...S.symbols]){const p=b.vertices.map(project);for(let i=0;i<b.indices.length;i+=3){const ids=b.indices.slice(i,i+3),v=ids.map(j=>p[j]);faces.push({b,v,z:v.reduce((s,x)=>s+x[2],0)/3,shade:.73+.22*Math.abs((i%12)/12-.5)});}}faces.sort((a,b)=>a.z-b.z);for(const f of faces){ctx.beginPath();f.v.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();let rgb=f.b.color.slice(1).match(/../g).map(x=>Math.round(parseInt(x,16)*f.shade));ctx.fillStyle='rgb('+rgb.join(',')+')';ctx.fill();ctx.strokeStyle=f.b.id===selected?'#df7c19':'#40576a';ctx.lineWidth=(f.b.id===selected?2:0.6)*devicePixelRatio;ctx.stroke();}}
c.onpointerdown=e=>{drag=[e.clientX,e.clientY];c.setPointerCapture(e.pointerId);};c.onpointermove=e=>{if(drag){yaw+=(e.clientX-drag[0])*.009;pitch=Math.max(-1.4,Math.min(1.4,pitch+(e.clientY-drag[1])*.009));drag=[e.clientX,e.clientY];draw();}};c.onpointerup=()=>drag=null;c.onwheel=e=>{e.preventDefault();zoom=Math.max(.2,Math.min(5,zoom*Math.exp(-e.deltaY*.001)));draw();};c.ondblclick=()=>{yaw=-.25;pitch=.25;zoom=1;draw();};window.onresize=draw;draw();</script></html>`;
  fs.writeFileSync(out+'.3d.html',viewer);
}
