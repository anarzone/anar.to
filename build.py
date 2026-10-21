"""Build anar.to. Standard library only.

    python3 build.py                     the site, in dist/ (index, 404, datenschutz, impressum if switched on, fingerprinted assets)
    python3 build.py --release           the same, but stops while a launch blocker remains (e.g. no Impressum street)
    python3 build.py --single FILE.html  one self-contained HTML file, for previews published as claude.ai artifacts
"""
import argparse, base64, datetime, hashlib, json, math, pathlib, re, shutil, subprocess, sys, urllib.parse
from html import escape

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / 'src'
ASSETS = ROOT / 'assets'
DIST = ROOT / 'dist'
SITE = json.loads((ROOT / 'site.json').read_text())
CV = json.loads((SRC / 'cv-data.json').read_text())
SQLJS = 'sql.js-1.12.0'


# ---------- CSS helpers (Curiplay's stylesheet is scoped to its dialog) ----------

def split_top(css):
    """Split CSS into top-level statements: ('rule', selector, body) or ('at', prelude, body)."""
    out, i, n = [], 0, len(css)
    while i < n:
        j = css.find('{', i)
        if j < 0:
            break
        prelude = css[i:j].strip()
        depth, k = 1, j + 1
        while k < n and depth:
            if css[k] == '{':
                depth += 1
            elif css[k] == '}':
                depth -= 1
            k += 1
        out.append(('at' if prelude.startswith('@') else 'rule', prelude, css[j + 1:k - 1]))
        i = k
    return out


def split_selectors(sel):
    parts, depth, cur = [], 0, ''
    for ch in sel:
        if ch in '([':
            depth += 1
        elif ch in ')]':
            depth -= 1
        if ch == ',' and depth == 0:
            parts.append(cur)
            cur = ''
        else:
            cur += ch
    parts.append(cur)
    return [p.strip() for p in parts if p.strip()]


def scope(css, root):
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    out = []
    for kind, prelude, body in split_top(css):
        if kind == 'at':
            if prelude.startswith('@media') or prelude.startswith('@supports'):
                out.append(f"{prelude} {{\n{scope(body, root)}\n}}")
            else:
                out.append(f"{prelude} {{{body}}}")
            continue
        sels = []
        for s in split_selectors(prelude):
            if s.startswith(':root'):
                sels.append(root + s[5:])
            elif s == 'body' or s.startswith('body ') or s.startswith('body['):
                sels.append(root + s[4:])
            else:
                sels.append(f"{root} {s}")
        out.append(f"{', '.join(sels)} {{{body}}}")
    return '\n'.join(out)


def zine_fonts(text):
    """Every font declaration that uses a type role also takes that role's variable-font settings."""
    return re.sub(r'(font(?:-family)?:[^;{}]*var\(--f-(display|body|type)\)[^;{}]*)', r'\1; font-variation-settings: var(--fv-\2)', text)


def blocks(text, name, keep):
    """Keep or drop <!-- @name --> ... <!-- /@name --> blocks."""
    return re.sub(rf'<!-- @{name} -->(.*?)<!-- /@{name} -->', (lambda m: m.group(1)) if keep else '', text, flags=re.S)


def burst():
    pts = []
    for k in range(24):
        a = k * math.pi / 12 - math.pi / 2
        r = 50 if k % 2 == 0 else 41
        pts.append(f"{50 + r * math.cos(a):.1f}% {50 + r * math.sin(a):.1f}%")
    return ', '.join(pts)


NOISE = ("<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'>"
         "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 .1  0 0 0 0 .09  0 0 0 0 .11  0 0 0 .1 0'/></filter>"
         "<rect width='100%' height='100%' filter='url(#n)'/></svg>")

