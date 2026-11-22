"""Package the reviewed source tree and independent skill downloads."""
import argparse
import hashlib
import json
import re
import shutil
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED

parser=argparse.ArgumentParser();parser.add_argument('--version',default='0.5.0');args=parser.parse_args()
assert re.fullmatch(r'\d+\.\d+\.\d+',args.version)
root=Path.cwd().resolve();folder=root/f'output/release-v{args.version}';stage=folder/'repository';release=folder/'releases'
if (stage/'.git').exists():raise SystemExit('Existing publication checkout retained; choose an explicit maintenance workflow.')
stage.mkdir(parents=True,exist_ok=True);release.mkdir(parents=True,exist_ok=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
native=root/'skills/engineering-model-diagrams/scripts/vendor/neural-netz';extension=json.loads((native/'local-extensions.json').read_text(encoding='utf-8'))
extension['derivedSha256']=sha(native/'src/placed.typ')
extension['extensions']=[x for x in extension['extensions'] if not x.startswith('Physical label hierarchy')]+['Semantic component cuboids for tokens, windows and matrices; shared XYZ geometry','Matte faces, regular print labels and mathematical operator circles']
extension['extensions']=list(dict.fromkeys(extension['extensions']))
(native/'local-extensions.json').write_text(json.dumps(extension,indent=2)+'\n',encoding='utf-8')
for p in (root/'docs').rglob('local-extensions.json'):p.write_text(json.dumps(extension,indent=2)+'\n',encoding='utf-8')
catalog=json.loads((root/'docs/gallery/catalog.json').read_text(encoding='utf-8'))
audit=json.loads((root/'docs/gallery/export-audit.json').read_text(encoding='utf-8'))
runtime=json.loads((root/'docs/gallery/runtime-audit.json').read_text(encoding='utf-8'))
visual=json.loads((root/'docs/gallery/visual-language-audit.json').read_text(encoding='utf-8'))
assert not catalog['errors'] and len(catalog['models'])==28 and audit['pass'] and runtime['pass'] and visual['pass']
catalog['status']='reviewed-with-scope-limitations'
for m in catalog['models']:m['previewSha256']=sha(root/'docs/gallery'/f'{m["id"]}.png')
(root/'docs/gallery/catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def allowed(p):return p.is_file() and p.suffix not in {'.exe','.pyc','.log'} and not any(s in {'.cache','__pycache__','.git'} for s in p.parts) and not any(p.name.endswith(e) for e in ['.compile.json','.workflow.json','.review.json'])
selected=[p for directory in ['skills','docs','examples','scripts'] for p in (root/directory).rglob('*') if allowed(p)]
selected.extend(root/n for n in ['README.md','README.en.md','LICENSE','THIRD_PARTY_NOTICES.md','CONTRIBUTING.md','requirements.txt','requirements-dev.txt','evals/verify-v04.mjs','evals/verify-v05.mjs'])
for p in selected:
    dest=stage/p.relative_to(root);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
(stage/'.gitignore').write_text('tmp/\noutput/\n__pycache__/\n*.pyc\n**/.cache/\n*.log\nskills/engineering-model-diagrams/scripts/vendor/typst/typst.exe\n**/*.compile.json\n**/*.workflow.json\n**/*.review.json\n',encoding='utf-8')
for p in stage.rglob('*'):
    if not p.is_file():continue
    try:content=p.read_text(encoding='utf-8')
    except UnicodeDecodeError:continue
    assert not re.search(r'(?i)[A-Z]:[\\/]+Users[\\/]+[A-Za-z0-9_.-]+',content),f'Local path in {p.relative_to(stage)}'
    if p.suffix=='.md':
        for link in re.findall(r'!?\[[^\]]*\]\(([^)]+)\)',content):
            if '://' in link or link.startswith('#') or any(s in link for s in ['PREFIX','FILE','path/','MODEL','OUTPUT']):continue
            target=link.split('#')[0].split(' "')[0]
            assert not target or (p.parent/target).exists(),f'Broken link: {p.relative_to(stage)} {target}'
review={'pass':True,'release':'v'+args.version,'modelSchematics':14,'moduleSchematics':14,'scientificPalettes':5,'actualPdfFiguresAudited':len(audit['results']),'minimumMeasuredTextPt':min(r['minimumTextPt'] for r in audit['results']),'true3DMeshesAudited':len(runtime['meshes']),'meshConnectionEndpointsChecked':visual['endpointsChecked'],'localMachinePathsFound':0,'brokenRelativeLinks':0,'visualReview':'Rendered PNGs inspected, including front/back ordering of sampled geometry.','limitations':['Sampled tokens/windows/cells do not represent literal counts or measured values.','Source-backed schematic redraws; no training or accuracy reproduction claim.','Print dimensions matter; split narrow or tall figures. maxHeightMm rejects oversize output without reducing type.','Windows execution verified. Other OS and offline viewer UI not independently tested.']}
(stage/'release-review.json').write_text(json.dumps(review,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
exe=root/'skills/engineering-model-diagrams/scripts/vendor/typst/typst.exe';assert sha(exe)=='081217a463adb006f8894b44227fe4b9c9e91fc85f5463d5948e8370db9bb31e'
assets=[]
for kind in ['skill-source','skill-windows-x64']:
    output=release/f'engineering-model-diagrams-v{args.version}-{kind}.zip';skill=stage/'skills/engineering-model-diagrams'
    with ZipFile(output,'w',ZIP_DEFLATED) as z:
        for p in skill.rglob('*'):
            if p.is_file():z.write(p,p.relative_to(skill.parent))
        if kind=='skill-windows-x64':z.write(exe,'engineering-model-diagrams/scripts/vendor/typst/typst.exe')
    with ZipFile(output) as z:assert z.testzip() is None
    assets.append({'file':output.name,'bytes':output.stat().st_size,'sha256':sha(output)})
(release/'SHA256SUMS.txt').write_text(''.join(a['sha256']+'  '+a['file']+'\n' for a in assets),encoding='ascii')
(release/'RELEASE_NOTES.md').write_text('''## Architecture-specific scientific figures

- Different geometry for spatial tensors, patches/windows, tokens/vectors, gates and similarity matrices.
- Four-scale ChangeFormer interactions, distinct regular/shifted windows and CLIP pairing matrix.
- Matte faces, regular typography and a technical figure homepage; no product-poster framing or gradient operators.
- Word-aware English wrapping and optional maxHeightMm; explicit oversize rejection preserves print type size.
- 14 source-backed model diagrams,14 module diagrams and five selectable scientific palettes.

Download **skill-windows-x64.zip** for the skill with verified portable Typst, or **skill-source.zip** without the compiler. Copy the engineering-model-diagrams folder into the Codex skills directory. Node.js, Python+pypdf and Poppler remain prerequisites. The complete gallery and development files are in this repository and GitHub's generated Source code archive.

Repeated cells are schematic samples. CLIP's diagonal indicates paired examples, not measured similarities. Read the per-model source and scope. The host assistant supplies paper understanding; standalone scripts require a graph or gallery entry. Windows execution and actual meshes were checked; other operating systems and offline viewer UI have not been independently tested. Third-party licenses are retained.
''',encoding='utf-8')
(folder/'preparation.json').write_text(json.dumps({'review':review,'assets':assets,'selectedFiles':len(selected)},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'repository':str(stage),'assets':assets,'review':review},ensure_ascii=False,indent=2))
