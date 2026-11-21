"""Install this repository's skill; existing destinations are kept intact."""
import argparse
import os
import shutil
from pathlib import Path

parser=argparse.ArgumentParser();parser.add_argument('--dest',type=Path,help='Skill parent folder; defaults to CODEX_HOME/skills or ~/.codex/skills');args=parser.parse_args()
repo=Path(__file__).resolve().parents[1];source=repo/'skills/engineering-model-diagrams'
parent=args.dest or Path(os.environ.get('CODEX_HOME',Path.home()/'.codex'))/'skills'
target=parent/'engineering-model-diagrams'
if target.exists():raise SystemExit(f'Destination already exists and was retained: {target}. Choose a fresh --dest or back up the previous skill yourself.')
if not (source/'SKILL.md').is_file():raise SystemExit('Run from an extracted repository containing skills/engineering-model-diagrams.')
shutil.copytree(source,target,ignore=shutil.ignore_patterns('__pycache__','.cache','*.pyc'))
print('Installed:',target.resolve());print('Available on the next assistant turn. Attach a paper or model image and invoke $engineering-model-diagrams.')