CP_FONTS = [  # Curiplay's own fonts, used inside its dialog
    ('Fredoka One', 400, 'fredoka-one-latin-400-normal.woff2', '', 'swap'),
    ('Curiplay Display TR', 400, 'curiplay-display-tr-400-normal.woff2', 'U+011E-011F, U+0130, U+015E-015F', 'swap'),
    ('Nunito', 700, 'nunito-latin-700-normal.woff2', '', 'swap'),
    ('Nunito', 800, 'nunito-latin-800-normal.woff2', '', 'swap'),
    ('Nunito', 900, 'nunito-latin-900-normal.woff2', '', 'swap'),
    ('Material Symbols Outlined', '100 700', 'material-symbols-outlined-subset.woff2', '', 'block'),
]

# What each {{PLACEHOLDER}} in the sources points at
FILES = {
    'CAFE': 'img/cafe.webp', 'CAFE_COLOR': 'img/cafe-color.webp', 'EXPADU': 'img/expadu.webp', 'FG_ICON': 'img/fg.png',
    'EX_TODAY': 'img/ex-scr-today-600.webp', 'EX_TRIP_HEAD': 'img/ex-trip-head-600.webp', 'EX_TRIP_BODY': 'img/ex-trip-body-600.webp',
    'EX_PAPER': 'img/ex-scr-paper-600.webp', 'EX_EVENTS': 'img/ex-scr-events-600.webp', 'EX_POSTER_STREET': 'img/ex-poster-street-300.webp',
    'EX_POSTER_CINEMA': 'img/ex-poster-cinema-300.webp', 'EX_STREET': 'img/ex-street-1400.webp',
    'A_RIGHT': 'audio/right.mp3', 'A_WRONG': 'audio/wrong.mp3', 'A_COMPLETE': 'audio/complete.mp3', 'A_MONEY': 'audio/money.mp3',
}
MIME = {'.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2'}


def read(name):
    return (SRC / name).read_text()


def assemble(mode):
    """The page's CSS, body HTML and JS, before placeholders are filled."""
    cp_quiz = read('cp-quiz.css').replace(':focus { outline:none; }', '')
    cp_css = scope(cp_quiz + '\n' + read('cp-extra.css'), '#cp')
    cp_dialog = """
#cp { width: 100%; height: 100%; max-width: none; max-height: none; margin: 0; padding: 0; border: 0; overflow: auto; }
#cp::backdrop { background: rgba(58, 46, 57, 0.55); }
#cp[open] { animation: cp-in 0.4s cubic-bezier(0.2, 1.2, 0.35, 1); }
@keyframes cp-in { from { transform: translateY(40px); } to { transform: none; } }
@media (prefers-reduced-motion: reduce) { #cp[open] { animation: none; } }
"""
    fonts_cp = '\n'.join(
        f'@font-face {{ font-family: "{fam}"; font-style: normal; font-weight: {w}; font-display: {disp}; '
        f'src: url({{{{FONT:{f}}}}}) format("woff2");{f" unicode-range: {rng};" if rng else ""} }}'
        for fam, w, f, rng, disp in CP_FONTS)
    m_names = sorted(p.stem for p in SRC.glob('m-*.html'))
    base_css = zine_fonts(read('base.css') + '\n' + read('machines.css'))
    m_css = zine_fonts('\n'.join(read(f'{n}.css') for n in m_names if (SRC / f'{n}.css').exists()))
    css = '\n'.join([read('fonts.css') if mode == 'site' else '', fonts_cp, base_css, m_css, cp_dialog, cp_css, read('fg.css'), read('ex.css')])
    html = '\n'.join([read('body.html'), read('cp.html'), read('fg.html'), read('ex.html')] + [read(f'{n}.html') for n in m_names])
    html = blocks(html, 'site', mode == 'site')
    html = blocks(html, 'single', mode == 'single')
    html = blocks(html, 'ride-log', SITE['ride_log'])
    html = blocks(html, 'impressum', IMPRESSUM)
    js = '\n'.join([read('zine-data.js'), read('route.js'), read('cp.js'), read('fg.js'), read('ex.js')]
                   + [read(f'{n}.js') for n in m_names if (SRC / f'{n}.js').exists()] + [read('app.js')])
    return css, html, js


