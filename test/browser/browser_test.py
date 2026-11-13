"""Stage 2: Star Lattice in a real browser (headless Chrome or Edge, through cdp.py).

Usage (from the project folder):  python test/browser/browser_test.py
  (build the single file first: python tools/single_file.py)

Three ways it runs:
  1. A plain static server (no serve.py API): saves in the browser, filled from the packs; a
     change survives a reload; Download... and Upload...; the service worker registers.
  2. serve.py, on a temporary copy of the project (your saves aren't touched): saves as files.
  3. The single file (dist/Star Lattice.html), opened from disk: browser saves, survives a reload.
Each also checks the console: no errors, no failed loads.
"""
import importlib.util
import json
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from cdp import Browser, free_port

ROOT = Path(__file__).resolve().parent.parent.parent
results = []


def report(what, ok, extra=''):
    results.append(bool(ok))
    print(('ok   ' if ok else 'FAIL ') + what + (f'  -- {extra}' if extra else ''), flush=True)


def wait_http(url, secs=10):
    for _ in range(secs * 10):
        try:
            urllib.request.urlopen(url, timeout=1).read()
            return True
        except Exception:
            time.sleep(0.1)
    return False


IDB = '''new Promise((ok, fail) => {
  const r = indexedDB.open('star-lattice');
  r.onsuccess = () => {
    const db = r.result, out = { saves: [], content: [] };
    if (!db.objectStoreNames.contains('saves')) return ok(out);
    const t = db.transaction(['saves', 'content']);
    t.objectStore('saves').getAll().onsuccess = e => { out.saves = e.target.result.map(x => x.name); };
    t.objectStore('content').getAll().onsuccess = e => { out.content = e.target.result.map(x => x.name); };
    t.oncomplete = () => ok(out);
  };
  r.onerror = () => fail(r.error);
})'''
# Click a button by its text (optionally inside a selector).
CLICK = '''((text, within) => { const root = within ? document.querySelector(within) : document;
  const b = [...root.querySelectorAll('button')].find(x => x.textContent.trim().startsWith(text));
  if (!b) throw new Error('no button ' + text); b.click(); return true; })'''


def booted(b):
    b.wait('document.querySelector(".state-bar") || document.querySelector(".boot-error")', timeout=30)
    err = b.eval('document.querySelector(".boot-error")?.textContent ?? ""')
    return not err, err


def duplicate_as(b, name):
    b.eval(f"{CLICK}('States', '.state-bar')")
    b.eval(f"{CLICK}('Duplicate', '.load-menu')")
    b.eval(f'''(() => {{ const f = document.querySelector('.load-menu form'); const i = f.querySelector('input');
      i.value = {json.dumps(name)}; f.requestSubmit(); return true; }})()''')
    b.wait(f'document.querySelector(".state-current")?.textContent === {json.dumps(name)}')


def browser_mode(b, label):
    """A board kept in the browser: seeded, duplicated, kept over a reload, downloaded and uploaded back."""
    ok, err = booted(b)
    report(f'{label}: the app opens', ok, err[:160])
    if not ok:
        return
    title = b.eval('document.querySelector(".state-current")?.title ?? ""')
    report(f'{label}: saves are kept in this browser (the save bar says so)', 'in this browser' in title, title)
    idb = b.eval(IDB)
    packs = ['organizer-demo', 'statistics-essentials', 'intro-data-analysis', 'home-cooking', 'lantern-coast', 'trivia-night']
    report(f'{label}: the browser was filled from the six packs (content sets and starter boards)', all(p in idb['content'] for p in packs) and len(idb['saves']) >= 6, json.dumps(idb)[:200])
    duplicate_as(b, 'Stage two check')
    time.sleep(0.8)
    b.reload()
    booted(b)
    report(f'{label}: a new save survives a reload, and opens again', b.eval('document.querySelector(".state-current")?.textContent') == 'Stage two check'
           and 'Stage two check' in b.eval(IDB)['saves'])


# A plain static server (no API), like a static host: Python's own, with a longer connection queue
# (its default of 5 refuses some of a page's ~50 parallel module loads on Windows).
STATIC = ('import functools, http.server, sys\n'
          'class S(http.server.ThreadingHTTPServer): request_queue_size = 128\n'
          'S(("127.0.0.1", int(sys.argv[1])), functools.partial(http.server.SimpleHTTPRequestHandler, directory=sys.argv[2])).serve_forever()')


