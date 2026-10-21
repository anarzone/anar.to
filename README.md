# anar.to

The personal site of Anar Hagverdiyev, a backend developer in Köln, at [anar.to](https://anar.to).

It is printed like a riso zine: product posters that open working pieces of the real products (Curiplay, Expadu, FocusGuard), a CV drawn as a cycling stage race with climbs you can play, and an SQL time trial against a real SQLite database running in the browser.

No framework and no dependencies at runtime: hand-written HTML, CSS and JavaScript, put together by a small Python build. No cookies, no analytics, and nothing loads from other servers.

## Layout

| Path | What it holds |
|---|---|
| `src/body.html`, `src/base.css`, `src/machines.css`, `src/app.js` | the page itself |
| `src/route.js` | The Route: the CV as a stage race, the GitHub calendar, the plain CV and `cv.json` |
| `src/cp.*`, `src/ex.*`, `src/fg.*` | the product dialogs (Curiplay, Expadu, FocusGuard), each in its own design |
| `src/m-*.html/.css/.js` | the playable climbs and the SQL time trial (picked up automatically) |
| `src/legal/` | Impressum and privacy policy |
| `src/fonts.css`, `assets/fonts/` | self-hosted fonts (SIL Open Font License or Apache 2.0) |
| `assets/vendor/sql.js-1.12.0/` | [sql.js](https://github.com/sql-js/sql.js) (MIT), SQLite compiled to WebAssembly |
| `assets/meta/` | icons and the share image, made by `scripts/render-meta.mjs` |
| `site.json` | title, description, Impressum details, feature switches |
| `server/` | the nginx config and the deploy receiver used on the server |

## Build and preview

```bash
python3 build.py              # writes dist/
python3 scripts/serve.py      # http://127.0.0.1:8099, with the same headers as production
```

`python3 build.py --release` also fails while a launch blocker remains (for example an empty Impressum street).
`python3 build.py --single preview.html` writes the whole site into one self-contained file, used for previews.

Other scripts:

- `scripts/update-github.py` refreshes the contribution calendar (`GH_TOKEN=$(gh auth token) python3 scripts/update-github.py`). The deploy runs it before every build.
- `scripts/fetch-fonts.py` downloads the Google Fonts once and writes `src/fonts.css`.
- `scripts/render-meta.mjs` renders `og.png`, the icons and `favicon.ico` with headless Chrome.

## Deploys

Every push to `main` runs `.github/workflows/deploy.yml`: it refreshes the GitHub calendar, builds with `--release`, streams `dist/` to the server over SSH and checks that anar.to serves the new build. Pull requests only build.

On the server, nginx serves `/var/www/anar.to/current`, a symlink to the live release in `/var/www/anar.to/releases/`. The deploy key belongs to a `deploy` user and is locked to one command, `server/deploy-receive.sh` (installed as `/usr/local/bin/anar-deploy`), which unpacks a release, checks it, switches `current` and keeps the last five releases.

```bash
ssh deploy@<server> list        # releases, the live one marked with *
ssh deploy@<server> rollback    # back to the release before the live one
```

Repository secrets: `DEPLOY_HOST` (the server's address), `DEPLOY_SSH_KEY` (the deploy key's private half) and `DEPLOY_KNOWN_HOSTS` (the server's host key line). Without them the workflow only builds.

First-time server setup: `server/setup-deploy-user.sh` (creates the deploy user) and `server/nginx/anar.to.conf` (the site's nginx config, behind the Cloudflare Tunnel).

## License

The code is MIT-licensed (see `LICENSE`). The words, images and product material (the CV, the Curiplay, Expadu and FocusGuard screens and the café render) are © Anar Hagverdiyev and not covered by it. The fonts keep their own licences (SIL Open Font License or Apache 2.0), and sql.js is MIT-licensed (`assets/vendor/sql.js-1.12.0/LICENSE`).
