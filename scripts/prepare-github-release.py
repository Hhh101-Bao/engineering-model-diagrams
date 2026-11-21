"""Prepare an explicit, reviewed public file set and downloadable release assets."""
import hashlib
import json
import re
import shutil
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED

root=Path.cwd().resolve();stage=root/'output/github-release/repository';release=root/'output/github-release/releases'
stage.mkdir(parents=True,exist_ok=True);release.mkdir(parents=True,exist_ok=True)
if (stage/'.git').exists():raise SystemExit('A prepared Git repository already exists; retained. Use an explicit maintenance workflow for subsequent releases.')
skill=root/'skills/engineering-model-diagrams'
sha=lambda b:hashlib.sha256(b).hexdigest()
native=skill/'scripts/vendor/neural-netz';extension=json.loads((native/'local-extensions.json').read_text(encoding='utf-8'))
extension['derivedSha256']=sha((native/'src/placed.typ').read_bytes())
extension['extensions']=list(dict.fromkeys(extension['extensions']+['Separated repeat cuboids with real slice-gap and internal arrows','First/last solid surface ports for separated groups','One arrowhead per direct route to avoid elbow clutter','Physical label hierarchy: bold module name, regular description/dimensions']))
(native/'local-extensions.json').write_text(json.dumps(extension,indent=2)+'\n',encoding='utf-8')
for p in (root/'docs').rglob('local-extensions.json'):
    if '.assets' in str(p):p.write_text(json.dumps(extension,indent=2)+'\n',encoding='utf-8')