IMPRESSUM = SITE['impressum']['enabled']


def legal(name, release):
    who, imp = SITE['owner'], SITE['impressum']
    street = imp['street'] or ('' if release else '[Straße und Hausnummer]')
    # with the Impressum on, the privacy page names the full postal address; without it, the city and the email
    address = f"{street}<br>{imp['postcode']} {who['city']}, {who['country']}" if IMPRESSUM else f"{who['city']}, {who['country']}"
    text = read(f'legal/{name}.html')
    for k, v in {'NAME': who['name'], 'STREET': street, 'POSTCODE': imp['postcode'], 'CITY': who['city'], 'COUNTRY': who['country'],
                 'ADDRESS': address, 'EMAIL': who['email'], 'UPDATED': SITE['updated']}.items():
        text = text.replace('{{' + k + '}}', v)
    return text


def script_json(data):
    """JSON that is safe inside a <script> element."""
    return json.dumps(data, ensure_ascii=False).replace('</', '<\\/')


def cv_sheet():
    """The plain CV, printed into the page so that crawlers and readers without JavaScript get the whole CV."""
    who, edu = SITE['owner'], CV['prologue']
    roles = [s for s in reversed(CV['stages']) if s['id'] != 'baku']
    li = lambda items: '<ul>' + ''.join(f'<li>{escape(h)}</li>' for h in items) + '</ul>'
    team = lambda r: escape(r['team'] + (f" ({r['note']})" if r.get('note') else ''))
    return (f'<h1 id="cvd-h">{escape(who["name"])}</h1>\n'
            '<p class="t">Senior Backend Engineer · PHP | Symfony | Laravel | Domain-Driven Design</p>\n'
            f'<p class="c">{who["city"]}, Germany · {who["email"]} · anar.to · github.com/anarzone · linkedin.com/in/haqverdiyev</p>\n'
            f'<h2>Profile</h2><p>{escape(CV["profile"])}</p>\n<h2>Experience</h2>\n'
            + ''.join(f'<div class="role"><div class="row"><b>{team(r)}</b><b>{escape(r["dates"])}</b></div>'
                      f'<div class="row sub"><span>{escape(r["role"])}</span><span>{escape(r["place"])}</span></div><p>{escape(r["summary"])}</p>{li(r["highlights"])}</div>\n'
                      for r in roles)
            + '<h2>Earlier experience</h2>\n'
            + ''.join(f'<div class="role"><div class="row"><b>{escape(r["team"])} · {escape(r["role"])}</b><b>{escape(r["dates"])}</b></div>'
                      f'<div class="row sub"><span>{escape(r["place"])}</span></div></div>\n' for r in CV['earlier'])
            + li(CV['stages'][0]['highlights'])
            + '\n<h2>Selected projects</h2><ul>' + ''.join(f'<li><b>{escape(t)}.</b> {escape(d)}</li>' for t, d in CV['projects']) + '</ul>\n'
            + '<h2>Technical skills</h2><dl>' + ''.join(f'<div><dt>{escape(k)}:</dt> <dd>{escape(v)}</dd></div>' for k, v in CV['skills']) + '</dl>\n'
            + '<h2>Languages</h2><p>' + ' · '.join(f'{escape(l)} ({escape(v)})' for l, v in CV['languages']) + '</p>\n'
            + f'<h2>Education</h2><div class="row"><b>{escape(edu["team"])} · {escape(edu["role"])}</b><b>{escape(edu["dates"])}</b></div>'
            f'<div class="row sub"><span>{escape(edu["place"])}</span></div>')


def fill(text, subs):
    for k, v in subs.items():
        text = text.replace('{{' + k + '}}', v)
    left = sorted(set(re.findall(r'\{\{[A-Z_]+(?::[^}]*)?\}\}', text)))
    if left:
        sys.exit(f'unreplaced placeholders: {left}')
    return text


