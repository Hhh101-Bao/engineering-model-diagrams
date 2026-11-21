"""Render real PlotNeuralNet volume geometry with a fixed, vendored upstream backend."""
from __future__ import annotations
import argparse
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

HERE=Path(__file__).resolve().parent
VENDOR=HERE/'vendor/plotneuralnet'
TYPES={'input','feature','conv','convrelu','pool','upsample','fc','softmax','attention','block','output','add','concat'}
COLORS={
    'input':('#BCC8D4','#71869D'),'feature':('#BCC8D4','#71869D'),
    'conv':('#ECCB82','#D49540'),'convrelu':('#ECCB82','#D49540'),
    'pool':('#C65B69','#A73D4A'),'upsample':('#86BCC1','#488E99'),
    'fc':('#9CAFD3','#607BA9'),'softmax':('#BAA0CD','#82659D'),
    'attention':('#B7A0D6','#80609F'),'block':('#B7A0D6','#80609F'),
    'output':('#A9C88C','#6D9650'),'add':('#A0C3D3','#4C8AA3'),'concat':('#B7A0D6','#80609F')
}
ANCHORS={'east','west','north','south','anchor','near','far','nearwest','neareast','farwest','fareast','northeast','northwest','southeast','southwest','nearnortheast','farnortheast','nearsoutheast','farsoutheast','nearnorthwest','farnorthwest','nearsouthwest','farsouthwest'}

def tex(text):
    escapes={'\\':r'\textbackslash{}','&':r'\&','%':r'\%','$':r'\$','#':r'\#','_':r'\_','{':r'\{','}':r'\}','~':r'\textasciitilde{}','^':r'\textasciicircum{}'}
    return ''.join(escapes.get(c,c) for c in str(text)).replace('\n',r'\\')

def num(value):
    if not isinstance(value,(int,float)) or not math.isfinite(value):
        raise ValueError(f'Coordinate/size must be finite: {value!r}')
    return f'{value:.5f}'.rstrip('0').rstrip('.') if value else '0'

def coordinate(value):
    if not isinstance(value,list) or len(value)!=3:
        raise ValueError(f'Expected [x,y,z]: {value!r}')
    return '('+','.join(num(v) for v in value)+')'

def anchor(value,ids):
    for identifier in sorted(ids,key=len,reverse=True):
        if value.startswith(identifier+'-') and value[len(identifier)+1:] in ANCHORS:
            return '('+value+')'
    raise ValueError(f'Unknown anchor: {value!r}')

def validate(spec):
    layers=spec.get('layers')
    if not isinstance(layers,list) or not layers:
        raise ValueError('layers must be a nonempty list')
    ids=set()
    for layer in layers:
        identifier=layer.get('id','')
        if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_-]*',identifier) or identifier in ids:
            raise ValueError(f'Invalid or duplicate layer id: {identifier!r}')
        ids.add(identifier)
        if layer.get('type') not in TYPES:
            raise ValueError(f'Unknown volume type: {layer.get("type")}')
        shape=layer.get('tensor')
        if not isinstance(shape,list) or len(shape)!=3 or any(v is not None and (not isinstance(v,int) or v<1) for v in shape):
            raise ValueError(f'{identifier}: tensor must be [C,H,W], positive integers or null')
        repeat=layer.get('repeat',len(layer.get('channels',[])) or 1)
        if not isinstance(repeat,int) or not 1<=repeat<=12:
            raise ValueError(f'{identifier}: repeat must be 1..12')
        channels=layer.get('channels',[shape[0]]*repeat)
        if len(channels)!=repeat or any(c is not None and (not isinstance(c,int) or c<1) for c in channels):
            raise ValueError(f'{identifier}: channels length must equal repeat')
        if channels[-1] is not None and shape[0] is not None and channels[-1]!=shape[0]:
            raise ValueError(f'{identifier}: final channels must match tensor[0]')
        for field in ['color','bandColor']:
            if field in layer and not re.fullmatch(r'#[0-9a-fA-F]{6}',layer[field]):
                raise ValueError(f'{identifier}: {field} must be #RRGGBB')
        if 'widths' in layer and (len(layer['widths'])!=repeat or any(not isinstance(w,(int,float)) or w<=0 for w in layer['widths'])):
            raise ValueError(f'{identifier}: widths must contain repeat positive numbers')
        for field in ['height','depth','opacity','radius']:
            if field in layer and (not isinstance(layer[field],(int,float)) or not math.isfinite(layer[field]) or layer[field]<=0):
                raise ValueError(f'{identifier}: {field} must be positive')
    edge_ids=set()
    for index,edge in enumerate(spec.get('edges',[])):
        eid=edge.get('id',f'edge{index}')
        if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_-]*',eid) or eid in edge_ids:
            raise ValueError(f'Invalid/duplicate edge id: {eid}')
        edge_ids.add(eid)
        if edge.get('from') not in ids or edge.get('to') not in ids:
            raise ValueError(f'{eid}: unknown layer endpoint')
    by_id={layer['id']:layer for layer in layers}
    for layer in layers:
        if layer['type'] not in {'add','concat'}:
            continue
        inputs=[by_id[e['from']]['tensor'] for e in spec.get('edges',[]) if e['to']==layer['id'] and e.get('kind')!='auxiliary']
        if len(inputs)<2:
            raise ValueError(f'{layer["id"]}: {layer["type"]} needs at least two explicit input edges')
        if all(all(v is not None for v in s) for s in inputs):
            expected=inputs[0][:]
            if layer['type']=='concat':
                axis=layer.get('axis',0)
                if axis not in {0,1,2}:
                    raise ValueError(f'{layer["id"]}: concat axis must be 0, 1 or 2')
                if any(any(s[i]!=expected[i] for i in range(3) if i!=axis) for s in inputs):
                    raise ValueError(f'{layer["id"]}: concat non-axis dimensions differ')
                expected[axis]=sum(s[axis] for s in inputs)
            elif any(s!=expected for s in inputs):
                raise ValueError(f'{layer["id"]}: add input dimensions differ')
            if layer['tensor']!=expected:
                raise ValueError(f'{layer["id"]}: output tensor should be {expected}')
    return ids

