"""Download the pinned official portable Typst for Windows x64; other platforms use PATH."""
import argparse
import hashlib
import io
import platform
import shutil
import urllib.request
import zipfile
from pathlib import Path

parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path);args=parser.parse_args()
base=Path(__file__).resolve().parents[1]
target=args.output or base/'skills/engineering-model-diagrams/scripts/vendor/typst/typst.exe'
url='https://github.com/typst/typst/releases/download/v0.15.1/typst-x86_64-pc-windows-msvc.zip'
archive_sha='19ce3551153c2fe7ee9fa2f95208310c8f4d3209fedb699e0333faf8913f6736'
exe_sha='081217a463adb006f8894b44227fe4b9c9e91fc85f5463d5948e8370db9bb31e'
sha=lambda b:hashlib.sha256(b).hexdigest()
if target.exists():
    if sha(target.read_bytes())!=exe_sha:raise SystemExit('Existing compiler differs; retained. Use --output to select a new destination.')
    print('Pinned compiler already present:',target);raise SystemExit(0)
if platform.system()!='Windows' or platform.machine().lower() not in {'amd64','x86_64'}:
    raise SystemExit('This helper packages Windows x64 only. Install Typst >=0.14 from https://github.com/typst/typst and put it on PATH, or set ENGINEERING_TYPST.')
with urllib.request.urlopen(url,timeout=90) as response:data=response.read()
if sha(data)!=archive_sha:raise SystemExit('Official archive SHA-256 mismatch; nothing installed.')
with zipfile.ZipFile(io.BytesIO(data)) as archive:
    members=[n for n in archive.namelist() if n.endswith('/typst.exe')]
    if len(members)!=1:raise SystemExit('Unexpected official archive layout.')
    executable=archive.read(members[0])
if sha(executable)!=exe_sha:raise SystemExit('Compiler SHA-256 mismatch; nothing installed.')
target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(executable)
print('Installed verified official Typst:',target)