def static_server():
    port = free_port()
    srv = subprocess.Popen([sys.executable, '-c', STATIC, str(port), str(ROOT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    downloads = Path(tempfile.mkdtemp(prefix='sl-dl-'))
    try:
        wait_http(f'http://127.0.0.1:{port}/app/')
        with Browser() as b:
            b.open(f'http://127.0.0.1:{port}/app/')
            browser_mode(b, 'static server')
            b.downloads_to(downloads)
            b.eval(f"{CLICK}('States', '.state-bar')")
            b.eval(f"{CLICK}('Download', '.load-menu')")
            for _ in range(50):
                files = list(downloads.glob('*.json'))
                if files:
                    break
                time.sleep(0.1)
            got = files[0] if files else None
            data = json.loads(got.read_text(encoding='utf-8')) if got else {}
            report('static server: Download… gives one file with the save and its content set', data.get('format') == 'star-lattice-bundle' and data.get('name') == 'Stage two check'
                   and data.get('content', {}).get('id') in ('organizer-demo', 'statistics-essentials', 'intro-data-analysis', 'home-cooking', 'lantern-coast', 'trivia-night'), got.name if got else 'no file')
            if got:
                b.set_files('.upload-input', [got])
                b.wait('document.querySelector(".state-current")?.textContent === "Stage two check (2)"')
                report('static server: Upload… adds it beside the original, with a free name, and opens it', 'Stage two check (2)' in b.eval(IDB)['saves'])
            # Stage 4: New from a blueprint… starts a board from a pack (a free name beside the seeded one).
            b.eval(f"{CLICK}('States', '.state-bar')")
            b.eval(f"{CLICK}('New from a blueprint', '.load-menu')")
            b.wait('document.querySelectorAll(".pack-row").length === 6')
            b.eval("document.querySelector('.pack-row[data-pack=\"trivia-night\"] .pack-start').click()")
            b.wait('document.querySelector(".state-current")?.textContent === "Trivia night (2)"')
            report('static server: New from a blueprint… lists six packs and starts Trivia night beside the first one', 'Trivia night (2)' in b.eval(IDB)['saves'])
            sw = b.eval('navigator.serviceWorker.getRegistration().then(r => r ? r.scope : "")')
            report('static server: the service worker is registered (installable, opens offline)', sw.endswith('/app/'), sw)
            manifest = b.eval('fetch(document.querySelector("link[rel=manifest]").href).then(r => r.json()).then(m => m.icons.map(i => i.sizes).join())')
            report('static server: the manifest names the app and its icons', '192x192' in manifest and '512x512' in manifest, manifest)
            report('static server: no console errors or failed loads', not b.errors, '; '.join(b.errors[:4]))
    finally:
        srv.terminate()
        shutil.rmtree(downloads, ignore_errors=True)


def serve_py():
    copy = Path(tempfile.mkdtemp(prefix='sl-copy-')) / 'p'
    shutil.copytree(ROOT, copy, ignore=shutil.ignore_patterns('archive', 'exam3_prep', 'dist', 'node_modules'))
    port = free_port()
    env = {**__import__('os').environ, 'STAR_LATTICE_NO_BROWSER': '1'}
    srv = subprocess.Popen([sys.executable, 'serve.py', str(port)], cwd=copy, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        wait_http(f'http://127.0.0.1:{port}/api/hello')
        with Browser() as b:
            b.open(f'http://127.0.0.1:{port}/app/')
            ok, err = booted(b)
            report('serve.py: the app opens', ok, err[:160])
            title = b.eval('document.querySelector(".state-current")?.title ?? ""')
            report('serve.py: saves are files in saves/ (not the browser)', title.startswith('saves/'), title)
            report('serve.py: no console errors or failed loads', not b.errors, '; '.join(b.errors[:4]))
    finally:
        srv.terminate()
        shutil.rmtree(copy.parent, ignore_errors=True)


def fresh_clone():
    """Stage 4: a copy as a clone has it (no content/ or saves/, which are yours): serve.py fills them from the packs."""
    copy = Path(tempfile.mkdtemp(prefix='sl-clone-')) / 'p'
    shutil.copytree(ROOT, copy, ignore=shutil.ignore_patterns('archive', 'exam3_prep', 'dist', 'node_modules', 'content', 'saves'))
    port = free_port()
    env = {**__import__('os').environ, 'STAR_LATTICE_NO_BROWSER': '1'}
    srv = subprocess.Popen([sys.executable, 'serve.py', str(port)], cwd=copy, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        wait_http(f'http://127.0.0.1:{port}/api/hello')
        with Browser() as b:
            b.open(f'http://127.0.0.1:{port}/app/')
            ok, err = booted(b)
            report('fresh clone (serve.py): the app opens', ok, err[:160])
            time.sleep(0.5)
            files = sorted(f.stem for f in (copy / 'saves').glob('*.json'))
            report('fresh clone: the six packs became files in content/ and saves/', len(list((copy / 'content').glob('*.json'))) == 6 and len(files) == 6, ', '.join(files))
            report('fresh clone: no console errors or failed loads', not b.errors, '; '.join(b.errors[:4]))
    finally:
        srv.terminate()
        shutil.rmtree(copy.parent, ignore_errors=True)


def code_of(vbs):
    """A VBScript file with its string literals ("" escapes a quote) and comments emptied."""
    lines = Path(vbs).read_text(encoding='utf-8').splitlines()
    return [re.sub(r'"(?:[^"]|"")*"', '""', l) for l in lines if not l.lstrip().startswith("'")]


def derivation():
    """P7: Make a repo… on a fresh copy under serve.py writes a play version of one board (Organizer demo,
    which shows off some progress) beside it: that board alone, its progress cleared, the design-only
    modules replaced by stand-ins; it runs on its own, in Play mode only."""
    base = Path(tempfile.mkdtemp(prefix='sl-derive-'))
    copy = base / 'p'
    shutil.copytree(ROOT, copy, ignore=shutil.ignore_patterns('archive', 'exam3_prep', 'dist', 'node_modules', 'content', 'saves', 'local', '__pycache__'))
    env = {**__import__('os').environ, 'STAR_LATTICE_NO_BROWSER': '1'}
    port, port2 = free_port(), free_port()
    srv = subprocess.Popen([sys.executable, 'serve.py', str(port)], cwd=copy, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    srv2 = None
    try:
        wait_http(f'http://127.0.0.1:{port}/api/hello')
        with Browser() as b:
            b.open(f'http://127.0.0.1:{port}/app/')
            booted(b)
            b.eval(f"{CLICK}('States', '.state-bar')")
            b.wait('[...document.querySelectorAll(".load-menu button")].some(x => x.textContent.startsWith("Make a repo"))')
            b.eval(f"{CLICK}('Make a repo', '.load-menu')")
            b.wait('!!document.querySelector(".repo-form .repo-board")')
            b.eval("""(() => { const f = document.querySelector('.repo-form');
              const s = f.querySelector('.repo-board'); s.value = 'Organizer demo'; s.dispatchEvent(new Event('change'));
              return true; })()""")
            b.wait("document.querySelector('.repo-form .repo-name')?.value === 'organizer-demo'")
            report('Make a repo… asks for one board; its folder and title follow the board chosen', b.eval("document.querySelector('.repo-form .repo-title').value") == 'Organizer demo')
            b.eval("""(() => { const f = document.querySelector('.repo-form');
              const n = f.querySelector('.repo-name'); n.value = 'derived-demo'; n.dispatchEvent(new Event('input'));
              const t = f.querySelector('.repo-title'); t.value = 'Derived demo'; t.dispatchEvent(new Event('input'));
              f.querySelector('.repo-write').click(); return true; })()""")
            out = base / 'derived-demo'
            for _ in range(100):
                if (out / 'starlattice.version').is_file():
                    break
                time.sleep(0.1)
            report('Make a repo… (in the States menu, under serve.py) writes the folder beside this one', (out / 'starlattice.version').is_file())
            report('…with that one board as its only pack', sorted(p.name for p in (out / 'packs').iterdir() if p.is_dir()) == ['organizer-demo'])
            shipped = json.loads((out / 'packs' / 'organizer-demo' / 'board.json').read_text(encoding='utf-8'))
            source = json.loads((copy / 'saves' / 'Organizer demo.json').read_text(encoding='utf-8'))
            had = sum(1 for d in source['state']['dots'].values() if d.get('ignitedAt') is not None)
            left = sum(1 for d in shipped['state']['dots'].values() if d.get('ignitedAt') is not None)
            report('…its progress cleared (the board had some), its items all there', had > 0 and left == 0 and set(shipped['state']['dots']) == set(source['state']['dots']), f'{had} complete before, {left} after')
            edition = (out / 'app' / 'js' / 'edition.js').read_text(encoding='utf-8')
            report('…its edition says it’s a play version', 'export const PLAY = true;' in edition)
            spec = importlib.util.spec_from_file_location('sl_derive', ROOT / 'tools' / 'derive.py')
            dmod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(dmod)
            stubs = {rel: (out / rel).read_text(encoding='utf-8') for rel in dmod.DESIGN_ONLY}
            editor = [rel for rel, text in stubs.items() if len(text) > 1200 or 'h(' in text or re.search(r'^import ', text, re.M)]
            same = [rel for rel, text in stubs.items() if dmod.exported(text) != dmod.exported((ROOT / rel).read_text(encoding='utf-8'))]
            report(f'…the {len(stubs)} design-only modules are stand-ins: no editor code, the same names exported', not editor and not same, ', '.join(editor + same))
            leaked = [x for x in ('test', 'docs', 'dev.md', 'notes.md', 'saves', 'content', 'archive', 'local', 'tools/derive.py', 'tools/build_packs.mjs') if (out / x).exists()]
            report('…and none of the tests, docs, notes, saves or Make a repo… itself', not leaked, ', '.join(leaked))
            report('…its README, license, Pages workflow and start scripts', all((out / x).is_file() for x in ('README.md', 'LICENSE', 'NOTICE.md', '.github/workflows/pages.yml', 'serve.py', 'Start Star Lattice.cmd', 'Make desktop shortcut.vbs', 'index.html'))
                   and 'Derived demo.lnk' in (out / 'Make desktop shortcut.vbs').read_text(encoding='utf-8')
                   # the title may change only what's inside VBScript strings ("" escapes a quote), not the code
                   and code_of(out / 'Make desktop shortcut.vbs') == code_of(ROOT / 'Make desktop shortcut.vbs'))
            report('Make a repo…: no console errors', not b.errors, '; '.join(b.errors[:4]))
        srv2 = subprocess.Popen([sys.executable, 'serve.py', str(port2)], cwd=out, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        wait_http(f'http://127.0.0.1:{port2}/api/hello')
        with Browser() as b:
            b.open(f'http://127.0.0.1:{port2}/app/')
            ok, err = booted(b)
            time.sleep(0.5)
            report('the play version runs on its own (its serve.py), opening straight into its board', ok and [f.stem for f in (out / 'saves').glob('*.json')] == ['Organizer demo']
                   and b.eval('document.querySelector(".state-current")?.textContent') == 'Organizer demo', err[:160])
            report('…in Play mode only: no Mode switch, Design or States menu', b.eval("location.hash") == '#play' and b.eval("!document.querySelector('.mode-switch') && !document.querySelector('.design-link') && ![...document.querySelectorAll('.state-bar button')].some(x => x.textContent.startsWith('States'))"),
                   b.eval('location.hash'))
            report('…opening with the player’s tutorial (its intro), not the designer’s', b.eval("!!document.querySelector('.tour-intro') && !document.querySelector('.tour-intro').textContent.includes('Welcome to Star Lattice')"))
            b.eval("location.hash = '#design'")
            time.sleep(0.4)
            report('…where an Edit mode address leads to Play mode', b.eval('location.hash').startswith('#play') and not b.eval("!!document.querySelector('.subtabs')"), b.eval('location.hash'))
            b.eval("location.hash = '#tree'")
            time.sleep(0.4)
            report('…and a view the player isn’t given (Tree, by default) to the Star view', b.eval('location.hash') == '#play', b.eval('location.hash'))
            report('the play version: no console errors', not b.errors, '; '.join(b.errors[:4]))
    finally:
        srv.terminate()
        if srv2:
            srv2.terminate()
        time.sleep(0.3)
        shutil.rmtree(base, ignore_errors=True)


def single_file():
    page = ROOT / 'dist' / 'Star Lattice.html'
    if not page.exists():
        report('single file: dist/Star Lattice.html exists (python tools/single_file.py)', False)
        return
    with Browser() as b:
        b.open(page.as_uri())
        browser_mode(b, 'single file')
        report('single file: no console errors or failed loads', not b.errors, '; '.join(b.errors[:4]))


if __name__ == '__main__':
    for step in (static_server, serve_py, fresh_clone, derivation, single_file):
        try:
            step()
        except Exception as e:
            report(f'{step.__name__}: ran to the end', False, f'{type(e).__name__}: {e}')
    print(f'{sum(results)}/{len(results)} passed')
    sys.exit(0 if all(results) else 1)
