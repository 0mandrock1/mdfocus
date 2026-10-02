# mdfocus

A client-side raw-markdown reader with a "focus token" technique for attention
(section-by-section dwell timer + progress rail), paired with a minimal
server-side fetch proxy so the browser can pull `.md`/text content from
external URLs that don't send CORS headers.

"Tokens" here means units of focus/attention (a UX technique), not LLM
tokens, and not auth tokens.

## Repo layout

```
web/index.html   static page (reader UI, token/dwell logic markup)
web/app.js       client logic: paste/upload/URL input, markdown render via
                 marked.js, h1/h2 section splitting, dwell timer + progress
                 rail, per-section reflections stored in localStorage only
                 (nothing from reflections is sent to the server)
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
- `web/og.png` → `/var/www/html/mdfocus/og.png`
- `api/app.py` → `/opt/mdfocus-api/app.py`

## Production reference (nginx + systemd)

Served at `https://tools.mandrock.me/mdfocus/`. From the live nginx config
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

Note: as of this snapshot the live `/mdfocus/` location has no
`auth_basic` directive, even though the host's infra notes mention one for
this app elsewhere — that's a documentation/reality drift on the server
side, not something this repo controls. Check the live config before
relying on it.

systemd unit (`systemctl cat mdfocus-api`), secrets/Environment= stripped
(there were none to strip — the live unit has no `Environment=` lines):

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
