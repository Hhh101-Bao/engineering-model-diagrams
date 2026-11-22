"""Inspect actual PDF text geometry and create bounded-size visual QA sheets."""
import json
import math
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from pypdf import PdfReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from PIL import Image,ImageDraw,ImageFont

root=Path.cwd();files=sorted((root/'docs/gallery').glob('*.pdf'))+sorted((root/'docs/palettes').glob('*.pdf'))
results=[]
def image_count(resources):
    total=0
    for ref in resources.get('/XObject',{}).get_object().values() if '/XObject' in resources else []:
        x=ref.get_object();total+=int(x.get('/Subtype')=='/Image')
        if '/Resources' in x:total+=image_count(x['/Resources'])
    return total
for file in files:
    reader=PdfReader(file);assert len(reader.pages)==1
    page=reader.pages[0];boxes=[];sizes=[]
    def visit(text,cm,tm,font,size):
        if not text.strip():return
        actual=size*math.hypot(cm[0],cm[1])*math.hypot(tm[0],tm[1]);sizes.append(actual)
        if '\n' in text.strip():return
        x=cm[0]*tm[4]+cm[2]*tm[5]+cm[4];y=cm[1]*tm[4]+cm[3]*tm[5]+cm[5]
        face='Helvetica-Bold' if 'Bold' in str(font.get('/BaseFont','')) else 'Helvetica'
        w=stringWidth(text.strip(),face,actual)
        boxes.append((x,y-actual*.24,x+w,y+actual*.81,text.strip()))
    page.extract_text(visitor_text=visit)
    collisions=[]
    for i,a in enumerate(boxes):
        for b in boxes[i+1:]:
            if min(a[2],b[2])-max(a[0],b[0])>1 and min(a[3],b[3])-max(a[1],b[1])>2:collisions.append([a[4],b[4]])
    s=json.loads(file.with_suffix('.volume.json').read_text(encoding='utf-8'))
    width=float(page.mediabox.width)*25.4/72;images=image_count(page['/Resources'])
    svg_images=sum(n.tag.endswith('image') for n in ET.parse(file.with_suffix('.svg')).getroot().iter())
    results.append(dict(id=file.stem,file=str(file.relative_to(root)),widthMm=round(width,3),heightMm=round(float(page.mediabox.height)*25.4/72,3),minimumTextPt=round(min(sizes),3),pdfRasterImages=images,svgImageElements=svg_images,labelCollisionCandidates=collisions,pass_=not collisions and images==0 and svg_images==0 and min(sizes)>=s['minFontPt']-.1 and abs(width-s['widthMm'])<.5))
folder=root/'tmp/gallery-review';folder.mkdir(parents=True,exist_ok=True)
font_paths=[Path('C:/Windows/Fonts/arial.ttf'),Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'),Path('/Library/Fonts/Arial.ttf')]
font=next((ImageFont.truetype(str(p),20) for p in font_paths if p.exists()),ImageFont.load_default())
for start in range(0,len(files),6):
    sheet=Image.new('RGB',(1800,1440),'#edf1f5');draw=ImageDraw.Draw(sheet)
    for k,file in enumerate(files[start:start+6]):
        col=k%2;row=k//2;x=col*900;y=row*480
        draw.rectangle((x+10,y+10,x+890,y+470),fill='white')
        draw.text((x+28,y+22),file.stem,font=font,fill='#24384b')
        im=Image.open(file.with_suffix('.png')).convert('RGB');im.thumbnail((850,390));sheet.paste(im,(x+25+(850-im.width)//2,y+68+(390-im.height)//2))
    sheet.save(folder/f'contact-{start//6+1}.png')
report={'pass':all(r['pass_'] for r in results),'results':results,'method':'Actual PDF text positions and approximate Helvetica/Arial advances identify collision candidates; actual PNG inspection is separately required.'}
(root/'docs/gallery/export-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'pass':report['pass'],'figures':len(results),'collisionCandidates':[r for r in results if not r['pass_']]},ensure_ascii=False,indent=2))
