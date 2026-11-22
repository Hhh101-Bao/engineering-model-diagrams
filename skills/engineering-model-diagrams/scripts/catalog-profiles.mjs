/** Curated figure composition. Overrides describe representations, never new connections. */
export function profileCatalog(input){
  const model=structuredClone(input),nodes=model.nodes,byId=new Map(nodes.map(n=>[n.id,n]));
  const set=(id,glyph,extra={})=>{const n=byId.get(id);if(n)n.visual={glyph,...extra};};
  const at=(id,col,row)=>{const n=byId.get(id);if(n)Object.assign(n,{col,row});};
  for(const n of nodes){n.axes=n.axes??(n.shape?.length===2?'tokens':'CHW');}
  const id=model.id;let family='operator-flow';
  if(['resnet18','mobilenetv2','convolutional-encoder'].includes(id))family='spatial-cascade';
  if(id==='mobilenetv2')for(const n of nodes.filter(n=>/^b\d$/.test(n.id)))n.label=['IR '+n.label[1]];
  if(id==='unet-original'){
    family='encoder-decoder';
    for(const n of nodes.filter(n=>['e1','e2','e3','e4','b','d1','d2','d3','d4'].includes(n.id))){n.visual={glyph:'tensor'};n.repeat=2;}
    byId.get('b').op='conv';at('y',11,0);model.figureWidth=280;model.rowSpacing=9;
  }
  if(id==='vit-b16'){
    family='patch-token-sequence';set('x','patches');set('patch','tokens');set('pos','tokens',{cls:true});set('enc','operation',{width:2.5});set('cls','vector');
    at('x',0,0);at('patch',1,0);at('pos',2,0);at('enc',3,0);at('cls',4,0);model.figureWidth=220;
  }
  if(id==='swin-t'){
    family='window-hierarchy';set('x','patches');set('p','patches');for(const name of ['s1','s2','s3','s4'])set(name,'windows');model.figureWidth=280;
  }
  if(id==='swin-pair'){family='window-shift';set('x','windows');set('w','windows');set('sw','windows',{shifted:true});set('y','tensor');}
  if(id==='segformer-b0'){family='pyramid-to-dense';for(const name of ['e0','e1','e2','e3'])set(name,'windows');for(const name of ['p0','p1','p2','p3','fuse'])set(name,'tensor');model.figureWidth=260;}
  if(id==='deeplabv3plus'||id==='aspp'||id==='segformer-mlp')family='parallel-scale-fusion';
  if(id==='detr'){
    family='query-memory-decoder';set('cnn','tensor');set('enc','tokens');set('queries','tokens');set('dec','operation',{width:2.4});set('cls','vector');set('box','vector');
    at('queries',3,1);at('box',5,1);at('cls',5,0);at('dec',4,0);model.figureWidth=240;
  }
  if(id==='sam'){
    family='prompt-conditioned-decoder';set('enc','windows');set('p','vector');set('pe','tokens');set('dec','operation',{width:2.5});set('m','masks');set('q','vector');model.figureWidth=240;
  }
  if(id==='unetformer'){family='lateral-feature-pyramid';for(const name of ['g4','g3','g2','frh'])set(name,'tensor');}
  if(id==='bit'){
    family='siamese-token-interaction';set('s1','tokens');set('s2','tokens');set('tr','operation',{width:2.4});set('d1','tensor');set('d2','tensor');
    for(const name of ['t2','f2','s2','d2'])at(name,byId.get(name).col,1.5);at('tr',3,.75);at('diff',5,.75);at('y',6,.75);model.figureWidth=260;
  }
  if(id==='changeformer'){
    family='siamese-multiscale-difference';
    for(let i=0;i<4;i++)for(const t of ['a','b'])set(t+i,'windows',{spatialSize:3.2-i*.55});
    model.figureWidth=280;
  }
  if(id==='clip'){
    family='dual-encoder-similarity';set('i','patches');set('t','tokens');set('ie','operation',{width:2.5});set('te','operation',{width:2.5});set('in','vector');set('tn','vector');set('sim','matrix',{diagonal:true});set('loss','operation');model.figureWidth=220;
    for(const name of ['i','ie','in'])byId.get(name).visual.colorRole='conv';for(const name of ['t','te','tn'])byId.get(name).visual.colorRole='attention';byId.get('sim').visual.colorRole='concat';
  }
  if(id==='se'||id==='cbam'){
    family='channel-spatial-gating';set('x','tensor');for(const name of ['gap','fc1','fc2','ca'])set(name,'vector');set('sa','windows');
  }
  if(id==='semantic-tokenizer'){family='map-to-token-aggregation';set('p','tensor');set('s','matrix');set('agg','tokens');}
  if(id==='stanet'||id==='stanet-pam')family='spatiotemporal-pyramid';
  if(id==='stanet-extractor')family='multiscale-projection';
  model.figureFamily=family;
  return model;
}
