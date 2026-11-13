"""Make a repo... writes a play version of one designed board beside this folder, ready to push to
GitHub and to host on GitHub Pages (P7).

Usage (from the project folder):
    python tools/derive.py <folder name> --save "<a save's name>" [--title "Its title"] [--out <parent folder>]
  (or States > Make a repo... in the app, under serve.py, which calls derive() below with the board,
  its progress already cleared).

A play version opens straight into that board, as a first-time player meets it (its progress cleared:
the app clears it again as it seeds a new browser or folder), in Play mode only, with the views and
permissions its content set's Design > Player gives, and the star-dot screen's layout.

What goes in: app/ and shared/ (the program) with app/js/edition.js saying it's a play version and
the design-only modules (DESIGN_ONLY: Design's panels, the States menu, the question editors, the
question import, the PIN dialog, the palette menu) replaced by stand-ins that draw nothing, so their
code isn't in it; packs/ holding that one board and its content set; serve.py and the start scripts
(the shortcut named after the title), tools/single_file.py, LICENSE and NOTICE.md, a README written
for it, .gitignore, an index.html that leads to the app, .github/workflows/pages.yml (GitHub Pages,
with the single file to download), starlattice.version.
Never: your other saves, content/, tests, docs, the development notes, archive/, the packs.

Writing again to a folder made here replaces what it wrote and keeps the rest (its saves/,
content/ and .git). A folder that exists and wasn't made here is refused. The manifest is kept in
local/derivations/<name>.json (ignored by git), so the app can offer the last choices again.
Standard library only.
"""
import importlib.util
import json
import os
import re
import shutil
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MARK = 'starlattice.version'
NAME = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$')
TREES = ['app', 'shared']                      # copied whole
FILES = ['serve.py', 'Start Star Lattice.cmd', 'start-star-lattice.sh', 'LICENSE']
GENERATED = ['README.md', 'NOTICE.md', '.gitignore', 'index.html', MARK, 'Make desktop shortcut.vbs',
             '.github/workflows/pages.yml', 'tools/single_file.py']
SKIP = shutil.ignore_patterns('__pycache__', '*.pyc', '.DS_Store', 'Thumbs.db')
# The design version's own modules: a play version gets a stand-in for each (stub()), exporting the
# same names and drawing nothing.
DESIGN_ONLY = [
    'app/js/panels/rules.js',            # ⚙ Design's panels
    'app/js/panels/statesMenu.js',       # States ▾ (saves, blueprints, Download/Upload, Make a repo…)
    'app/js/panels/importQuestions.js',  # Import / Export questions…
    'app/js/panels/pin.js',              # the assessor PIN's dialog
    'app/js/panels/palette.js',          # the palette menu (Design › Look)
    'shared/ui/questionEditor.js',       # the star-dot screen's question editors
    'shared/ui/questionForm.js',         # …and their form
]
EDITION = """// Which version of the app this is: a play version of one board, written by Make a repo…
// (tools/derive.py). Play mode only, for real; the design tools aren't in its files.

/** True in a play version: no Edit mode, no Design, no States menu; Play mode plays for real. */
export const PLAY = true;
"""


class DeriveError(Exception):
    pass


def exported(source):
    """The names a module exports (export function / const / let, and export { a, b })."""
    names = re.findall(r'^export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)', source, re.M)
    for group in re.findall(r'^export\s*\{([^}]*)\}', source, re.M):
        names += [n.split(' as ')[-1].strip() for n in group.split(',') if n.strip()]
    return list(dict.fromkeys(names))


def stub(rel):
    """A design-only module's stand-in: the same exports, each a function that draws nothing."""
    names = exported((ROOT / rel).read_text(encoding='utf-8'))
    lines = [f'// A play version\'s stand-in for the design version\'s {rel}: the same names, drawing nothing.', '']
    lines += [f'export const {n} = () => null;' for n in names]
    return '\n'.join(lines) + '\n'


def version():
    try:
        return json.loads((ROOT / 'package.json').read_text(encoding='utf-8')).get('version', '0')
    except (OSError, ValueError):
        return '0'


def readme(title, board_title):
    return f'''# {title}

**{board_title}**, a Star Lattice board you can play in the browser: a starfield where finishing
items lights the map and opens new stars outward. It opens straight into the board; your progress is
kept in your browser.

## Use it

- **In the browser:** once this repository is on GitHub Pages, open its address. Your progress is
  kept in that browser; the browser offers *Install app*.
- **As one file:** download `star-lattice.html` from the Pages site (or build it with
  `python tools/single_file.py`), put it anywhere and double-click it.
- **From this folder, with Python 3:** on Windows double-click `Make desktop shortcut.vbs` once, then
  use the shortcut it makes; on macOS or Linux run `sh start-star-lattice.sh`. Your progress is then
  a file in `saves/` (kept out of git).

## Put it on GitHub Pages

Push this folder to a new GitHub repository, then in its **Settings › Pages** choose
**Source: GitHub Actions**. `.github/workflows/pages.yml` publishes it on every push to `main`.

## License

The code is MIT ([`LICENSE`](LICENSE)); the IBM Plex fonts are under the SIL Open
Font License. Details in [`NOTICE.md`](NOTICE.md). Made with Star Lattice {version()}.
'''


