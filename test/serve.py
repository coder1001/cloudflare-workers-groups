"""Mini-Server fuer den Mock.

  /_static/*       -> Dateien der Extension
  /api/v4/...      -> nachgebaute Dashboard-API (paginiert)
  alles andere     -> mock.html, damit sich Pfade wie
                      /<accountid>/workers-and-pages nachstellen lassen

Die API antwortet absichtlich unbequem: /workers/services gibt 404 (damit der
Fallback auf /workers/scripts geprueft wird) und liefert 10 Eintraege pro
Seite, egal was per_page sagt.
"""
import http.server, json, os, sys, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

WORKERS = [f"worker-{i:02d}" for i in range(1, 24)] + [
    "shop-a-api", "shop-b-api", "monitoring", "cron-runner", "image-resizer",
]
PAGES = ["shop-a-web", "shop-b-web", "docs-site", "marketing-lp"]
PAGE_SIZE = 10  # Standard, wird von per_page ueberschrieben


def paginate(items, page, size=PAGE_SIZE):
    total_pages = max(1, (len(items) + size - 1) // size)
    chunk = items[(page - 1) * size: page * size]
    return chunk, {
        "page": page,
        "per_page": size,
        "count": len(chunk),
        "total_count": len(items),
        "total_pages": total_pages,
    }


class H(http.server.SimpleHTTPRequestHandler):
    def send_json(self, payload, status=200):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path.startswith("/api/v4/"):
            return self.api(parsed)
        return super().do_GET()

    MAX_PER_PAGE = 25  # wie beim echten Endpunkt: groessere Seiten -> HTTP 400

    def api(self, parsed):
        qs = urllib.parse.parse_qs(parsed.query)
        page = int(qs.get("page", ["1"])[0])
        per_page = int(qs.get("per_page", ["10"])[0])

        if per_page > self.MAX_PER_PAGE:
            return self.send_json(
                {"success": False,
                 "errors": [{"message": f"per_page darf hoechstens {self.MAX_PER_PAGE} sein"}]},
                400,
            )

        # Account-ID aus 32x "f" simuliert eine komplett unerreichbare API
        if "/accounts/" + "f" * 32 + "/" in parsed.path:
            return self.send_json(
                {"success": False, "errors": [{"message": "Authentication error"}]}, 403
            )

        if parsed.path.endswith("/workers/services"):
            return self.send_json(
                {"success": False, "errors": [{"message": "not found"}], "result": None}, 404
            )

        if parsed.path.endswith("/workers-and-pages/overview"):
            combined = [{"name": n, "type": "script"} for n in WORKERS] + [
                {"name": n, "type": "pages"} for n in PAGES
            ]
            chunk, info = paginate(combined, page, per_page)
            return self.send_json(
                {"success": True, "errors": [], "result": chunk, "result_info": info}
            )

        if parsed.path.endswith("/workers/scripts"):
            chunk, info = paginate(WORKERS, page, per_page)
            return self.send_json(
                {"success": True, "errors": [],
                 "result": [{"id": n, "created_on": "2026-01-01T00:00:00Z"} for n in chunk],
                 "result_info": info}
            )

        if parsed.path.endswith("/pages/projects"):
            chunk, info = paginate(PAGES, page, per_page)
            return self.send_json(
                {"success": True, "errors": [],
                 "result": [{"name": n} for n in chunk], "result_info": info}
            )

        return self.send_json({"success": False, "errors": [{"message": "unbekannt"}]}, 404)

    def end_headers(self):
        # Ohne das liefert der Browser alte Skriptstaende aus dem Cache aus –
        # man testet dann gegen Code, den man gerade geaendert zu haben glaubt.
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def translate_path(self, path):
        path = path.split("?")[0].split("#")[0]
        if path.startswith("/_static/"):
            return os.path.join(ROOT, path[len("/_static/"):])
        return os.path.join(ROOT, "test", "mock.html")

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8777
    http.server.HTTPServer(("127.0.0.1", port), H).serve_forever()
