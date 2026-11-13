# Local server for Star Lattice and its tests. Run from this folder:  python serve.py
# (then open http://localhost:8000/app/ or /test/). Optional port:  python serve.py 8001
# Stage 1: --open opens the browser once the server answers; a port taken by something else is
# skipped (the next free one of ten is used); if Star Lattice from this folder already runs on it,
# the browser opens there and nothing new starts. (STAR_LATTICE_NO_BROWSER=1 prints instead.)
#
# - Serves the files here, telling the browser never to cache them, so every reload picks up
#   the latest edits. The program imports shared/ from here. "/" and the old /dashboard/ address
#   lead to /app/.
# - Keeps JSON files in a few folders ("stores"), through a small API on each store's URL:
#     GET    <store>          list of files: [{ name, savedAt }], newest first
#     GET    <store>/<name>   one file (JSON)
#     PUT    <store>/<name>   write a file (JSON body)
#     DELETE <store>/<name>   delete a file
#   Names starting with "_" (like "_autosave") are internal and left out of the list.
# - Stage 6: GET /api/derive says whether Make a repo... is available here (tools/derive.py) and
#   lists earlier choices; POST /api/derive { name, title, board: { save, content, from } } writes a
#   play version of that board beside this folder (tools/derive.py says what goes in).

import importlib.util
import json
import os
import re
import socket
import sys
import tempfile
import threading
import time
import urllib.request
import webbrowser
from datetime import datetime, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).parent
STORES = {
    '/api/saves': ROOT / 'saves',       # saves (boards)
    '/api/content': ROOT / 'content',   # content sets
}
REDIRECTS = {'/': '/app/', '/dashboard': '/app/', '/dashboard/': '/app/', '/app': '/app/', '/favicon.ico': '/app/icon.ico'}
MAX_BODY = 16 * 1024 * 1024
# Characters Windows forbids in file names, plus control characters.
BAD_CHARS = re.compile(r'[\\/:*?"<>|\x00-\x1f]')