INDEX_HTML = '''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title}</title>
  <script>location.replace('app/')</script>
  <meta http-equiv="refresh" content="0; url=app/">
  <link rel="icon" href="app/icon.svg" type="image/svg+xml">
</head>
<body style="font-family: system-ui, sans-serif; background: #141a33; color: #eef; padding: 2rem;">
  <p>Opening <a href="app/" style="color: #9cf">{title}</a>… Or download it as
  <a href="star-lattice.html" download style="color: #9cf">one file</a>.</p>
</body>
</html>
'''

PAGES = '''# GitHub Pages: publishes the app, its packs and the single file on every push to main.
# Turn it on once: Settings > Pages > Source: GitHub Actions.
name: pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - name: The single file
        run: python tools/single_file.py packs/index.json _site/star-lattice.html
      - name: The site
        run: cp -r app shared packs index.html _site/
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: _site
      - id: deployment
        uses: actions/deploy-pages@v4
'''

GITIGNORE = '''# Boards and content sets written by serve.py (yours), and built files.
/saves/
/content/
/dist/
/_site/
__pycache__/
'''


def shortcut_script(title):
    """Make desktop shortcut.vbs, its shortcut named after the title (so it doesn't replace another)."""
    text = (ROOT / 'Make desktop shortcut.vbs').read_text(encoding='utf-8')
    safe = re.sub(r'[\\/:*?"<>|]', '', title).strip() or 'Star Lattice'
    return (text.replace('desk & "\\Star Lattice.lnk"', f'desk & "\\{safe}.lnk"')
                .replace('A Star Lattice shortcut is now', f'A ""{safe}"" shortcut is now')
                .replace('lnk.Description = "Start Star Lattice"', f'lnk.Description = "Start {safe}"'))


def preload_page(page):
    """app/index.html with every module (and the main font) listed up front, so a browser fetches them
    in one round instead of one round per level of imports: a first visit on a hosted site is that much
    faster. The modules are the ones the single-file build walks."""
    spec = importlib.util.spec_from_file_location('star_lattice_single_file', ROOT / 'tools' / 'single_file.py')
    single = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(single)
    app = ROOT / 'app'
    links = ['  <link rel="preload" href="fonts/ibm-plex-sans-variable-latin.woff2" as="font" type="font/woff2" crossorigin>']
    links += [f'  <link rel="modulepreload" href="{Path(os.path.relpath(ROOT / m, app)).as_posix()}">'
              for m in sorted(single.modules('app/js/main.js'))]
    tag = '  <script type="module" src="js/main.js"></script>'
    if tag not in page:
        raise DeriveError('app/index.html has no main.js script tag to preload before.')
    return page.replace(tag, '\n'.join(links) + '\n' + tag)


def board_from(save_name):
    """A save of this folder (saves/<name>.json) with its content set, as derive() takes a board."""
    path = ROOT / 'saves' / f'{save_name}.json'
    if not path.is_file():
        raise DeriveError(f'No save named “{save_name}” in saves/.')
    save = json.loads(path.read_text(encoding='utf-8'))
    content = ROOT / 'content' / f"{save.get('content', '')}.json"
    if not content.is_file():
        raise DeriveError(f'“{save_name}” uses the content set “{save.get("content")}”, which isn\'t in content/.')
    library = json.loads(content.read_text(encoding='utf-8'))
    # P10: a save carries its own design; it goes over its content set (the library), as the app does.
    design = save.pop('design', None)
    if isinstance(design, dict):
        library = {**library, **design, 'format': library.get('format'), 'version': library.get('version'), 'id': library.get('id'), 'title': library.get('title')}
    library.pop('starter', None)   # the play version ships the board itself, not the library beside it
    return {'save': save, 'content': library, 'from': save_name}


def plan(name, title=None, board=None, out=None):
    """What a derivation writes: (target folder, manifest). Raises DeriveError when it can't."""
    if not NAME.match(name or ''):
        raise DeriveError('The folder name may use letters, digits, ".", "_" and "-" (up to 64), starting with a letter or digit.')
    save, content = (board or {}).get('save'), (board or {}).get('content')
    if not isinstance(save, dict) or not isinstance(content, dict) or not isinstance(save.get('state'), dict):
        raise DeriveError('Choose a board to ship.')
    if not NAME.match(str(content.get('id', ''))) or save.get('content') != content.get('id'):
        raise DeriveError('That board’s content set doesn’t match it.')
    parent = Path(out).resolve() if out else ROOT.parent
    target = parent / name
    if target.resolve() == ROOT or ROOT in target.resolve().parents:
        raise DeriveError('A derivation goes beside this folder, not inside it.')
    if target.exists() and any(target.iterdir()) and not (target / MARK).is_file():
        raise DeriveError(f'{target} already exists and wasn\'t made by Make a repo…: choose another name.')
    board_title = str(board.get('from') or save.get('title') or content.get('title') or 'Star Lattice')
    return target, {'name': name, 'title': (title or '').strip() or board_title, 'board': board_title}


