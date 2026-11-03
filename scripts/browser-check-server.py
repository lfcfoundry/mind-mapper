"""Optional local Chrome verification server; Python standard library only."""
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from functools import partial
import json
import base64

ROOT = Path(__file__).resolve().parent.parent

class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.split('?')[0] == '/browser-check.html':
            payload = (ROOT / 'test/browser-check.html').read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.end_headers()
            self.wfile.write(payload)
        else:
            super().do_GET()

    def do_POST(self):
        length = int(self.headers.get('Content-Length', '0'))
        if self.path != '/report' or not 0 < length < 2_000_000:
            self.send_error(400)
            return
        report = json.loads(self.rfile.read(length))
        canvas = report.pop('canvas', None)
        if canvas:
            (ROOT / 'dist/browser-canvas.png').write_bytes(base64.b64decode(canvas.split(',')[1]))
        (ROOT / 'dist/browser-results.json').write_text(json.dumps(report, indent=2))
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'OK')

if __name__ == '__main__':
    print('Open http://127.0.0.1:8766/browser-check.html in your browser.', flush=True)
    HTTPServer(('127.0.0.1', 8766), partial(Handler, directory=str(ROOT / 'dist'))).serve_forever()