def node_check(path):
    if shutil.which('node'):
        r = subprocess.run(['node', '--check', str(path)], capture_output=True, text=True)
        if r.returncode:
            sys.exit(f'JavaScript syntax error:\n{r.stderr}')


# ---------- the single-file preview ----------

def build_single(out):
    css, html, js = assemble('single')
    data_uri = lambda rel: f"data:{MIME[pathlib.Path(rel).suffix]};base64," + base64.b64encode((ASSETS / rel).read_bytes()).decode()
    subs = {k: data_uri(v) for k, v in FILES.items()}
    # the dialog's first heading names it for screen readers
    imp_h2 = '<h2 id="legal-h" data-legal-anchor="impressum">'
    privacy_h2 = '<h2 data-legal-anchor="privacy">' if IMPRESSUM else '<h2 id="legal-h" data-legal-anchor="privacy">'
    subs.update({'NOISE': 'data:image/svg+xml,' + urllib.parse.quote(NOISE), 'BURST': burst(), 'GH_CAL': (ASSETS / 'data' / 'gh.json').read_text().strip(),
                 'CV': script_json(CV), 'CV_SHEET': cv_sheet(),
                 'SQLJS_BASE': f'https://cdnjs.cloudflare.com/ajax/libs/sql.js/{SQLJS.split("-")[1]}/',
                 'LEGAL_DIALOG': (legal('impressum', False).replace('<h1>', imp_h2).replace('</h1>', '</h2>') if IMPRESSUM else '')
                 + legal('datenschutz', False).replace('<h1>', privacy_h2).replace('</h1>', '</h2>')})
    css = re.sub(r'\{\{FONT:([^}]+)\}\}', lambda m: data_uri(f'fonts/{m.group(1)}'), css)
    google = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
              '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700..900'
              '&family=Recursive:slnt,wght,CASL,CRSV,MONO@-15..0,300..1000,0..1,0..1,0..1&family=Bricolage+Grotesque:opsz,wght@12..96,600..800'
              '&family=Geist:wght@400..700&family=Permanent+Marker&display=swap">')
    page = f'<title>anar.to preview</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n{google}\n<style>\n{css}\n</style>\n{html}\n<script>\n{js}\n</script>\n'
    page = fill(page, subs)
    out = pathlib.Path(out)
    out.write_text(page)
    check = out.with_suffix('.check.js')
    check.write_text(fill(js, subs))
    node_check(check)
    check.unlink()
    print(f'built {out.name}: {len(page.encode()) / 1024:.0f} KB')


# ---------- the site ----------

def fingerprint(rel, data=None):
    """Copy an asset to dist/assets with a content hash in its name; return its URL."""
    data = (ASSETS / rel).read_bytes() if data is None else data
    p = pathlib.PurePosixPath(rel)
    name = f"{p.stem}.{hashlib.sha256(data).hexdigest()[:10]}{p.suffix}"
    dest = DIST / 'assets' / p.parent / name
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    return f'/assets/{p.parent}/{name}' if str(p.parent) != '.' else f'/assets/{name}'


