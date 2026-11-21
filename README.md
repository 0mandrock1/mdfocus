# mdfocus

A client-side raw-markdown reader with a "focus token" technique for attention
(contents, one-part reading, a progress rail, six-line focus window, bionic reading,
optional ambient animation, reading-width controls, a local resume position,
and optional brown/pink/white/violet noise), paired with a minimal
server-side fetch proxy so the browser can pull `.md`/text content from
external URLs that don't send CORS headers.

"Tokens" here means units of focus/attention (a UX technique), not LLM
tokens, and not auth tokens.

## Repo layout

```
web/index.html   static page (source controls, reading dock, contents, settings)
web/app.js       client logic: paste/upload/URL input, markdown render via
                 marked.js, reading parts, navigation, progress and resume,
                 six-line focus window, bionic reading, skim-responsive ambient,
                 narrow/full-width modes, and noise
web/interactions.js  sentence anchors and speech, hold-to-scroll, table cards
web/reader.js    reusable reader module for integrations
web/reader.css   reusable focus guide styles
web/og.png       Open Graph preview image
api/app.py       fetch proxy backend (stdlib http.server, no dependencies)
deploy.sh        idempotent deploy script, see below
```

## How the fetch proxy works

Browsers can't fetch arbitrary external URLs directly when the target
doesn't send CORS headers, so `web/app.js` calls the same-origin endpoint
`GET /mdfocus/api/fetch?url=<encoded-url>`, which nginx proxies to
`api/app.py` on `127.0.0.1:3466`.

`api/app.py` is a single-file stdlib `http.server` handler (no third-party
dependencies) that:

- only allows `http://` and `https://` URLs;
- resolves the target host via `socket.getaddrinfo()` and rejects it if any
  resolved address is private, loopback, link-local, reserved, multicast, or
  unspecified (`ipaddress.ip_address(...).is_private` etc.) — this blocks
  SSRF against internal/cloud-metadata addresses;
- connects directly to the already-validated IP (not the hostname) to close
  the DNS-rebind window between the check and the actual request, while
  still sending the original `Host` header for virtual-hosted targets;
