"""Serve dist/ the way the server's nginx does: clean URLs, the 404 page and the same security headers.

    python3 scripts/serve.py [port]      then open http://127.0.0.1:8099
"""
import http.server
import pathlib
import sys

DIST = pathlib.Path(__file__).resolve().parent.parent / 'dist'
# Keep in sync with server/nginx/anar.to.conf
HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; "
                               "font-src 'self'; media-src 'self'; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'",
}


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.wasm': 'application/wasm', '.woff2': 'font/woff2',
                      '.js': 'application/javascript', '.webp': 'image/webp'}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIST), **kwargs)

    def send_head(self):
        # try_files $uri $uri/ $uri.html =404
        path = self.path.split('?', 1)[0].split('#', 1)[0]
        target = DIST / path.lstrip('/')
        if path != '/' and not target.exists() and (DIST / (path.lstrip('/') + '.html')).exists():
            self.path = path + '.html'
        elif path != '/' and not target.exists():
            body = (DIST / '404.html').read_bytes()
            self.send_response(404)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return None
        return super().send_head()

    def end_headers(self):
        for k, v in HEADERS.items():
            self.send_header(k, v)
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8099
    print(f'serving dist/ on http://127.0.0.1:{port}')
    http.server.ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