def head(title, description, path, css_url, extra=''):
    """path is the page's own address; None for the 404 page, which answers at every missing URL and stays out of search."""
    url = SITE['url'] + path if path else None
    where = f'<link rel="canonical" href="{url}">\n<meta name="robots" content="max-image-preview:large">' if url else '<meta name="robots" content="noindex">'
    og_url = f'<meta property="og:url" content="{url}">\n' if url else ''
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{description}">
{where}
<meta name="theme-color" content="#ECEAE4">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="anar.to">
{og_url}<meta property="og:title" content="{SITE['share_title'] if path == '/' else title}">
<meta property="og:description" content="{description}">
<meta property="og:image" content="{SITE['url']}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Don't take my word for it. Anar Hagverdiyev, backend developer in Köln.">
<meta name="twitter:card" content="summary_large_image">
{extra}<link rel="stylesheet" href="{css_url}">
"""


def chrome(html):
    """The masthead and footer from the front page, with links that work from any page."""
    mast = re.search(r'<header class="masthead-z wrap">.*?</header>', html, re.S).group(0)
    mast = mast.replace('href="#top"', 'href="/"').replace('href="#', 'href="/#')
    foot = re.search(r'<footer class="foot wrap">.*?</footer>', html, re.S).group(0)
    return mast, foot


# The sources behind each page; the last commit that touched them is the page's lastmod in the sitemap
SOURCES = {'/': ['src', ':(exclude)src/legal', 'assets/img', 'site.json'],
           '/impressum': ['src/legal/impressum.html', 'site.json'], '/datenschutz': ['src/legal/datenschutz.html', 'site.json']}


def changed(path):
    """The day a page's sources last changed in git (deploys need the full history), or today outside a checkout."""
    if shutil.which('git'):
        r = subprocess.run(['git', 'log', '-1', '--format=%cs', '--', *SOURCES[path]], cwd=ROOT, capture_output=True, text=True)
        if r.returncode == 0 and r.stdout.strip():
            return r.stdout.strip()
    return datetime.date.today().isoformat()


def structured_data():
    """schema.org for the front page: the site (Google takes its name from this) and the profile page about Anar."""
    who, home = SITE['owner'], SITE['url'] + '/'
    person = {'@type': 'Person', '@id': home + '#person', 'name': who['name'], 'alternateName': who['alternate_name'], 'url': home,
              'email': 'mailto:' + who['email'], 'jobTitle': 'Backend developer',
              'address': {'@type': 'PostalAddress', 'addressLocality': who['city'], 'addressCountry': 'DE'},
              'alumniOf': {'@type': 'CollegeOrUniversity', 'name': CV['prologue']['team']},
              'knowsAbout': CV['jerseys'][0]['items'], 'knowsLanguage': [l for l, _ in CV['languages']],
              'sameAs': ['https://github.com/anarzone', 'https://www.linkedin.com/in/haqverdiyev', 'https://www.instagram.com/anarzone/']}
    return {'@context': 'https://schema.org', '@graph': [
        {'@type': 'WebSite', '@id': home + '#website', 'url': home, 'name': 'anar.to', 'inLanguage': 'en'},
        {'@type': 'ProfilePage', '@id': home, 'url': home, 'name': SITE['title'], 'description': SITE['description'], 'inLanguage': 'en',
         'isPartOf': {'@id': home + '#website'}, 'dateModified': changed('/'), 'mainEntity': person}]}