def dimension(value):
    return '?' if value is None else str(value)

def make_tex(spec,assets_name):
    ids=validate(spec)
    font=float(spec.get('fontSize',16))
    if not 6<=font<=48:
        raise ValueError('fontSize must be between 6 and 48 pt')
    font_file=Path('C:/Windows/Fonts/msyh.ttc')
    if 'fontFamily' in spec:
        family=tex(spec['fontFamily'])
        font_setup=r'\setmainfont{'+family+'}'
    elif font_file.exists():
        font_setup=r'\setmainfont{Microsoft YaHei}'
    else:
        font_setup=r'\setmainfont{Arial}'
    lines=[r'\documentclass[border=16pt,multi,tikz]{standalone}',r'\usepackage{fontspec}',font_setup,
           r'\usepackage{import}',r'\subimport{'+assets_name+r'/layers/}{init}',
           r'\usetikzlibrary{positioning,calc,3d,arrows.meta}',
           r'\newcommand{\figfont}{\fontsize{'+num(font)+'}{'+num(font*1.25)+r'}\selectfont}',
           r'\renewcommand{\small}{\figfont}',r'\begin{document}',
           r'\begin{tikzpicture}[x={(1cm,0cm)},y={(0cm,1cm)},z={(-0.25cm,-0.16cm)},font=\figfont,every node/.style={align=center},line join=round]',
           r'\tikzset{flow/.style={line width=1pt,draw=black!60,-{Stealth[length=6pt,width=5pt]}},skipflow/.style={line width=1pt,draw=blue!45!black,-{Stealth[length=6pt,width=5pt]}}}']
    previous=None
    metadata=[]
    for layer in spec['layers']:
        identifier=layer['id'];kind=layer['type'];shape=layer['tensor']
        repeat=layer.get('repeat',len(layer.get('channels',[])) or 1)
        channels=layer.get('channels',[shape[0]]*repeat)
        widths=layer.get('widths',[max(1.2,min(4.8,math.log2(c or 16)*.46)) for c in channels])
        h=layer.get('height',max(8,min(36,28*math.sqrt((shape[1] or 128)/128))))
        d=layer.get('depth',max(8,min(36,28*math.sqrt((shape[2] or 128)/128))))
        fill=layer.get('color',COLORS[kind][0]);band=layer.get('bandColor',COLORS[kind][1])
        lines += [r'\definecolor{fill-'+identifier+'}{HTML}{'+fill[1:]+'}',r'\definecolor{band-'+identifier+'}{HTML}{'+band[1:]+'}']
        if 'at' in layer:
            at=coordinate(layer['at'])
        elif layer.get('to'):
            at=anchor(layer['to'],ids)
        elif previous:
            at='('+previous+'-east)'
        else:
            at='(0,0,0)'
        offset=coordinate(layer.get('offset',[0,0,0] if previous is None or 'at' in layer else [1.8,0,0]))
        caption=layer.get('caption',identifier)
        if repeat>1 and layer.get('showRepeat',True):
            caption += ' × '+str(repeat)
        if kind in {'add','concat'}:
            radius=layer.get('radius',3.2)
            logo='+' if kind=='add' else 'C'
            lines.append(r'\pic[shift={'+offset+'}] at '+at+r' {Ball={name='+identifier+',fill=fill-'+identifier+',radius='+num(radius)+r',opacity=0.85,logo={\fontsize{10}{10}\selectfont '+logo+r'},caption={}}};')
            point=coordinate(layer['labelAt']) if 'labelAt' in layer else '$('+identifier+'-south)+'+coordinate(layer.get('labelOffset',[0,-.8,0]))+'$'
            if layer.get('showLabels',True):
                lines.append(r'\node[anchor=north] at ('+point.strip('()')+') {'+r'\textbf{'+tex(caption)+'}'+r'\\'+tex('×'.join(map(dimension,shape)))+'};')
        else:
            klass='RightBandedBox' if kind=='convrelu' else 'Box'
            values=['name='+identifier,'caption={}',
                    'xlabel={{'+','.join('" "' for _ in range(max(2,repeat)))+'}}',
                    'zlabel={}',
                    'fill=fill-'+identifier,'height='+num(h),'depth='+num(d),
                    'width={'+','.join(num(w) for w in widths)+'}',
                    'opacity='+num(layer.get('opacity',.58))]
            if klass=='RightBandedBox':
                values += ['bandfill=band-'+identifier,'bandopacity=0.72']
            lines.append(r'\pic[shift={'+offset+'}] at '+at+' {'+klass+'={'+','.join(values)+'}};')
            label=dimension(channels[0]) if len(set(channels))==1 else ' → '.join(map(dimension,channels))
            if layer.get('showChannels',True):
                lines.append(r'\node[above=8pt] at ('+identifier+'-north) {'+tex(label)+'};')
            point=coordinate(layer['labelAt']) if 'labelAt' in layer else '$('+identifier+'-south)+'+coordinate(layer.get('labelOffset',[0,-.6,d*.1]))+'$'
            if layer.get('showLabels',True):
                lines.append(r'\node[anchor=north] at ('+point.strip('()')+') {'+r'\textbf{'+tex(caption)+'}'+r'\\'+tex('×'.join(map(dimension,shape)))+'};')
        metadata.append({'id':identifier,'type':kind,'tensor':shape,'channels':channels,'repeat':repeat,'widths':widths,'height':h,'depth':d})
        previous=identifier
    edges=spec.get('edges')
    if edges is None:
        edges=[{'id':'edge'+str(i),'from':a['id'],'to':b['id']} for i,(a,b) in enumerate(zip(spec['layers'],spec['layers'][1:]))]
    for index,edge in enumerate(edges):
        if edge.get('draw',True) is False:
            continue
        identifier=edge.get('id',f'edge{index}');src=edge['from'];dst=edge['to'];skip=edge.get('kind')=='skip'
        a=anchor(src+'-'+edge.get('fromAnchor','north' if skip else 'east'),ids)
        b=anchor(dst+'-'+edge.get('toAnchor','north' if skip else 'west'),ids)
        points=[coordinate(point) if isinstance(point,list) else anchor(point,ids) for point in edge.get('via',[])]
        style='skipflow' if skip else 'flow'
        label=(r' node[above,fill=white,inner sep=2pt] {'+tex(edge['label'])+'}') if edge.get('label') else ''
        if skip and not points:
            pos=float(edge.get('pos',1.4))
            lines += [r'\path ('+src+'-south) -- ('+src+'-north) coordinate[pos='+num(pos)+'] ('+identifier+'-a);',
                      r'\path ('+dst+'-south) -- ('+dst+'-north) coordinate[pos='+num(pos)+'] ('+identifier+'-b);',
                      r'\draw['+style+'] '+a+' -- ('+identifier+'-a) --'+label+' ('+identifier+'-b) -- '+b+';']
        else:
            lines.append(r'\draw['+style+'] '+' -- '.join([a,*points])+label+' -- '+b+';')
    if spec.get('legend'):
        lines.append(r'\node[anchor=north,inner sep=10pt] at ($(current bounding box.south)+(0,-0.8)$) {'+tex(spec['legend'])+'};')
    if spec.get('title'):
        lines.append(r'\node[anchor=south,font=\bfseries\figfont,inner sep=10pt] at ($(current bounding box.north)+(0,0.8)$) {'+tex(spec['title'])+'};')
    lines += [r'\end{tikzpicture}',r'\end{document}']
    return '\n'.join(lines)+'\n',metadata

