/** Semantic colors shared by the automatic compiler and public examples. */
export const themes={
  publication:{fonts:['Arial','Liberation Sans','Microsoft YaHei'],colors:{input:'#CCD4DD',output:'#91B6A1',conv:'#8FAAC4',convblock:'#8FAAC4',pool:'#D7B584',gap:'#D7B584',linear:'#ADA2C2',concat:'#D8BC80',add:'#8CB7A6',multiply:'#8CB7A6',attention:'#B0A3C3',custom:'#B0A3C3'},bands:{conv:'#6589AC',convblock:'#6589AC'}},
  classic:{fonts:['New Computer Modern','Microsoft YaHei'],colors:{input:'#B7C2CC',output:'#97C8AC',conv:'#A5CEE9',convblock:'#A5CEE9',pool:'#D99275',gap:'#D99275',linear:'#B7B9DE',concat:'#E3C281',add:'#8DC5A7',multiply:'#8DC5A7',attention:'#BEA6D4',custom:'#B6A6CF'},bands:{}}
};
const scientific={
  'steel-teal':{label:'Steel & Teal · 钢蓝青绿',conv:'#9EAFB9',pool:'#C3B49A',linear:'#B0B4BB',concat:'#C6AD84',attention:'#A3B7AD',output:'#8FA99F'},
  'ocean-sand':{label:'Ocean & Sand · 海蓝砂金',conv:'#769BC2',pool:'#AFC4CE',linear:'#9CADD0',concat:'#CDB98B',attention:'#A5B2C8',output:'#83B2AD'},
  'sage-earth':{label:'Sage & Earth · 鼠尾草大地',conv:'#9EAD97',pool:'#C2AB85',linear:'#A6AAB7',concat:'#D5BD85',attention:'#B4AAA1',output:'#83A596'},
  'plum-slate':{label:'Plum & Slate · 灰紫岩蓝',conv:'#A39CB7',pool:'#C7B093',linear:'#9DABC2',concat:'#D6BE8F',attention:'#B19CAC',output:'#8FB2AA'},
  'graphite-amber':{label:'Graphite & Amber · 石墨琥珀',conv:'#99A7B2',pool:'#C7B99F',linear:'#A7A5B9',concat:'#C4B18B',attention:'#AAA3AE',output:'#92ACA8'}
};
for(const [id,p] of Object.entries(scientific))themes[id]={label:p.label,fonts:themes.publication.fonts,colors:{input:'#CCD4DD',conv:p.conv,convblock:p.conv,pool:p.pool,gap:p.pool,linear:p.linear,concat:p.concat,attention:p.attention,custom:p.attention,output:p.output,add:p.output,multiply:p.output},bands:{}};
themes.publication=themes['steel-teal'];
export const scientificThemeNames=Object.keys(scientific);
export function themeFor(name='publication'){if(!themes[name])throw Error(`Unknown render.theme: ${name}`);return themes[name];}