def build_site(release):
    if release and IMPRESSUM and not SITE['impressum']['street'].strip():
        sys.exit('launch blocker: the Impressum is switched on but site.json impressum.street is empty (it needs a full postal address)')
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir()
    css, html, js = assemble('site')

    subs = {k: fingerprint(v) for k, v in FILES.items()}
    subs.update({'NOISE': fingerprint('img/noise.svg', NOISE.encode()), 'BURST': burst(),
                 'GH_CAL': (ASSETS / 'data' / 'gh.json').read_text().strip(), 'SQLJS_BASE': f'/assets/vendor/{SQLJS}/',
                 'CV': script_json(CV), 'CV_SHEET': cv_sheet()})
    fonts = {}
    def font(name):
        fonts[name] = fonts.get(name) or fingerprint(f'fonts/{name}')
        return fonts[name]
    css = re.sub(r'\{\{FONT:([^}]+)\}\}', lambda m: font(m.group(1)), css)
    css = re.sub(r'/assets/fonts/(google/[\w.-]+\.woff2)', lambda m: font(m.group(1)), css)
    shutil.copytree(ASSETS / 'vendor' / SQLJS, DIST / 'assets' / 'vendor' / SQLJS)

    css = fill(css, subs)
    js = fill(js, subs)
    css_url = fingerprint('site.css', css.encode())
    js_url = fingerprint('site.js', js.encode())
    node_check(DIST / js_url.lstrip('/'))

    preload = ''.join(f'<link rel="preload" href="{font(f)}" as="font" type="font/woff2" crossorigin>\n'
                      for f in ('google/recursive-latin-8.woff2', 'google/big-shoulders-display-latin-1.woff2'))
    extra = preload + f'<script src="{js_url}" defer></script>\n<script type="application/ld+json">{script_json(structured_data())}</script>\n'
    body = fill(html, subs)
    (DIST / 'index.html').write_text(head(SITE['title'], SITE['description'], '/', css_url, extra) + '</head>\n<body>\n' + body + '\n</body>\n</html>\n')

    mast, foot = chrome(body)
    def page(file, title, description, path, main, lang='en'):
        doc = (head(title, description, path, css_url) + '</head>\n<body class="doc-page">\n<div class="page-z">\n  ' + mast + '\n'
               + f'  <main class="doc wrap {main[0]}" lang="{lang}">\n{main[1]}\n  </main>\n  ' + foot + '\n</div>\n</body>\n</html>\n')
        (DIST / file).write_text(fill(doc, {}))
    if IMPRESSUM:
        page('impressum.html', 'Impressum · anar.to', 'Impressum für anar.to, die Website von Anar Hagverdiyev in Köln.', '/impressum', ('legal', legal('impressum', release)), 'de')
    page('datenschutz.html', 'Privacy · anar.to', 'How anar.to handles data: no cookies, no analytics, no trackers.', '/datenschutz', ('legal', legal('datenschutz', release)))
    page('404.html', 'Off route · anar.to', "This page isn't on anar.to.", None, ('lost', """    <p class="kicker">Error 404 · off route</p>
    <h1>Wrong turn.</h1>
    <p>This page isn't on the map. The route starts at the front page.</p>
    <a class="arcade" href="/">Back to the start <span aria-hidden="true">▸</span></a>"""))

    for f in sorted((ASSETS / 'meta').glob('*')) if (ASSETS / 'meta').exists() else []:
        if f.is_file() and not f.name.startswith('.'):
            shutil.copy2(f, DIST / f.name)
    (DIST / 'robots.txt').write_text(f"User-agent: *\nAllow: /\n\nSitemap: {SITE['url']}/sitemap.xml\n")
    urls = ''.join(f"  <url><loc>{SITE['url']}{p}</loc><lastmod>{changed(p)}</lastmod></url>\n" for p in ('/', *(['/impressum'] if IMPRESSUM else []), '/datenschutz'))
    (DIST / 'sitemap.xml').write_text(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}</urlset>\n')

    # every local URL the pages, the stylesheet and the script mention must exist
    missing = set()
    for f in [*DIST.glob('*.html'), DIST / css_url.lstrip('/'), DIST / js_url.lstrip('/')]:
        for url in re.findall(r'''(?:href|src)=["'](/[^"'#?]*)|url\((/[^)'"]+)\)|["'](/assets/[^"']+)["']''', f.read_text()):
            u = next(x for x in url if x)
            if u in ('/', '/impressum', '/datenschutz') or u.startswith(f'/assets/vendor/{SQLJS}/'):
                continue
            if not (DIST / u.lstrip('/')).exists():
                missing.add(u)
    if missing:
        sys.exit(f'missing files: {sorted(missing)}')
    size = sum(p.stat().st_size for p in DIST.rglob('*') if p.is_file())
    print(f"built dist/: {len(list(DIST.rglob('*.html')))} pages, {size / 1024:.0f} KB in total "
          f"(page {(DIST / 'index.html').stat().st_size / 1024:.0f} KB, css {(DIST / css_url.lstrip('/')).stat().st_size / 1024:.0f} KB, "
          f"js {(DIST / js_url.lstrip('/')).stat().st_size / 1024:.0f} KB)")


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--single', metavar='FILE', help='write one self-contained preview file instead of dist/')
    ap.add_argument('--release', action='store_true', help='fail while launch blockers remain')
    args = ap.parse_args()
    if args.single:
        build_single(args.single)
    else:
        build_site(args.release)
