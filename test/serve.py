"""Mini-Server fuer den Mock: /_static/* liefert die Extension-Dateien,
jeder andere Pfad liefert mock.html – so laesst sich ein Dashboard-Pfad
wie /<accountid>/workers-and-pages nachbauen."""
import http.server, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class H(http.server.SimpleHTTPRequestHandler):
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
