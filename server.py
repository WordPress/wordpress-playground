import http.server
import socketserver
import os
import signal
import sys

original_dir = os.getcwd()
http_cache_enabled = True

socketserver.TCPServer.allow_reuse_address = True

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    
    def end_headers(self):
        if not http_cache_enabled:
            self.send_no_cache_headers()
        super().end_headers()

    def send_no_cache_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")

    def do_GET(self):
        global http_cache_enabled
        if self.path in ['/switch-to-new-version', '/switch-to-old-version', '/disable-http-cache', '/enable-http-cache']:
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()

            if self.path == '/switch-to-new-version':
                os.chdir(original_dir)
                os.chdir(new_version_directory)
                self.wfile.write(b"<html><body>Switched to the new version</body>")
            elif self.path == '/switch-to-old-version':
                os.chdir(original_dir)
                os.chdir(old_version_directory)
                self.wfile.write(b"<html><body>Switched to the old version</body>")
            elif self.path == '/disable-http-cache':
                http_cache_enabled = False
                self.wfile.write(b"<html><body>HTTP cache disabled</body>")
            elif self.path == '/enable-http-cache':
                http_cache_enabled = True
                self.wfile.write(b"<html><body>HTTP cache enabled</body>")
        else:
            if "switch-to-new-version" in self.path:
                os.chdir(original_dir)
                os.chdir(new_version_directory)
            elif "switch-to-old-version" in self.path:
                os.chdir(original_dir)
                os.chdir(old_version_directory)
            super().do_GET()

def run_server(directory, port):
    os.chdir(directory)
    handler = NoCacheHandler
    with socketserver.TCPServer(("", port), handler) as httpd:
        print(f"Serving directory '{directory}' on port {port}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            print("\nShutting down the server...")
            httpd.server_close()

def signal_handler(sig, frame):
    print("\nReceived signal to terminate. Shutting down...")
    sys.exit(0)

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python script.py <port> <directory1> <directory2>")
        sys.exit(1)

    port = int(sys.argv[1])
    old_version_directory = sys.argv[2]
    new_version_directory = sys.argv[3]

    if not os.path.isdir(old_version_directory) or not os.path.isdir(new_version_directory):
        print(f"Error: '{old_version_directory}' or '{new_version_directory}' is not a valid directory")
        sys.exit(1)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    run_server(old_version_directory, port)