def derive(name, title=None, board=None, out=None):
    """Write the play version. Returns { path, files, bytes, board }."""
    target, manifest = plan(name, title, board, out)
    save, content = board['save'], board['content']
    target.mkdir(parents=True, exist_ok=True)
    for tree in TREES + ['packs', 'tools', '.github']:   # replace what an earlier run wrote
        shutil.rmtree(target / tree, ignore_errors=True)
    for tree in TREES:
        shutil.copytree(ROOT / tree, target / tree, ignore=SKIP)
    page = target / 'app' / 'index.html'
    page.write_text(preload_page(page.read_text(encoding='utf-8')), encoding='utf-8', newline='\n')
    (target / 'app' / 'js' / 'edition.js').write_text(EDITION, encoding='utf-8', newline='\n')
    for rel in DESIGN_ONLY:   # The design tools: stand-ins, so their code isn't in the play version
        (target / rel).write_text(stub(rel), encoding='utf-8', newline='\n')
    # The one board, as the pack a new browser (or folder) starts from.
    cid = content['id']
    (target / 'packs' / cid).mkdir(parents=True)
    dump = lambda data: json.dumps(data, indent=2, ensure_ascii=False) + '\n'
    (target / 'packs' / cid / 'pack.json').write_text(dump(content), encoding='utf-8')
    (target / 'packs' / cid / 'board.json').write_text(dump(save), encoding='utf-8')
    entry = {'id': cid, 'title': manifest['board'], 'about': content.get('title', ''), 'content': f'{cid}/pack.json', 'board': f'{cid}/board.json'}
    (target / 'packs' / 'index.json').write_text(dump({'about': 'The board this play version opens: what a new browser starts with.', 'packs': [entry]}), encoding='utf-8')
    for f in FILES:
        shutil.copy2(ROOT / f, target / f)
    (target / 'tools').mkdir()
    shutil.copy2(ROOT / 'tools' / 'single_file.py', target / 'tools' / 'single_file.py')
    (target / '.github' / 'workflows').mkdir(parents=True)
    write = lambda rel, text: (target / rel).write_text(text, encoding='utf-8', newline='\n')
    write('.github/workflows/pages.yml', PAGES)
    write('README.md', readme(manifest['title'], manifest['board']))
    write('NOTICE.md', (ROOT / 'NOTICE.md').read_text(encoding='utf-8').replace(' and **the test fixtures** (`test/fixtures/`)', ''))
    write('.gitignore', GITIGNORE)
    write('index.html', INDEX_HTML.format(title=manifest['title']))
    (target / 'Make desktop shortcut.vbs').write_text(shortcut_script(manifest['title']), encoding='utf-8', newline='\r\n')
    write(MARK, json.dumps({'from': 'star-lattice', 'version': version(), 'made': date.today().isoformat(), **manifest}, indent=2, ensure_ascii=False) + '\n')
    keep = ROOT / 'local' / 'derivations'
    keep.mkdir(parents=True, exist_ok=True)
    (keep / f'{name}.json').write_text(json.dumps({**manifest, 'out': str(target.parent)}, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    files = [f for f in target.rglob('*') if f.is_file() and '.git' not in f.relative_to(target).parts[:1] and f.relative_to(target).parts[0] not in ('saves', 'content')]
    return {'path': str(target), 'files': len(files), 'bytes': sum(f.stat().st_size for f in files), 'board': manifest['board']}


def previous():
    """The manifests of earlier derivations, newest first."""
    keep = ROOT / 'local' / 'derivations'
    out = []
    for f in sorted(keep.glob('*.json'), key=lambda f: f.stat().st_mtime, reverse=True) if keep.is_dir() else []:
        try:
            out.append(json.loads(f.read_text(encoding='utf-8')))
        except ValueError:
            pass
    return out


if __name__ == '__main__':
    args = sys.argv[1:]
    if not args or args[0].startswith('-'):
        raise SystemExit(__doc__)
    opt = lambda flag: args[args.index(flag) + 1] if flag in args else None
    try:
        if not opt('--save'):
            raise DeriveError('Say which board to ship: --save "<a save\'s name>".')
        r = derive(args[0], opt('--title'), board_from(opt('--save')), opt('--out'))
    except DeriveError as e:
        raise SystemExit(f'Not written: {e}')
    print(f"wrote {r['path']} ({r['files']} files, {r['bytes'] / 1024:.0f} KB; a play version of {r['board']})")
