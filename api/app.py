#!/usr/bin/env python3
"""mdfocus backend: server-side fetch proxy for external raw-markdown/text URLs.

Bound to 127.0.0.1:<PORT>. Runs as www-data (systemd mdfocus-api.service).

GET /api/fetch?url=<encoded-url>
    Fetches the given http(s) URL server-side and returns its body as
    text/plain (capped at 2MB). Exists so the browser can pull markdown
    from URLs that don't send CORS headers.

SSRF guard: resolves the target host via socket.getaddrinfo() and rejects
any resolved address that is loopback/private/link-local/reserved *before*
connecting. Only http/https schemes are allowed. Connects directly to the
validated IP (not the hostname) to avoid a DNS-rebind window between the
check and the request, while still sending the original Host header.

nginx strips /mdfocus/api/ down to /api/ via proxy_pass, so this handler
sees paths rooted at /api/fetch.
"""
import http.client
import http.server
import ipaddress
import socket
import socketserver
import ssl
from urllib.parse import urlsplit, parse_qs

PORT = 3466
MAX_BYTES = 2 * 1024 * 1024  # 2MB cap
TIMEOUT = 10  # seconds
USER_AGENT = "mdfocus-fetch/1.0 (+https://tools.mandrock.me/mdfocus/)"

_SSL_CTX = ssl.create_default_context()


def _is_blocked_ip(ip_str):
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return True
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    )


def _resolve_safe(host):
    """Resolve host to addr infos; return list of (family, sockaddr) if all
    resolved addresses are public, else None."""
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return None
    if not infos:
        return None
    resolved = []
    for family, _type, _proto, _canon, sockaddr in infos:
        ip_str = sockaddr[0]
        if _is_blocked_ip(ip_str):
            return None
        resolved.append((family, ip_str))
    return resolved


class Handler(http.server.BaseHTTPRequestHandler):
    server_version = "mdfocus-api/1.0"

    def log_message(self, *a):
        pass

    def _send_text(self, code, text, content_type="text/plain; charset=utf-8"):
        body = text.encode("utf-8", errors="replace")
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def do_GET(self):
        parts = urlsplit(self.path)
        if parts.path.rstrip("/") != "/api/fetch":
            self._send_text(404, "not found")
            return

        qs = parse_qs(parts.query)
        target = (qs.get("url") or [""])[0]
        if not target:
            self._send_text(400, "missing url param")
            return

        t = urlsplit(target)
        if t.scheme not in ("http", "https"):
            self._send_text(400, "only http/https urls allowed")
            return
        if not t.hostname:
            self._send_text(400, "invalid url: no host")
            return

        resolved = _resolve_safe(t.hostname)
        if not resolved:
            self._send_text(403, "rejected: target host resolves to a private/loopback/link-local/reserved address, or does not resolve")
            return

        family, ip_str = resolved[0]
        port = t.port or (443 if t.scheme == "https" else 80)
        path_q = t.path or "/"
        if t.query:
            path_q += "?" + t.query

        try:
            headers = {
                "Host": t.hostname if not t.port else f"{t.hostname}:{t.port}",
                "User-Agent": USER_AGENT,
                "Accept": "text/plain, text/markdown, text/x-markdown, */*",
            }

            if t.scheme == "https":
                conn = http.client.HTTPSConnection(t.hostname, port, timeout=TIMEOUT, context=_SSL_CTX)
                # Force the underlying socket to connect to the pre-validated IP
                # instead of re-resolving the hostname, to close the DNS-rebind
                # window between the getaddrinfo() check above and this request.
                # TLS SNI/cert verification still targets the real hostname.
                def _connect(ip=ip_str, prt=port, host=t.hostname, c=conn):
                    sock = socket.create_connection((ip, prt), timeout=TIMEOUT)
                    c.sock = _SSL_CTX.wrap_socket(sock, server_hostname=host)
                conn.connect = _connect
            else:
                conn = http.client.HTTPConnection(t.hostname, port, timeout=TIMEOUT)
                def _connect(ip=ip_str, prt=port, c=conn):
                    c.sock = socket.create_connection((ip, prt), timeout=TIMEOUT)
                conn.connect = _connect

            conn.request("GET", path_q, headers=headers)
            resp = conn.getresponse()

            if resp.status in (301, 302, 303, 307, 308):
                conn.close()
                self._send_text(400, "redirects are not followed; pass the final URL directly")
                return

            if resp.status != 200:
                body_preview = resp.read(200)
                conn.close()
                self._send_text(502, f"upstream returned {resp.status}: {body_preview.decode('utf-8', 'replace')}")
                return

            data = resp.read(MAX_BYTES + 1)
            conn.close()
            if len(data) > MAX_BYTES:
                self._send_text(413, "response exceeds 2MB cap")
                return

            self._send_text(200, data.decode("utf-8", errors="replace"))
        except (socket.timeout, TimeoutError):
            self._send_text(504, "upstream fetch timed out")
        except OSError as e:
            self._send_text(502, f"fetch failed: {e}")
        except Exception as e:
            self._send_text(502, f"fetch failed: {e}")


if __name__ == "__main__":
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("127.0.0.1", PORT), Handler) as srv:
        srv.serve_forever()