def run(command,env=None,cwd=None,timeout=300):
    result=subprocess.run(command,env=env,cwd=cwd,encoding='utf-8',errors='replace',capture_output=True,timeout=timeout)
    if result.returncode:
        raise RuntimeError(f'Command failed ({result.returncode}): {command[0]}\n{result.stdout[-4000:]}\n{result.stderr[-6000:]}')
    return result

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input')
    parser.add_argument('--out',required=True,help='Output prefix; .tex/.pdf/.png added')
    parser.add_argument('--compiler',default='tectonic')
    parser.add_argument('--width-mm',type=float)
    parser.add_argument('--cache-dir')
    parser.add_argument('--no-compile',action='store_true')
    parser.add_argument('--no-png',action='store_true')
    parser.add_argument('--timeout',type=int,default=600)
    args=parser.parse_args()
    spec=json.loads(Path(args.input).read_text(encoding='utf-8'))
    prefix=Path(args.out).resolve();prefix.parent.mkdir(parents=True,exist_ok=True)
    outfile=lambda suffix: Path(str(prefix)+suffix)
    assets=prefix.parent/(prefix.name+'-assets')
    shutil.copytree(VENDOR/'layers',assets/'layers',dirs_exist_ok=True)
    shutil.copy2(VENDOR/'LICENSE',assets/'MIT-LICENSE.txt')
    shutil.copy2(VENDOR/'provenance.json',assets/'provenance.json')
    document,layers=make_tex(spec,assets.name)
    texfile=outfile('.tex')
    texfile.write_text(document,encoding='utf-8')
    outfile('.source.json').write_text(json.dumps(spec,ensure_ascii=False,indent=2),encoding='utf-8')
    report={'backend':'PlotNeuralNet','commit':'e96bc852189c2089dd500527a0a01a5a36e8977e','layers':layers,'tex':str(texfile),'compiled':False}
    report['geometry']={'projection':'oblique 3D-coordinate vector projection','prismGroups':sum(n['type'] not in {'add','concat'} for n in layers),'prisms':sum(n['repeat'] for n in layers if n['type'] not in {'add','concat'}),'spheres':sum(n['type'] in {'add','concat'} for n in layers)}
    report['edgeCount']=len(spec.get('edges',[])) if 'edges' in spec else len(layers)-1
    if not args.no_compile:
        compiler=shutil.which(args.compiler) or (str(Path(args.compiler).resolve()) if Path(args.compiler).is_file() else None)
        if not compiler:
            raise RuntimeError('Tectonic is required; use --compiler PATH or --no-compile to generate editable TeX only.')
        env=os.environ.copy()
        cache=Path(args.cache_dir).resolve() if args.cache_dir else prefix.parent/'.tectonic-cache'
        cache.mkdir(parents=True,exist_ok=True)
        env['TECTONIC_CACHE_DIR']=str(cache)
        try:
            result=run([compiler,'--untrusted','--keep-logs','--outdir',str(prefix.parent),str(texfile)],env=env,cwd=prefix.parent,timeout=args.timeout)
        except Exception as error:
            outfile('.compile.txt').write_text(str(error),encoding='utf-8')
            report['error']=str(error)
            outfile('.backend.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
            raise
        outfile('.compile.txt').write_text(result.stdout+'\n'+result.stderr,encoding='utf-8')
        pdf=outfile('.pdf')
        width_mm=args.width_mm if args.width_mm is not None else spec.get('widthMm')
        if width_mm:
            from pypdf import PdfReader,PdfWriter,Transformation
            if not 30<=width_mm<=1000:
                raise ValueError('widthMm must be 30..1000')
            reader=PdfReader(pdf);page=reader.pages[0]
            scale=(width_mm*72/25.4)/float(page.mediabox.width)
            page.scale_by(scale)
            writer=PdfWriter();writer.add_page(page)
            writer.add_metadata({'/Title':str(spec.get('title','PlotNeuralNet network')),'/Creator':'engineering-model-diagrams / PlotNeuralNet'})
            with pdf.open('wb') as stream:writer.write(stream)
            report['widthMm']=width_mm;report['pdfScale']=scale
        from pypdf import PdfReader
        reader=PdfReader(pdf);page=reader.pages[0]
        fontsizes=[]
        def visit(text,cm,tm,font,fontsize):
            if text.strip():fontsizes.append(fontsize*math.hypot(cm[0],cm[1])*math.hypot(tm[0],tm[1]))
        page.extract_text(visitor_text=visit)
        report['compiled']=True;report['pdf']=str(pdf)
        report['naturalFontSize']=spec.get('fontSize',16)
        report['minFontPt']=min(fontsizes) if fontsizes else None
        report['widthMm']=float(page.mediabox.width)*25.4/72
        report['heightMm']=float(page.mediabox.height)*25.4/72
        if not args.no_png:
            pdftoppm=shutil.which('pdftoppm')
            if not pdftoppm:raise RuntimeError('PDF generated, but PNG preview requires pdftoppm on PATH.')
            run([pdftoppm,'-singlefile','-scale-to','2200','-png',str(pdf),str(prefix)])
            report['png']=str(outfile('.png'))
    outfile('.backend.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=='__main__':
    try:main()
    except Exception as error:
        print(str(error),file=sys.stderr);sys.exit(1)
