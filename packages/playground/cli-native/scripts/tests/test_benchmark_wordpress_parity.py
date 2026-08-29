from __future__ import annotations

import argparse
import importlib.util
import json
import pathlib
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


SCRIPT_DIR = pathlib.Path(__file__).resolve().parents[1]
MODULE_PATH = SCRIPT_DIR / "benchmark-wordpress-parity.py"
SPEC = importlib.util.spec_from_file_location("benchmark_wordpress_parity", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
parity = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = parity
SPEC.loader.exec_module(parity)


class RecordingHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    requests: list[tuple[str, str | None]] = []
    lock = threading.Lock()

    def do_GET(self) -> None:
        if self.path.startswith("/wp-admin/post-new.php"):
            body = (
                b'<html><body class="post-new-php">'
                + b"x" * 1001
                + b"</body></html>"
            )
        else:
            body = b"<html>" + b"x" * 1001 + b"</html>"
        with self.lock:
            self.requests.append((self.path, self.headers.get("Cookie")))
        self.send_response(200)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: object) -> None:
        pass


class BenchmarkWordPressParityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), RecordingHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def setUp(self) -> None:
        with RecordingHandler.lock:
            RecordingHandler.requests.clear()

    def run_load(
        self, workload: str, cookie_scope: str
    ) -> list[tuple[str, str | None]]:
        request_count = {"public": 3, "mixed": 4, "admin": 1}[workload]
        with tempfile.TemporaryDirectory() as temp_dir:
            root = pathlib.Path(temp_dir)
            cookie_file = root / "cookies.txt"
            cookie_file.write_text(
                "# Netscape HTTP Cookie File\n"
                "#HttpOnly_127.0.0.1\tFALSE\t/\tFALSE\t0\tlogin\tsecret\n",
                encoding="utf-8",
            )
            output = root / "load.json"
            status = parity.load_command(
                argparse.Namespace(
                    base_url=f"http://127.0.0.1:{self.server.server_port}",
                    cookie_file=cookie_file,
                    workload=workload,
                    post_path="/?p=1",
                    concurrency=1,
                    requests_per_worker=request_count,
                    cookie_scope=cookie_scope,
                    timeout=2,
                    label="wasmtime",
                    round=1,
                    output=output,
                )
            )
            self.assertEqual(status, 0)
            result = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(result["summary"]["errors"], 0)
            self.assertEqual(result["summary"]["successes"], request_count)
        with RecordingHandler.lock:
            return list(RecordingHandler.requests)

    def test_local_url_parser_rejects_non_loopback_and_ambiguous_origins(self) -> None:
        parsed = parity.parse_local_url("http://127.0.0.1:9400")
        self.assertEqual(parsed.port, 9400)
        for value in (
            "https://127.0.0.1:9400",
            "http://example.com:9400",
            "http://127.0.0.1",
            "http://user@127.0.0.1:9400",
            "http://127.0.0.1:9400/path",
        ):
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    parity.parse_local_url(value)

    def test_workload_routes_and_percentile_are_deterministic(self) -> None:
        self.assertEqual(
            [name for name, _ in parity.workload_routes("public", "/?p=1")],
            ["home", "search", "post"],
        )
        self.assertEqual(
            [name for name, _ in parity.workload_routes("mixed", "/?p=1")],
            ["home", "search", "post", "editor"],
        )
        self.assertEqual(
            parity.workload_routes("admin", "/?p=1"),
            (("editor", "/wp-admin/post-new.php"),),
        )
        self.assertEqual(parity.percentile([4, 1, 3, 2], 0.95), 4)
        with self.assertRaises(ValueError):
            parity.workload_routes("unknown", "/?p=1")
        with self.assertRaises(ValueError):
            parity.workload_routes("public", "http://example.test/")

    def test_public_scope_never_sends_authentication_cookie(self) -> None:
        requests = self.run_load("public", "none")
        self.assertEqual(len(requests), 3)
        self.assertTrue(all(cookie is None for _, cookie in requests))

    def test_mixed_scope_authenticates_only_the_admin_route(self) -> None:
        requests = self.run_load("mixed", "admin")
        self.assertEqual(len(requests), 4)
        for path, cookie in requests:
            if path.startswith("/wp-admin/post-new.php"):
                self.assertEqual(cookie, "login=secret")
            else:
                self.assertIsNone(cookie)

    def test_admin_scope_authenticates_every_request(self) -> None:
        requests = self.run_load("admin", "all")
        self.assertEqual(requests, [("/wp-admin/post-new.php", "login=secret")])

    def test_response_validation_requires_real_html_and_editor_marker(self) -> None:
        self.assertTrue(
            parity.response_is_valid(
                "home", 200, b"<html>" + b"x" * 1001 + b"</html>"
            )
        )
        self.assertFalse(parity.response_is_valid("home", 500, b"x" * 2000))
        self.assertFalse(parity.response_is_valid("home", 200, b"short"))
        self.assertTrue(parity.response_is_valid("editor", 200, b"post-new-php"))
        self.assertFalse(parity.response_is_valid("editor", 200, b"loginform"))

    def test_summary_uses_arithmetic_mean_for_outlier_rounds(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = pathlib.Path(temp_dir)
            runs = root / "runs"
            runs.mkdir()
            for label, rates in (
                ("wasmtime", (10, 10, 10, 50)),
                ("native-php", (10, 10, 10, 10)),
            ):
                for round_number, rate in enumerate(rates, start=1):
                    artifact = {
                        "label": label,
                        "concurrency": 6,
                        "workload": "public",
                        "summary": {
                            "errors": 0,
                            "successful_rps": rate,
                            "ttfb_p50_ms": rate,
                            "ttfb_p95_ms": rate,
                            "total_p50_ms": rate,
                            "total_p95_ms": rate,
                        },
                    }
                    (runs / f"{label}-{round_number}.json").write_text(
                        json.dumps(artifact), encoding="utf-8"
                    )
            output_prefix = root / "summary"
            status = parity.summarize_command(
                argparse.Namespace(
                    runs_dir=runs,
                    workload="public",
                    native_label="wasmtime",
                    fpm_label="native-php",
                    output_prefix=output_prefix,
                )
            )
            self.assertEqual(status, 0)
            summary = json.loads(
                output_prefix.with_suffix(".json").read_text(encoding="utf-8")
            )
            wasmtime = next(
                row for row in summary["rows"] if row["backend"] == "wasmtime"
            )
            self.assertEqual(wasmtime["successful_rps"], 20)
            self.assertEqual(
                summary["protocol"]["aggregation"],
                "arithmetic mean of per-round metrics",
            )


if __name__ == "__main__":
    unittest.main()