audit=json.loads((root/'docs/gallery/export-audit.json').read_text(encoding='utf-8'));runtime=json.loads((root/'docs/gallery/runtime-audit.json').read_text(encoding='utf-8'))
assert audit['pass'] and runtime['pass'] and len(audit['results'])==33
catalog=json.loads((root/'docs/gallery/catalog.json').read_text(encoding='utf-8'));assert len(catalog['models'])==28 and not catalog['errors']
catalog['status']='reviewed-with-scope-limitations'
for m in catalog['models']:m['previewSha256']=sha((root/'docs/gallery'/f'{m["id"]}.png').read_bytes())
(root/'docs/gallery/catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def allowed(p):
    return p.is_file() and p.suffix not in {'.exe','.pyc','.log'} and not any(s in {'.cache','__pycache__','.git'} for s in p.parts) and not any(p.name.endswith(ext) for ext in ['.compile.json','.workflow.json','.review.json'])
selected=[]
for directory in ['skills','docs','examples','scripts']:
    selected.extend(p for p in (root/directory).rglob('*') if allowed(p))
for name in ['README.md','README.en.md','LICENSE','THIRD_PARTY_NOTICES.md','CONTRIBUTING.md','requirements.txt','requirements-dev.txt']:
    selected.append(root/name)
selected.append(root/'evals/verify-v04.mjs')
for p in selected:
    dest=stage/p.relative_to(root);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
(stage/'.gitignore').write_text('tmp/\noutput/\n__pycache__/\n*.pyc\n**/.cache/\n*.log\nskills/engineering-model-diagrams/scripts/vendor/typst/typst.exe\n**/*.compile.json\n**/*.workflow.json\n**/*.review.json\n',encoding='utf-8')
flags=[]
for p in stage.rglob('*'):
    if not p.is_file():continue
    try:content=p.read_text(encoding='utf-8')
    except (UnicodeDecodeError,ValueError):continue
    if re.search(r'(?i)[A-Z]:[\\/]+Users[\\/]+[A-Za-z0-9_.-]+',content) or re.search(r'[0-9]{5,}@qq[.]com',content):flags.append(str(p.relative_to(stage)))
if flags:raise SystemExit('Local-machine content was retained locally and not approved for publication: '+str(flags))
broken=[]
for p in stage.rglob('*.md'):
    # Only check ordinary relative links; URLs, anchors and illustrative placeholders are excluded.
    for link in re.findall(r'!?\[[^\]]*\]\(([^)]+)\)',p.read_text(encoding='utf-8')):
        if '://' in link or link.startswith('#') or any(x in link for x in ['PREFIX','FILE','path/','MODEL','OUTPUT']):continue
        target=link.split('#')[0].split(' "')[0]
        if target and not (p.parent/target).exists():broken.append([str(p.relative_to(stage)),target])
if broken:raise SystemExit('Broken public documentation links: '+str(broken))
review={'pass':True,'release':'v0.4.0','modelSchematics':14,'moduleSchematics':14,'scientificPalettes':5,'actualPdfFiguresAudited':33,'true3DMeshesAudited':len(runtime['meshes']),'minimumMeasuredTextPt':min(r['minimumTextPt'] for r in audit['results']),'pdfRasterImages':sum(r['pdfRasterImages'] for r in audit['results']),'svgImageElements':sum(r['svgImageElements'] for r in audit['results']),'localMachinePathsFound':0,'brokenRelativeLinks':0,'sourcePapersRedistributed':False,'originalAuthorFiguresRedistributed':False,'visualReview':'Final generated PNGs and target-size text checks reviewed. Interpret model scopes and abstraction notes individually.','limitations':['Macro/stage grouping is explicit; no training/accuracy reproduction claim.','Long figures require decomposition for narrow journal columns.','Windows execution verified; other operating systems need their own Typst/Poppler/fonts.','Offline3D viewer interaction has not been browser-tested.']}
(stage/'release-review.json').write_text(json.dumps(review,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
notes='''## v0.4.0 · First public release

- 14 source-backed model schematics and14 module/subnetwork schematics: vision backbones, segmentation, detection, remote sensing, change detection and vision-language.
- Five selectable scientific palettes: steel-teal, ocean-sand, sage-earth, plum-slate and graphite-amber.
- Separated repeated cuboids, physical gaps, surface ports, clear route arrowheads and a module-name/dimension typography hierarchy.
- Evidence-led paper/image/code workflow, editable Typst, vector PDF/SVG, PNG, genuine GLB and offline3D viewer.
- Fixed width-axis concat propagation and DOWN ports for separated repeated groups.

### Downloads

- **source.zip**: repository, gallery, source dependencies; install Typst yourself.
- **windows-x64.zip**: complete repository plus verified official portable Typst0.15.1.
- **skill-windows-x64.zip**: only the installable skill folder and portable Typst; copy engineering-model-diagrams into your Codex skills directory.
- **SHA256SUMS.txt**: download integrity checks.

Node.js, Python+pypdf and Poppler remain prerequisites. The host assistant supplies paper understanding; standalone scripts require a graph or gallery choice. These are source-backed redraws, not official author figures. Read per-model variants/scopes. Long figures are not certified at arbitrary reduced journal widths. Windows compilation and file-level mesh checks were performed; offline viewer browser interaction and other operating systems were not independently tested. Third-party components retain their licenses.
'''
(release/'RELEASE_NOTES.md').write_text(notes,encoding='utf-8')
exe=skill/'scripts/vendor/typst/typst.exe';assert sha(exe.read_bytes())=='081217a463adb006f8894b44227fe4b9c9e91fc85f5463d5948e8370db9bb31e'
assets=[]
for kind in ['source','windows-x64','skill-windows-x64']:
    output=release/f'engineering-model-diagrams-v0.4.0-{kind}.zip'
    with ZipFile(output,'w',ZIP_DEFLATED) as archive:
        if kind=='skill-windows-x64':
            source=stage/'skills/engineering-model-diagrams'
            for p in source.rglob('*'):
                if p.is_file():archive.write(p,p.relative_to(source.parent))
            archive.write(exe,'engineering-model-diagrams/scripts/vendor/typst/typst.exe')
        else:
            for p in stage.rglob('*'):
                if p.is_file():archive.write(p,Path('engineering-model-diagrams')/p.relative_to(stage))
            if kind=='windows-x64':archive.write(exe,'engineering-model-diagrams/skills/engineering-model-diagrams/scripts/vendor/typst/typst.exe')
    with ZipFile(output) as archive:assert archive.testzip() is None
    assets.append({'file':output.name,'bytes':output.stat().st_size,'sha256':sha(output.read_bytes())})
(release/'SHA256SUMS.txt').write_text(''.join(f'{a["sha256"]}  {a["file"]}\n' for a in assets),encoding='ascii')
(stage.parent/'preparation.json').write_text(json.dumps({'review':review,'assets':assets,'selectedFiles':len(selected)},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'repository':str(stage),'files':len(selected),'assets':assets},ensure_ascii=False,indent=2))
