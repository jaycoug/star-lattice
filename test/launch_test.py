r"""Stage 1: serve.py's launch behavior, on ports 8765-8771, with no browser opened.
Usage (from the project folder):  python test/launch_test.py .
The Windows launcher (Start Star Lattice.cmd) is checked by hand or from PowerShell:
  $env:STAR_LATTICE_NO_BROWSER='1'; & '.\Start Star Lattice.cmd' 8774   (with Star Lattice already on 8774: "already running")
"""
import json, os, subprocess, sys, time, urllib.request
root = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else ".")
env = {**os.environ, 'STAR_LATTICE_NO_BROWSER': '1'}
procs = []
results = []

def report(what, ok, extra=''):
    results.append(ok)
    print(('ok   ' if ok else 'FAIL ') + what + (f'  -- {extra}' if extra else ''))

def get(url):
    try:
        with urllib.request.urlopen(url, timeout=2) as r:
            return r.status, r.read(), r.geturl()
    except Exception as e:
        return None, str(e).encode(), url

def wait_for(port, secs=8):
    for _ in range(int(secs * 10)):
        if get(f'http://127.0.0.1:{port}/api/hello')[0] == 200:
            return True
        time.sleep(0.1)
    return False

def start(args, cwd=root):
    p = subprocess.Popen(args, cwd=cwd, env=env, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    procs.append(p)
    return p

try:
    a = start([sys.executable, 'serve.py', '8765'])
    report('serve.py starts on the port given', wait_for(8765))
    st, body, _ = get('http://127.0.0.1:8765/api/hello')
    hello = json.loads(body) if st == 200 else {}
    report('/api/hello names the app and this folder', hello.get('app') == 'star-lattice' and os.path.samefile(hello.get('root'), root), str(hello))
    st, body, final = get('http://127.0.0.1:8765/favicon.ico')
    report('/favicon.ico leads to the app icon', st == 200 and final.endswith('/app/icon.ico') and body[:4] == b'\0\0\1\0', final)
    st, body, _ = get('http://127.0.0.1:8765/app/')
    report('the app page links its icon', st == 200 and b'icon.svg' in body)

    out = subprocess.run([sys.executable, 'serve.py', '8765', '--open'], cwd=root, env=env, stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=20)
    report('a second start on the same port opens the running one and exits', out.returncode == 0 and 'already running at http://localhost:8765/app/' in out.stdout and '(would open http://localhost:8765/app/)' in out.stdout, out.stdout.strip())

    foreign = start([sys.executable, '-m', 'http.server', '8770', '--bind', '127.0.0.1'], cwd=os.path.dirname(root))
    time.sleep(1)
    b = start([sys.executable, '-u', 'serve.py', '8770', '--open'])
    report('a port taken by something else is skipped: the next free one is used', wait_for(8771))
    time.sleep(0.6)
    b.terminate()
    try: text = b.communicate(timeout=10)[0]
    except Exception as e: text = 'communicate: ' + str(e)
    report('…saying so, and opening the browser there', 'Port 8770 is in use by something else' in text and '(would open http://localhost:8771/app/)' in text, text.strip().replace('\n', ' | ')[:300])

    # The .cmd launcher is checked from PowerShell (Git Bash re-quotes its name).
finally:
    for p in procs:
        try:
            p.terminate()
        except Exception:
            pass
    # cmd's child python survives cmd's termination on Windows: stop anything still on the test ports.
    if os.name == 'nt':
        out = subprocess.run(['netstat', '-ano'], capture_output=True, text=True).stdout
        pids = {line.split()[-1] for line in out.splitlines() if any(f':{p} ' in line for p in range(8765, 8775)) and 'LISTENING' in line}
        for pid in pids:
            subprocess.run(['taskkill', '/PID', pid, '/F'], capture_output=True)
print(f'{sum(results)}/{len(results)} passed')
sys.exit(0 if all(results) else 1)
