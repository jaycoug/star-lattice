"""A small Chrome DevTools Protocol client, standard library only (stage 2), for checks in a real
browser: start headless Chrome or Edge, open a page, evaluate JavaScript in it, collect console
errors, set a file input, allow downloads.

    with Browser() as b:
        b.open('http://localhost:8000/app/')
        b.wait('!!document.querySelector(".state-bar")')
        print(b.eval('document.title'), b.errors)
"""
import base64
import json
import os
import shutil
import socket
import struct
import subprocess
import tempfile
import time
import urllib.request
from urllib.parse import urlsplit

CANDIDATES = [
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
]


def find_browser():
    for path in [os.environ.get('STAR_LATTICE_BROWSER')] + CANDIDATES:
        if path and os.path.exists(path):
            return path
    raise RuntimeError('No Chrome or Edge found (set STAR_LATTICE_BROWSER to its path).')


def free_port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


class Socket:
    """A minimal WebSocket client: text frames, client-masked, large frames, server pings."""

    def __init__(self, url):
        u = urlsplit(url)
        self.sock = socket.create_connection((u.hostname, u.port), timeout=30)
        key = base64.b64encode(os.urandom(16)).decode()
        self.sock.sendall((f'GET {u.path} HTTP/1.1\r\nHost: {u.hostname}:{u.port}\r\nUpgrade: websocket\r\n'
                           f'Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n').encode())
        head = b''
        while b'\r\n\r\n' not in head:
            head += self.sock.recv(1)
        if b' 101 ' not in head.split(b'\r\n')[0]:
            raise RuntimeError(f'WebSocket handshake failed: {head[:80]!r}')

    def send(self, text, opcode=1):
        data = text.encode() if isinstance(text, str) else text
        mask = os.urandom(4)
        n = len(data)
        head = bytes([0x80 | opcode])
        head += bytes([0x80 | n]) if n < 126 else (bytes([0x80 | 126]) + struct.pack('>H', n) if n < 65536 else bytes([0x80 | 127]) + struct.pack('>Q', n))
        self.sock.sendall(head + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))

    def _exact(self, n):
        out = b''
        while len(out) < n:
            chunk = self.sock.recv(n - len(out))
            if not chunk:
                raise ConnectionError('the browser closed the connection')
            out += chunk
        return out

    def recv(self):
        message = b''
        while True:
            b1, b2 = self._exact(2)
            n = b2 & 0x7f
            if n == 126:
                n = struct.unpack('>H', self._exact(2))[0]
            elif n == 127:
                n = struct.unpack('>Q', self._exact(8))[0]
            payload = self._exact(n)
            opcode = b1 & 0x0f
            if opcode == 9:
                self.send(payload, opcode=10)
                continue
            if opcode == 8:
                raise ConnectionError('the browser closed the connection')
            message += payload
            if b1 & 0x80:
                return message.decode('utf-8')


class Browser:
    def __init__(self, headless=True):
        self.headless = headless
        self.errors = []      # console errors, exceptions and failed loads, as text
        self.next_id = 0

    def __enter__(self):
        self.port = free_port()
        self.profile = tempfile.mkdtemp(prefix='sl-browser-')
        args = [find_browser(), f'--remote-debugging-port={self.port}', f'--user-data-dir={self.profile}',
                '--no-first-run', '--no-default-browser-check', '--disable-extensions', 'about:blank']
        if self.headless:
            args.insert(1, '--headless=new')
        if os.environ.get('CI'):   # a CI runner (GitHub Actions): Chrome's sandbox needs privileges it doesn't have
            args.insert(1, '--no-sandbox')
        self.proc = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(100):
            try:
                with urllib.request.urlopen(f'http://127.0.0.1:{self.port}/json/list', timeout=1) as r:
                    pages = [t for t in json.loads(r.read()) if t.get('type') == 'page']
                if pages:
                    break
            except Exception:
                pass
            time.sleep(0.1)
        else:
            raise RuntimeError('The browser didn’t start.')
        self.ws = Socket(pages[0]['webSocketDebuggerUrl'])
        for domain in ('Runtime', 'Log', 'Page', 'Network'):
            self.call(f'{domain}.enable')
        return self

    def __exit__(self, *exc):
        try:
            self.ws.sock.close()
        except Exception:
            pass
        self.proc.terminate()
        try:
            self.proc.wait(timeout=10)
        except Exception:
            self.proc.kill()
        shutil.rmtree(self.profile, ignore_errors=True)

    def _event(self, msg):
        m, p = msg.get('method'), msg.get('params', {})
        if m == 'Runtime.exceptionThrown':
            d = p['exceptionDetails']
            self.errors.append('exception: ' + (d.get('exception', {}).get('description') or d.get('text', '')).split('\n')[0])
        elif m == 'Runtime.consoleAPICalled' and p.get('type') == 'error':
            self.errors.append('console.error: ' + ' '.join(str(a.get('value', a.get('description', ''))) for a in p.get('args', [])))
        elif m == 'Log.entryAdded' and p['entry'].get('level') == 'error':
            self.errors.append(f"log: {p['entry'].get('text')} {p['entry'].get('url', '')}".strip())
        elif m == 'Network.loadingFailed' and not p.get('canceled'):
            self.errors.append(f"load failed: {p.get('errorText')}")

    def call(self, method, params=None, timeout=30):
        self.next_id += 1
        mine = self.next_id
        self.ws.send(json.dumps({'id': mine, 'method': method, 'params': params or {}}))
        end = time.time() + timeout
        while time.time() < end:
            msg = json.loads(self.ws.recv())
            if msg.get('id') == mine:
                if 'error' in msg:
                    raise RuntimeError(f"{method}: {msg['error'].get('message')}")
                return msg.get('result', {})
            self._event(msg)
        raise TimeoutError(method)

    def eval(self, expression, await_promise=True):
        r = self.call('Runtime.evaluate', {'expression': expression, 'awaitPromise': await_promise, 'returnByValue': True})
        if 'exceptionDetails' in r:
            raise RuntimeError('in page: ' + (r['exceptionDetails'].get('exception', {}).get('description') or r['exceptionDetails'].get('text', '')))
        return r.get('result', {}).get('value')

    def open(self, url):
        self.call('Page.navigate', {'url': url})
        self.wait('document.readyState === "complete"')

    def reload(self):
        self.call('Page.reload', {'ignoreCache': True})
        time.sleep(0.3)
        self.wait('document.readyState === "complete"')

    def wait(self, expression, timeout=15):
        end = time.time() + timeout
        while time.time() < end:
            try:
                if self.eval(f'!!({expression})'):
                    return True
            except RuntimeError:
                pass
            time.sleep(0.15)
        raise TimeoutError(f'waited {timeout}s for: {expression}')

    def downloads_to(self, folder):
        self.call('Browser.setDownloadBehavior', {'behavior': 'allow', 'downloadPath': str(folder)})

    def set_files(self, selector, paths):
        doc = self.call('DOM.getDocument', {'depth': -1, 'pierce': True})
        node = self.call('DOM.querySelector', {'nodeId': doc['root']['nodeId'], 'selector': selector})['nodeId']
        self.call('DOM.setFileInputFiles', {'nodeId': node, 'files': [str(p) for p in paths]})