def deriver():
    """tools/derive.py as a module, or None where it isn't (a derived copy has no Make a repo...)."""
    path = ROOT / 'tools' / 'derive.py'
    if not path.is_file():
        return None
    spec = importlib.util.spec_from_file_location('star_lattice_derive', path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def file_path(folder, name):
    """File for a name in a store, or None if the name isn't allowed."""
    name = name.strip()
    if not name or len(name) > 80 or BAD_CHARS.search(name) or name.startswith('.') or name.endswith('.'):
        return None
    return folder / (name + '.json')


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Star-Lattice', 'files')   # stage 2: tells the app saves are files here (storage.js)
        super().end_headers()

    def send_json(self, status, data):
        body = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def api_target(self):
        """(folder, name): name is '' for the list or the decoded name of one file.
        (None, None) if this isn't an API path."""
        path = urlsplit(self.path).path
        for url, folder in STORES.items():
            if path == url:
                return folder, ''
            if path.startswith(url + '/'):
                return folder, unquote(path[len(url) + 1:])
        return None, None

    @staticmethod
    def retried(fn, tries=20):
        """Run a file operation, retrying briefly when Windows says the file is in use (a read and a
        write's swap of the same save at once): without it the request fails and the browser
        gets an empty answer."""
        for i in range(tries):
            try:
                return fn()
            except PermissionError:
                if i == tries - 1:
                    raise
                time.sleep(0.025)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == '/api/hello':   # stage 1: lets a launcher recognize this server (and its folder)
            return self.send_json(200, {'app': 'star-lattice', 'root': str(ROOT)})
        if path == '/api/derive':
            d = deriver()
            return self.send_json(200, {'available': bool(d), 'parent': str(ROOT.parent), 'previous': d.previous() if d else []})
        target = REDIRECTS.get(path)
        if target:
            self.send_response(302)
            self.send_header('Location', target)
            self.end_headers()
            return
        folder, name = self.api_target()
        if folder is None:
            return super().do_GET()
        if name == '':
            files = []
            if folder.is_dir():
                for f in folder.glob('*.json'):
                    if not f.stem.startswith('_'):
                        stamp = datetime.fromtimestamp(f.stat().st_mtime, timezone.utc)
                        files.append({'name': f.stem, 'savedAt': stamp.isoformat()})
            files.sort(key=lambda s: s['savedAt'], reverse=True)
            return self.send_json(200, files)
        path = file_path(folder, name)
        if path is None:
            return self.send_json(400, {'error': 'Invalid name'})
        if not path.is_file():
            return self.send_json(404, {'error': 'Not found'})
        body = self.retried(path.read_bytes)
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if urlsplit(self.path).path != '/api/derive':
            return self.send_json(404, {'error': 'Not found'})
        d = deriver()
        if not d:
            return self.send_json(404, {'error': 'Make a repo… isn’t available in this copy.'})
        length = int(self.headers.get('Content-Length') or 0)
        try:
            req = json.loads(self.rfile.read(length)) if 0 < length <= MAX_BODY else None
            if not isinstance(req, dict):
                raise ValueError
        except ValueError:
            return self.send_json(400, {'error': 'Body is not a JSON object'})
        board = req.get('board')
        try:
            result = d.derive(str(req.get('name', '')), req.get('title'), board if isinstance(board, dict) else None)
        except d.DeriveError as e:
            return self.send_json(400, {'error': str(e)})
        return self.send_json(200, result)

    def do_PUT(self):
        folder, name = self.api_target()
        path = file_path(folder, name) if name else None
        if path is None:
            return self.send_json(400, {'error': 'Invalid name'})
        length = int(self.headers.get('Content-Length') or 0)
        if length <= 0 or length > MAX_BODY:
            return self.send_json(400, {'error': 'Missing or oversized body'})
        body = self.rfile.read(length)
        try:
            json.loads(body)
        except ValueError:
            return self.send_json(400, {'error': 'Body is not valid JSON'})
        path.parent.mkdir(parents=True, exist_ok=True)
        # Write a temporary file, then swap it in, so a crash never leaves a half-written file.
        fd, tmp = tempfile.mkstemp(dir=path.parent, suffix='.tmp')
        with os.fdopen(fd, 'wb') as f:
            f.write(body)
        self.retried(lambda: os.replace(tmp, path))
        return self.send_json(200, {'name': path.stem})

    def do_DELETE(self):
        folder, name = self.api_target()
        path = file_path(folder, name) if name else None
        if path is None:
            return self.send_json(400, {'error': 'Invalid name'})
        if path.is_file():
            path.unlink()
        return self.send_json(200, {'name': path.stem})

    def log_message(self, fmt, *args):
        # Keep the console quiet for saves (one after every change); show everything else.
        if self.command != 'PUT':
            super().log_message(fmt, *args)


class Server(ThreadingHTTPServer):
    # On Windows, address reuse lets a second server bind a port already in use without an error;
    # stage 1 checks ports itself, so a taken port is never shared.
    allow_reuse_address = sys.platform != 'win32'
    # Stage 2: a page load asks for ~50 modules at once; the default queue of 5 refused some on Windows.
    request_queue_size = 128


def answering(port):
    """'ours' if Star Lattice from this folder answers on the port, 'other' if anything else does, None if it's free."""
    with socket.socket() as s:
        s.settimeout(0.5)
        if s.connect_ex(('127.0.0.1', port)) != 0:
            return None
    try:
        with urllib.request.urlopen(f'http://127.0.0.1:{port}/api/hello', timeout=2) as r:
            hello = json.loads(r.read())
        if hello.get('app') == 'star-lattice' and Path(hello.get('root', '')).resolve() == ROOT.resolve():
            return 'ours'
    except Exception:
        pass
    return 'other'


def open_app(port):
    url = f'http://localhost:{port}/app/'
    if os.environ.get('STAR_LATTICE_NO_BROWSER'):
        print(f'(would open {url})')
    else:
        webbrowser.open(url)


args = sys.argv[1:]
want_open = '--open' in args
numbers = [a for a in args if a.isdigit()]
port = int(numbers[0]) if numbers else 8000
for candidate in range(port, port + 10):
    state = answering(candidate)
    if state == 'ours':
        print(f'Star Lattice is already running at http://localhost:{candidate}/app/')
        if want_open:
            open_app(candidate)
        sys.exit(0)
    if state is None:
        port = candidate
        break
    print(f'Port {candidate} is in use by something else; trying the next.')
else:
    print(f'No free port between {port} and {port + 9}: close something, or give another port (python serve.py 8100).')
    sys.exit(1)

server = Server(('', port), partial(Handler, directory=str(ROOT)))
print(f'Serving {ROOT} at http://localhost:{port}/app/ (tests: /test/)')
print('Star Lattice is running. Close this window (or press Ctrl+C) to stop it.')
if want_open:
    threading.Timer(0.3, open_app, args=(port,)).start()
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
