"""Stage 2: Star Lattice as one HTML file that opens by double-click (file://, no server).

Usage (from the project folder):  python tools/single_file.py [packs index] [output]
  defaults: packs/index.json  ->  dist/Star Lattice.html

How: every JavaScript module reachable from app/js/main.js goes in as a data: URL behind an
import map (each module's relative imports rewritten to "@sl/<its path>"), so the modules run as
written, cycles and all. The stylesheets are inlined with their fonts as data: URLs, the icon too,
and the packs (the content sets and starter saves a browser starts with) are embedded as
window.STAR_LATTICE_PACKS. Saves are kept in the browser (storage.js, browser mode); no service
worker (it needs a server). Standard library only.
"""
import base64
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IMPORT = re.compile(r"""((?:\bfrom|\bimport)\s*)(['"])(\.{1,2}/[^'"]+)\2""")
STYLES = ['app/css/app.css', 'shared/ui/starDotScreen.css', 'shared/ui/map.css', 'shared/ui/kiteDesigner.css']


def rel(path):
    return path.resolve().relative_to(ROOT).as_posix()


def modules(entry):
    """{ 'app/js/main.js': source with imports rewritten, … } for every module reachable from entry."""
    out, todo = {}, [ROOT / entry]
    while todo:
        path = todo.pop()
        key = rel(path)
        if key in out:
            continue
        src = path.read_text(encoding='utf-8')

        def rewrite(m):
            target = (path.parent / m.group(3)).resolve()
            if not target.is_file():
                raise SystemExit(f'{key}: imports {m.group(3)}, which doesn\'t exist')
            todo.append(target)
            return f'{m.group(1)}{m.group(2)}@sl/{rel(target)}{m.group(2)}'
        out[key] = IMPORT.sub(rewrite, src)
    return out


def data_url(mime, data):
    return f'data:{mime};base64,{base64.b64encode(data).decode("ascii")}'


def styles():
    css = []
    for name in STYLES:
        path = ROOT / name
        text = path.read_text(encoding='utf-8')

        def inline(m):
            target = (path.parent / m.group(2)).resolve()
            mime = {'.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png'}.get(target.suffix, 'application/octet-stream')
            return f"url('{data_url(mime, target.read_bytes())}')"
        css.append(f'/* {name} */\n' + re.sub(r"url\((['\"]?)([^'\")]+)\1\)", inline, text))
    return '\n'.join(css)


def packs(index_path, only=None):
    """The packs, each with its content set and board inline (stage 4: packs/index.json's { packs: [...] })."""
    index = json.loads(index_path.read_text(encoding='utf-8'))
    load = lambda ref: json.loads((index_path.parent / ref).resolve().read_text(encoding='utf-8'))
    chosen = [p for p in index.get('packs', []) if not only or p['id'] in only]
    return {'packs': [{**p, 'content': {'data': load(p['content'])}, 'board': {'data': load(p['board'])}} for p in chosen]}


def script_json(value):
    """JSON safe inside a <script> element."""
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')


def build(index_path, out_path):
    mods = modules('app/js/main.js')
    imports = {f'@sl/{k}': data_url('text/javascript;charset=utf-8', v.encode('utf-8')) for k, v in sorted(mods.items())}
    icon = data_url('image/svg+xml', (ROOT / 'app' / 'icon.svg').read_bytes())
    page = (ROOT / 'app' / 'index.html').read_text(encoding='utf-8')
    body = page[page.index('<body>'):page.index('</body>') + len('</body>')]
    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Star Lattice</title>
  <link rel="icon" href="{icon}" type="image/svg+xml">
  <meta name="theme-color" content="#141a33">
  <!-- Star Lattice, as one file (tools/single_file.py). Saves are kept in this browser: States > Download... keeps a copy. -->
  <style>
{styles()}
  </style>
  <script>window.STAR_LATTICE_PACKS = {script_json(packs(index_path))};</script>
  <script type="importmap">{script_json({'imports': imports})}</script>
  <script type="module">import '@sl/app/js/main.js';</script>
</head>
{body}
</html>
'''
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(html, encoding='utf-8')
    return len(mods), out_path.stat().st_size


if __name__ == '__main__':
    index = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'packs' / 'index.json'
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / 'dist' / 'Star Lattice.html'
    n, size = build(index.resolve(), out.resolve())
    print(f'wrote {out} ({n} modules, {size / 1024:.0f} KB)')
