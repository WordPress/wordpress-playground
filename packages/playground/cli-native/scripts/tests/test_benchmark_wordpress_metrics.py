from __future__ import annotations

import importlib.util
import io
import os
import pathlib
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest import mock


SCRIPT_DIR = pathlib.Path(__file__).resolve().parents[1]
FIXTURES = pathlib.Path(__file__).resolve().parent / "fixtures"
MODULE_PATH = SCRIPT_DIR / "benchmark-wordpress-metrics.py"
SPEC = importlib.util.spec_from_file_location("benchmark_wordpress_metrics", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
metrics = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = metrics
SPEC.loader.exec_module(metrics)


class QuietHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_GET(self) -> None:
        if self.path.startswith("/wp-admin/post-new.php"):
            body = b'<body class="wp-admin post-new-php">editor</body>'
        else:
            body = self.path.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: object) -> None:
        pass


class RedirectToLoginHandler(QuietHandler):
    def do_GET(self) -> None:
        if self.path.startswith("/wp-admin/post-new.php"):
            self.send_response(302)
            self.send_header(
                "Location", "/wp-login.php?redirect_to=/wp-admin/post-new.php"
            )
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        if self.path.startswith("/wp-login.php"):
            body = b'<form id="loginform">/wp-admin/post-new.php</form>'
            self.send_response(200)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()