- does not follow redirects (a 3xx upstream response is rejected with
  `400 redirects are not followed`, so a validated-then-redirected SSRF
  can't slip through);
- caps the response body at 2MB and the connection at a 10s timeout.

It runs as `www-data` under systemd, bound to `127.0.0.1` only (never
exposed directly to the internet; nginx is the only path in).

## External dependencies (not vendored in this repo)

`web/index.html` loads these at runtime from CDN/other mandrock.me services
— they are intentionally not copied into this repo:

- `https://files.mandrock.me/web/mandrock0-tokens.css` — shared design tokens
- `https://files.mandrock.me/web/mandrock0-ambient.js` — shared ambient
  background effect
- `https://tools.mandrock.me/palettes/accents.css` — shared accent palette
- `https://cdn.jsdelivr.net/npm/marked/marked.min.js` — markdown renderer

## Deploy

```sh
./deploy.sh
```

Idempotent: compares each repo file against its deployed counterpart with
`cmp`, copies over only what changed, and restarts the `mdfocus-api` systemd
unit only if `api/app.py` actually changed. Prints `no changes` and exits 0
if nothing needed to be copied. Never deletes anything.

Deploy targets (not part of this repo, see production paths below):

- `web/index.html` → `/var/www/html/mdfocus/index.html`
- `web/app.js` → `/var/www/html/mdfocus/app.js`
- `web/interactions.js` → `/var/www/html/mdfocus/interactions.js`
- `web/og.png` → `/var/www/html/mdfocus/og.png`
- `api/app.py` → `/opt/mdfocus-api/app.py`

## Production reference (nginx + systemd)

Served at `https://tools.mandrock.me/mdfocus/` (public, no auth). Deep link: `/mdfocus/?url=<public .md url>`. From the live nginx config
(`nginx -T`), the relevant locations are:

```nginx
# === MDFOCUS (static reader + SSRF-guarded fetch proxy on 127.0.0.1:3466) ===
location = /mdfocus { return 301 /mdfocus/; }
location /mdfocus/ {
    alias /var/www/html/mdfocus/;
    index index.html;
    try_files $uri $uri/ =404;
}
location /mdfocus/api/ {
    proxy_pass         http://127.0.0.1:3466/api/;
    proxy_http_version 1.1;
    proxy_set_header   Host $host;
    proxy_set_header   X-Real-IP $remote_addr;
}
```

systemd unit (`systemctl cat mdfocus-api`), no `Environment=` lines:

```ini
[Unit]
Description=mdfocus fetch proxy (SSRF-guarded external markdown fetch)
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/mdfocus-api
ExecStart=/usr/bin/python3 /opt/mdfocus-api/app.py
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

## Focus controls

- **Contents and navigation** jump between Markdown headings at any level. Longer
  sections and documents without headings are divided at Markdown block boundaries
  after roughly 450 words. A single large block, such as a code fence or a long
  paragraph, stays together.
- **One part at a time** keeps the current part visible. Switch back to continuous
  reading at the same place. The progress indicator tracks position in the text,
  including within a part.
- **Clickable URLs** turn plain `https://`, `www.` and custom `scheme://` text
  (such as `craftdocs://open` or `obsidian://open`) into links. Existing Markdown
  links and inline/fenced code remain unchanged; dangerous schemes are excluded.
- **Back to reading** records your position before a jump through the contents
  or a link within the document. One tap returns to that position, even after
  several jumps.
- **Sentence anchor** fixes the tapped line's vertical position while the
  document reflows. Tap **Якір** again to clear it.
- **Hold to scroll** runs while you hold **Пливти**. Move right to speed up or
  left to slow down. Space or Enter also works while the button has focus.
  The existing focus grip still adjusts the focus line by vertical dragging.
- **Read aloud from a sentence** uses your browser's speech synthesis service.
  Tap **Озвучити**, then a sentence. Pause leaves the current sentence marked,
  and resuming repeats that sentence. In one-part mode, speech stops at the end
  of the visible part. Set the language and speed (0.5×–3×) in settings.
  Speed is saved locally and applies when the next sentence starts.
- **Table cards** show the cells of one row with their column headings. Open
  them from the button above a table or tap a row on a touch screen. Swipe or use
  the arrow buttons to move through rows.
- **Bionic reading** bolds and italicizes the first part of words in prose and list text. Code,
  headings, and links retain their original markup. It is off by default.
- **Skim-responsive ambient** fades the shared ambient canvases as scroll speed
  rises, then restores them after scrolling settles. Turn off the animation in
  reader settings. Scroll-responsive fading is disabled when the browser requests
  reduced motion.
- **Reading width** offers a narrow 58-character lane or a full-width page.
  Both are off by default.
- **Focus guide** highlights at most six rendered lines from the viewport centre downward
  on one paragraph at a time. It shrinks at the paragraph end, then jumps
  to the next. Drag the grip beside the text to reposition it; the position
  is saved locally. The stronger accent rotates every 0.8 viewport.
- **Noise** offers brown, pink, white, and violet types. The volume slider
  uses a finer step and a squared gain curve for quieter low settings.
- **Continue reading** appears when a local position exists for the same
  Markdown text. Click it to restore the reading mode and position in the same
  Markdown block, even after the display width changes. Saved positions from
  earlier versions restore by scroll offset.
- Reader switches and positions are stored in browser localStorage. Audio never
  starts without a click. None of these values are sent to the server.

## Image demo (2026-11-21)

Open `/mdfocus/?url=https://tools.mandrock.me/mdfocus/demo-images.md` or tap “Демо зображень” in the source panel. Images are rendered as standard Markdown images; remote relative URLs resolve against the source Markdown URL. Tap, Enter or Space opens an accessible full-screen dialog. Escape, backdrop tap or the close control dismisses it. Three SVG screens are generated reproducibly with `python3 demo/make-screens.py`.

### PULSE CODE micro-session demonstrator

`pulse-code-demo.html` + `pulse-code-demo.js` are a **standalone, non-destructive UX demo**, not a filesystem or Git editor. It demonstrates a TypeScript-oriented micro-session, a 4-sector ring with a 52px inscribed target, pointer-up fallback, keyboard-accessible action sheet, an optional left-handed thumb dock, localStorage draft and review state. See `docs/pulse-code-product-brief.md` and the three generated screenshots from `python3 demo/make-micro-screens.py`. Link preview: `demo/make-pulse-og.py`.
