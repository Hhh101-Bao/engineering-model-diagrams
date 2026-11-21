"""Shared font metrics and vector PDF export. No browser or LaTeX required."""
import argparse
import json
import os
from pathlib import Path
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor


def register_fonts():
    candidates = [
        (os.getenv('ENGINEERING_FONT_REGULAR'), os.getenv('ENGINEERING_FONT_BOLD')),
        ('C:/Windows/Fonts/arial.ttf', 'C:/Windows/Fonts/arialbd.ttf'),
        ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'),
        ('/Library/Fonts/Arial.ttf', '/Library/Fonts/Arial Bold.ttf'),
    ]
    regular, bold = next(((a, b or a) for a, b in candidates if a and Path(a).exists()), (None, None))
    if not regular:
        raise RuntimeError('Set ENGINEERING_FONT_REGULAR and ENGINEERING_FONT_BOLD to TrueType fonts.')
    cjk = next((p for p in [os.getenv('ENGINEERING_FONT_CJK'), 'C:/Windows/Fonts/msyh.ttc',
                          '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'] if p and Path(p).exists()), regular)
    cjk_bold = next((p for p in [os.getenv('ENGINEERING_FONT_CJK_BOLD'), 'C:/Windows/Fonts/msyhbd.ttc'] if p and Path(p).exists()), cjk)
    files = {'Latin':regular, 'LatinBold':bold, 'CJK':cjk, 'CJKBold':cjk_bold}
    for key, file in files.items():
        pdfmetrics.registerFont(TTFont(key, file, subfontIndex=0))
    return files


def face(char, bold=False):
    if ord(char) > 0x2e7f:
        return 'CJKBold' if bold else 'CJK'
    return 'LatinBold' if bold else 'Latin'


def width(text, size, bold=False):
    return sum(pdfmetrics.stringWidth(char, face(char, bold), size) for char in text)


def export(scene, output):
    scale = scene['widthMm'] * 72 / 25.4 / scene['width']
    c = canvas.Canvas(str(output), pagesize=(scene['width'] * scale, scene['height'] * scale), pageCompression=1)
    c.setTitle(scene.get('title', 'Model diagram'))
    c.setAuthor('engineering-model-diagrams')
    c.setSubject('Vector model diagram; editable structural source is supplied separately.')
    c.scale(scale, scale)
    H = scene['height']
    for p in scene['primitives']:
        typ = p['kind']
        c.saveState()
        c.setLineWidth(p.get('strokeWidth', 1.4))
        c.setLineJoin(1)
        c.setLineCap(1)
        if p.get('dash'):
            c.setDash(p['dash'])
        if p.get('stroke'):
            c.setStrokeColor(HexColor(p['stroke']))
        if p.get('fill'):
            c.setFillColor(HexColor(p['fill']))
        if typ == 'rect':
            c.roundRect(p['x'], H-p['y']-p['h'], p['w'], p['h'], p.get('radius',0),
                        stroke=int(bool(p.get('stroke'))), fill=int(bool(p.get('fill'))))
        elif typ == 'ellipse':
            c.ellipse(p['x'], H-p['y']-p['h'], p['x']+p['w'], H-p['y'],
                      stroke=int(bool(p.get('stroke'))), fill=int(bool(p.get('fill'))))
        elif typ in ('line', 'polygon'):
            path = c.beginPath()
            path.moveTo(p['points'][0]['x'], H-p['points'][0]['y'])
            for point in p['points'][1:]:
                path.lineTo(point['x'], H-point['y'])
            if typ == 'polygon':
                path.close()
            c.drawPath(path, stroke=int(bool(p.get('stroke'))), fill=int(bool(p.get('fill'))))
        elif typ == 'text':
            text = p['text']
            size = p['size']
            x = p['x']
            bold = p.get('bold',False)
            W = width(text,size,bold)
            if p.get('anchor') == 'middle':
                x -= W/2
            elif p.get('anchor') == 'end':
                x -= W
            runs=[]
            for char in text:
                f=face(char,bold)
                if runs and runs[-1][0]==f:
                    runs[-1]=(f,runs[-1][1]+char)
                else:
                    runs.append((f,char))
            for f, run in runs:
                c.setFont(f,size)
                c.drawString(x,H-p['y'],run)
                x += pdfmetrics.stringWidth(run,f,size)
        else:
            raise ValueError(f'Unsupported primitive {typ}')
        c.restoreState()
    c.showPage()
    c.save()


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--metrics',action='store_true')
    parser.add_argument('input')
    parser.add_argument('output',nargs='?')
    args=parser.parse_args()
    fonts=register_fonts()
    data=json.loads(Path(args.input).read_text(encoding='utf-8'))
    if args.metrics:
        chars=set(json.dumps(data,ensure_ascii=False)) | set('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,+×-/():[]?→')
        missing=[]
        normal={}
        bold={}
        for char in chars:
            if char in '\n\r\t':
                continue
            for strong, target in [(False,normal),(True,bold)]:
                f=face(char,strong)
                if ord(char) not in pdfmetrics.getFont(f).face.charToGlyph:
                    missing.append(char)
                target[char]=pdfmetrics.stringWidth(char,f,1)
        print(json.dumps({'normal':normal,'bold':bold,'fonts':fonts,'missing':sorted(set(missing))},ensure_ascii=False))
    else:
        export(data,args.output)
        print(json.dumps({'pdf':args.output,'fonts':fonts},ensure_ascii=False))


if __name__=='__main__':
    main()