class BenchmarkWordpressMetricsTest(unittest.TestCase):
    def test_cookie_file_parses_regular_and_http_only_cookies(self) -> None:
        contents = (
            "# Netscape HTTP Cookie File\n"
            "127.0.0.1\tFALSE\t/\tFALSE\t0\tplain\tone\n"
            "#HttpOnly_127.0.0.1\tFALSE\t/\tFALSE\t0\tsecret\ttwo\n"
        )
        with tempfile.TemporaryDirectory() as temp_dir:
            cookie_file = pathlib.Path(temp_dir) / "cookies.txt"
            cookie_file.write_text(contents, encoding="utf-8")
            self.assertEqual(
                metrics.parse_cookie_file(cookie_file), "plain=one; secret=two"
            )

    def test_sustained_load_is_equal_mix_with_mocked_process_rss(self) -> None:
        server = ThreadingHTTPServer(("127.0.0.1", 0), QuietHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with mock.patch.object(
                metrics,
                "process_tree_rss_bytes",
                return_value=42 * 1024 * 1024,
            ):
                result = metrics.run_load(
                    base_url=f"http://127.0.0.1:{server.server_port}",
                    cookie_header="",
                    server_pid=os.getpid(),
                    duration_seconds=0.08,
                    concurrency=4,
                    timeout_seconds=2,
                    rss_sample_interval=0.01,
                )
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

        self.assertEqual(result.errors, 0)
        self.assertEqual(result.successes, result.requests)
        self.assertGreater(result.successful_rps, 0)
        self.assertEqual(result.peak_tree_rss_mib, 42)
        self.assertGreater(result.requests, 0)
        self.assertEqual(len(set(result.route_requests.values())), 1)
        self.assertEqual(sum(result.route_requests.values()), result.requests)
        self.assertEqual(
            len(result.as_tsv().split("\t")), len(metrics.LOAD_RESULT_COLUMNS)
        )

    def test_sustained_load_rejects_editor_redirect_to_login(self) -> None:
        server = ThreadingHTTPServer(("127.0.0.1", 0), RedirectToLoginHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with mock.patch.object(
                metrics,
                "process_tree_rss_bytes",
                return_value=42 * 1024 * 1024,
            ):
                result = metrics.run_load(
                    base_url=f"http://127.0.0.1:{server.server_port}",
                    cookie_header="",
                    server_pid=os.getpid(),
                    duration_seconds=0.04,
                    concurrency=4,
                    timeout_seconds=2,
                    rss_sample_interval=0.01,
                )
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

        self.assertEqual(result.errors, result.route_requests["editor"])
        self.assertEqual(result.successes + result.errors, result.requests)
        self.assertGreater(result.errors, 0)
        self.assertTrue(
            any(
                "editor redirected to /wp-login.php" in error
                for error in result.error_samples
            )
        )

    def test_sustained_load_returns_external_lifetime_rss_peak(self) -> None:
        server = ThreadingHTTPServer(("127.0.0.1", 0), QuietHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                peak_path = pathlib.Path(temp_dir) / "peak-rss.txt"
                peak_path.write_text("42.125\n", encoding="utf-8")
                result = metrics.run_load(
                    base_url=f"http://127.0.0.1:{server.server_port}",
                    cookie_header="",
                    server_pid=os.getpid(),
                    duration_seconds=0.04,
                    concurrency=4,
                    timeout_seconds=2,
                    rss_sample_interval=0.01,
                    sample_rss=False,
                    external_peak_rss_path=peak_path,
                )
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

        self.assertEqual(result.peak_tree_rss_mib, 42.125)
        self.assertEqual(result.errors, 0)

    def test_lifetime_rss_sampler_writes_recursive_maximum(self) -> None:
        mebibyte = 1024 * 1024
        sampled_values = iter((10 * mebibyte, 30 * mebibyte, 20 * mebibyte))
        samples: list[int] = []

        def process_tree_rss(_root_pid: int) -> int:
            value = next(sampled_values, 20 * mebibyte)
            samples.append(value)
            return value

        stop_event = threading.Event()

        def stop_after_three_samples() -> None:
            while len(samples) < 3:
                stop_event.wait(0.001)
            stop_event.set()

        stopper = threading.Thread(target=stop_after_three_samples)
        stopper.start()
        with tempfile.TemporaryDirectory() as temp_dir:
            output_path = pathlib.Path(temp_dir) / "peak-rss.txt"
            with mock.patch.object(
                metrics, "process_tree_rss_bytes", side_effect=process_tree_rss
            ):
                peak = metrics.run_rss_sampler(
                    root_pid=os.getpid(),
                    interval_seconds=0.001,
                    output_path=output_path,
                    stop_event=stop_event,
                )
            self.assertEqual(output_path.read_text(encoding="utf-8"), "30.000\n")
        stopper.join()
        self.assertEqual(peak, 30.0)

    def test_nearest_rank_p95_uses_ceiling_rank(self) -> None:
        values = [float(value) for value in range(1, 31)]
        self.assertEqual(metrics.nearest_rank_percentile(values, 0.95), 29.0)
        self.assertEqual(metrics.nearest_rank_percentile(values, 0.50), 15.0)

    def test_objective_gate_accepts_boundary_fixture(self) -> None:
        rows = metrics.read_result_rows(
            FIXTURES / "benchmark-wordpress-objective-pass.tsv"
        )
        output = io.StringIO()
        self.assertTrue(
            metrics.objective_gate(
                rows,
                candidate_label="wasmtime",
                native_label="native-php",
                max_route_ratio=1.40,
                min_rps_ratio=0.70,
                max_rss_ratio=1.50,
                output=output,
            )
        )
        self.assertIn("objective_gate_result\tPASS", output.getvalue())

    def test_objective_gate_reports_latency_rps_error_and_rss_failures(self) -> None:
        rows = metrics.read_result_rows(
            FIXTURES / "benchmark-wordpress-objective-fail.tsv"
        )
        output = io.StringIO()
        self.assertFalse(
            metrics.objective_gate(
                rows,
                candidate_label="wasmtime",
                native_label="native-php",
                max_route_ratio=1.40,
                min_rps_ratio=0.70,
                max_rss_ratio=1.50,
                output=output,
            )
        )
        report = output.getvalue()
        self.assertIn("home_p95_ms\t29.000\t20.000\t1.450x\t<=1.40x\t0", report)
        self.assertIn("successful_rps\t69.000\t100.000\t0.690x\t>=0.70x\t0", report)
        self.assertIn("peak_tree_rss_mib\t151.000\t100.000\t1.510x\t<=1.50x\t0", report)
        self.assertIn("load_errors\t1\t0\tn/a\t=0\t0", report)
        self.assertIn("objective_gate_result\tFAIL", report)

    def test_objective_gate_rejects_unequal_route_mix(self) -> None:
        rows = metrics.read_result_rows(
            FIXTURES / "benchmark-wordpress-objective-pass.tsv"
        )
        rows["wasmtime"]["load_home_requests"] = "41"
        output = io.StringIO()
        self.assertFalse(
            metrics.objective_gate(
                rows,
                candidate_label="wasmtime",
                native_label="native-php",
                max_route_ratio=1.40,
                min_rps_ratio=0.70,
                max_rss_ratio=1.50,
                output=output,
            )
        )
        self.assertIn("equal_route_mix\t41/40/40/40", output.getvalue())


if __name__ == "__main__":
    unittest.main()
