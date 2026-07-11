#!/usr/bin/env python3
"""Collect sustained WordPress load metrics and enforce the native-speed objective."""

from __future__ import annotations

import argparse
import concurrent.futures
import csv
import http.client
import math
import os
import pathlib
import signal
import subprocess
import sys
import threading
import time
import urllib.parse
from dataclasses import dataclass
from typing import Iterable, Mapping, Sequence


ROUTES = (
    ("home", "/"),
    ("search", "/?s=hello"),
    ("post", "/?p=1"),
    ("editor", "/wp-admin/post-new.php"),
)
EDITOR_ROUTE = "editor"
EDITOR_PATH = "/wp-admin/post-new.php"
EDITOR_PAGE_MARKER = b"post-new-php"
ROUTE_METRICS = tuple(
    f"{route}_{percentile}_ms"
    for route, _ in ROUTES
    for percentile in ("p50", "p95")
)
LOAD_RESULT_COLUMNS = (
    "load_duration_s",
    "load_requests",
    "load_successes",
    "load_errors",
    "successful_rps",
    "peak_tree_rss_mib",
    *(f"load_{route}_requests" for route, _ in ROUTES),
)


@dataclass(frozen=True)
class RequestResult:
    route: str
    elapsed_seconds: float
    status: int | None
    error: str | None = None

    @property
    def successful(self) -> bool:
        return self.error is None and self.status is not None and 200 <= self.status < 300


@dataclass(frozen=True)
class LoadResult:
    duration_seconds: float
    requests: int
    successes: int
    errors: int
    successful_rps: float
    peak_tree_rss_mib: float
    route_requests: Mapping[str, int]
    error_samples: Sequence[str]

    def as_tsv(self) -> str:
        values: list[str] = [
            f"{self.duration_seconds:.3f}",
            str(self.requests),
            str(self.successes),
            str(self.errors),
            f"{self.successful_rps:.3f}",
            f"{self.peak_tree_rss_mib:.3f}",
        ]
        values.extend(str(self.route_requests[route]) for route, _ in ROUTES)
        return "\t".join(values)


class ProcessTreeRssSampler:
    def __init__(self, root_pid: int, interval_seconds: float) -> None:
        self.root_pid = root_pid
        self.interval_seconds = interval_seconds
        self.peak_bytes = 0
        self.samples = 0
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, name="rss-sampler", daemon=True)

    def start(self) -> None:
        self._sample()
        self._thread.start()

    def stop(self) -> float:
        self._stop.set()
        self._thread.join()
        self._sample()
        if self.samples == 0:
            raise RuntimeError(f"could not sample RSS for process tree rooted at {self.root_pid}")
        return self.peak_bytes / (1024 * 1024)

    def _run(self) -> None:
        while not self._stop.wait(self.interval_seconds):
            self._sample()

    def _sample(self) -> None:
        rss_bytes = process_tree_rss_bytes(self.root_pid)
        if rss_bytes > 0:
            self.samples += 1
            self.peak_bytes = max(self.peak_bytes, rss_bytes)


class HttpWorker:
    def __init__(self, base_url: str, cookie_header: str, timeout_seconds: float) -> None:
        parsed = urllib.parse.urlsplit(base_url)
        if parsed.scheme != "http" or not parsed.hostname:
            raise ValueError("base URL must be an http:// URL with a host")
        self.host = parsed.hostname
        self.port = parsed.port or 80
        self.base_path = parsed.path.rstrip("/")
        self.cookie_header = cookie_header
        self.timeout_seconds = timeout_seconds
        self._local = threading.local()
        self._connections: set[http.client.HTTPConnection] = set()
        self._connections_lock = threading.Lock()

    def request(self, route: str, route_path: str) -> RequestResult:
        started = time.perf_counter()
        try:
            status, final_path, editor_marker_found = self._request_following_redirects(
                self.base_path + route_path,
                body_marker=EDITOR_PAGE_MARKER if route == EDITOR_ROUTE else None,
            )
            if not 200 <= status < 300:
                error = f"HTTP {status}"
            elif route == EDITOR_ROUTE and urllib.parse.urlsplit(final_path).path != (
                self.base_path + EDITOR_PATH
            ):
                error = f"editor redirected to {final_path}"
            elif route == EDITOR_ROUTE and not editor_marker_found:
                error = "editor response is not an authenticated post-new page"
            else:
                error = None
            return RequestResult(route, time.perf_counter() - started, status, error)
        except Exception as exc:  # A failed request is a metric, not a crashed load run.
            self._close_connection()
            message = f"{type(exc).__name__}: {exc}"
            return RequestResult(route, time.perf_counter() - started, None, message)

    def close(self) -> None:
        with self._connections_lock:
            connections = tuple(self._connections)
            self._connections.clear()
        for connection in connections:
            connection.close()

    def _connection(self) -> http.client.HTTPConnection:
        connection = getattr(self._local, "connection", None)
        if connection is None:
            connection = http.client.HTTPConnection(
                self.host, self.port, timeout=self.timeout_seconds
            )
            self._local.connection = connection
            with self._connections_lock:
                self._connections.add(connection)
        return connection

    def _close_connection(self) -> None:
        connection = getattr(self._local, "connection", None)
        if connection is not None:
            connection.close()
            self._local.connection = None
            with self._connections_lock:
                self._connections.discard(connection)

    def _request_following_redirects(
        self, path: str, body_marker: bytes | None = None
    ) -> tuple[int, str, bool]:
        current_path = path
        for _ in range(6):
            headers = {
                "Accept": "text/html,application/xhtml+xml",
                "Connection": "keep-alive",
                "User-Agent": "wp-playground-native-benchmark/1",
            }
            if self.cookie_header:
                headers["Cookie"] = self.cookie_header
            connection = self._connection()
            connection.request("GET", current_path, headers=headers)
            response = connection.getresponse()
            status = response.status
            location = response.getheader("Location")
            marker_found = drain_response(response, body_marker)
            if status not in (301, 302, 303, 307, 308) or not location:
                return status, current_path, marker_found
            redirected = urllib.parse.urlsplit(
                urllib.parse.urljoin(
                    f"http://{self.host}:{self.port}{current_path}", location
                )
            )
            if redirected.hostname != self.host or (redirected.port or 80) != self.port:
                raise RuntimeError(f"refusing cross-origin redirect to {location}")
            current_path = urllib.parse.urlunsplit(
                ("", "", redirected.path or "/", redirected.query, "")
            )
        raise RuntimeError("too many redirects")


def drain_response(
    response: http.client.HTTPResponse, body_marker: bytes | None = None
) -> bool:
    marker_found = body_marker is None
    marker_overlap = b""
    while chunk := response.read(64 * 1024):
        if body_marker is not None and not marker_found:
            searchable = marker_overlap + chunk
            marker_found = body_marker in searchable
            if len(body_marker) > 1:
                marker_overlap = searchable[-(len(body_marker) - 1) :]
    return marker_found


def parse_cookie_file(path: pathlib.Path | None) -> str:
    if path is None:
        return ""
    cookies: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line
        if line.startswith("#HttpOnly_"):
            line = line[len("#HttpOnly_") :]
        elif not line or line.startswith("#"):
            continue
        fields = line.split("\t")
        if len(fields) != 7:
            continue
        name, value = fields[5], fields[6]
        if name:
            cookies[name] = value
    return "; ".join(f"{name}={value}" for name, value in cookies.items())


def process_tree_rss_bytes(root_pid: int) -> int:
    if pathlib.Path("/proc", str(root_pid)).exists():
        return _linux_process_tree_rss_bytes(root_pid)
    return _ps_process_tree_rss_bytes(root_pid)


def _linux_process_tree_rss_bytes(root_pid: int) -> int:
    pending = [root_pid]
    seen: set[int] = set()
    total_bytes = 0
    while pending:
        pid = pending.pop()
        if pid in seen:
            continue
        seen.add(pid)
        status_path = pathlib.Path("/proc", str(pid), "status")
        try:
            for line in status_path.read_text(encoding="utf-8").splitlines():
                if line.startswith("VmRSS:"):
                    total_bytes += int(line.split()[1]) * 1024
                    break
        except (FileNotFoundError, PermissionError, ProcessLookupError):
            continue
        task_path = pathlib.Path("/proc", str(pid), "task")
        try:
            task_entries = tuple(task_path.iterdir())
        except (FileNotFoundError, PermissionError, ProcessLookupError):
            continue
        for task_entry in task_entries:
            try:
                children = (task_entry / "children").read_text(encoding="ascii").split()
            except (FileNotFoundError, PermissionError, ProcessLookupError):
                continue
            pending.extend(int(child) for child in children)
    return total_bytes


def _ps_process_tree_rss_bytes(root_pid: int) -> int:
    completed = subprocess.run(
        ["ps", "-axo", "pid=,ppid=,rss="],
        check=True,
        capture_output=True,
        text=True,
    )
    children: dict[int, list[int]] = {}
    rss_kib: dict[int, int] = {}
    for line in completed.stdout.splitlines():
        fields = line.split()
        if len(fields) != 3:
            continue
        pid, parent_pid, rss = (int(field) for field in fields)
        children.setdefault(parent_pid, []).append(pid)
        rss_kib[pid] = rss
    pending = [root_pid]
    seen: set[int] = set()
    total_kib = 0
    while pending:
        pid = pending.pop()
        if pid in seen:
            continue
        seen.add(pid)
        total_kib += rss_kib.get(pid, 0)
        pending.extend(children.get(pid, ()))
    return total_kib * 1024


def run_load(
    base_url: str,
    cookie_header: str,
    server_pid: int,
    duration_seconds: float,
    concurrency: int,
    timeout_seconds: float,
    rss_sample_interval: float,
    sample_rss: bool = True,
    external_peak_rss_path: pathlib.Path | None = None,
) -> LoadResult:
    if sample_rss and external_peak_rss_path is not None:
        raise ValueError("cannot combine internal and external RSS sampling")
    worker = HttpWorker(base_url, cookie_header, timeout_seconds)
    sampler = (
        ProcessTreeRssSampler(server_pid, rss_sample_interval) if sample_rss else None
    )
    route_counts = {route: 0 for route, _ in ROUTES}
    successes = 0
    errors = 0
    error_samples: list[str] = []
    batch_size = max(len(ROUTES), math.ceil(concurrency / len(ROUTES)) * len(ROUTES))
    batch_number = 0
    started = time.perf_counter()
    if sampler is not None:
        sampler.start()
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
            while batch_number == 0 or time.perf_counter() - started < duration_seconds:
                offset = batch_number % len(ROUTES)
                ordered_routes = ROUTES[offset:] + ROUTES[:offset]
                batch = tuple(
                    ordered_routes[index % len(ROUTES)] for index in range(batch_size)
                )
                futures = [
                    executor.submit(worker.request, route, path) for route, path in batch
                ]
                for future in futures:
                    result = future.result()
                    route_counts[result.route] += 1
                    if result.successful:
                        successes += 1
                    else:
                        errors += 1
                        if len(error_samples) < 8:
                            error_samples.append(f"{result.route}: {result.error}")
                batch_number += 1
    finally:
        elapsed = time.perf_counter() - started
        peak_rss_mib = (
            sampler.stop()
            if sampler is not None
            else read_peak_rss_mib(external_peak_rss_path)
        )
        worker.close()
    requests = successes + errors
    return LoadResult(
        duration_seconds=elapsed,
        requests=requests,
        successes=successes,
        errors=errors,
        successful_rps=successes / elapsed,
        peak_tree_rss_mib=peak_rss_mib,
        route_requests=route_counts,
        error_samples=error_samples,
    )


def run_rss_sampler(
    root_pid: int,
    interval_seconds: float,
    output_path: pathlib.Path,
    stop_event: threading.Event | None = None,
) -> float:
    owns_stop_event = stop_event is None
    active_stop_event = stop_event if stop_event is not None else threading.Event()

    previous_handlers: dict[signal.Signals, object] = {}
    if owns_stop_event:
        for signum in (signal.SIGINT, signal.SIGTERM):
            previous_handlers[signum] = signal.getsignal(signum)
            signal.signal(signum, lambda _signum, _frame: active_stop_event.set())

    peak_bytes = 0
    samples = 0

    def sample_and_write() -> None:
        nonlocal peak_bytes, samples
        rss_bytes = process_tree_rss_bytes(root_pid)
        if rss_bytes <= 0:
            return
        samples += 1
        peak_bytes = max(peak_bytes, rss_bytes)
        write_peak_rss_mib(output_path, peak_bytes / (1024 * 1024))

    try:
        sample_and_write()
        while not active_stop_event.wait(interval_seconds):
            sample_and_write()
        sample_and_write()
    finally:
        if owns_stop_event:
            for signum, handler in previous_handlers.items():
                signal.signal(signum, handler)

    if samples == 0:
        raise RuntimeError(f"could not sample RSS for process tree rooted at {root_pid}")
    peak_rss_mib = peak_bytes / (1024 * 1024)
    write_peak_rss_mib(output_path, peak_rss_mib)
    return peak_rss_mib


def write_peak_rss_mib(output_path: pathlib.Path, peak_rss_mib: float) -> None:
    temporary_path = output_path.with_name(
        f".{output_path.name}.{os.getpid()}.tmp"
    )
    temporary_path.write_text(f"{peak_rss_mib:.3f}\n", encoding="utf-8")
    temporary_path.replace(output_path)


def read_peak_rss_mib(output_path: pathlib.Path | None) -> float:
    if output_path is None:
        return 0.0
    try:
        peak_rss_mib = float(output_path.read_text(encoding="utf-8"))
    except ValueError as exc:
        raise ValueError(f"invalid peak RSS value in {output_path}") from exc
    if not math.isfinite(peak_rss_mib) or peak_rss_mib <= 0:
        raise ValueError(f"peak RSS value in {output_path} must be greater than zero")
    return peak_rss_mib


def nearest_rank_percentile(values: Sequence[float], percentile: float) -> float:
    if not values:
        return 0.0
    if not 0 < percentile <= 1:
        raise ValueError("percentile must be greater than zero and at most one")
    ordered = sorted(values)
    rank = math.ceil(percentile * len(ordered))
    return ordered[rank - 1]


def read_numeric_values(path: pathlib.Path) -> list[float]:
    values: list[float] = []
    for line_number, raw_value in enumerate(
        path.read_text(encoding="utf-8").splitlines(), start=1
    ):
        try:
            value = float(raw_value)
        except ValueError as exc:
            raise ValueError(
                f"{path}:{line_number} is not numeric: {raw_value!r}"
            ) from exc
        if not math.isfinite(value):
            raise ValueError(f"{path}:{line_number} is not finite: {raw_value!r}")
        values.append(value)
    return values


def read_result_rows(path: pathlib.Path) -> dict[str, dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as result_file:
        reader = csv.DictReader(result_file, delimiter="\t")
        if reader.fieldnames is None:
            raise ValueError(f"results file is empty: {path}")
        rows: dict[str, dict[str, str]] = {}
        for row in reader:
            label = row.get("case", "")
            if label:
                rows[label] = row
    return rows


def numeric(row: Mapping[str, str], column: str, label: str) -> float:
    value = row.get(column, "")
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{label} {column} is missing or not numeric: {value!r}") from exc
    if not math.isfinite(number):
        raise ValueError(f"{label} {column} is not finite: {value!r}")
    return number


def validate_load_row(row: Mapping[str, str], label: str) -> tuple[bool, str]:
    requests = numeric(row, "load_requests", label)
    successes = numeric(row, "load_successes", label)
    errors = numeric(row, "load_errors", label)
    route_counts = [numeric(row, f"load_{route}_requests", label) for route, _ in ROUTES]
    valid = (
        requests > 0
        and successes >= 0
        and errors >= 0
        and successes + errors == requests
        and sum(route_counts) == requests
        and len(set(route_counts)) == 1
        and route_counts[0] > 0
    )
    return valid, "/".join(f"{count:.0f}" for count in route_counts)


def objective_gate(
    rows: Mapping[str, Mapping[str, str]],
    candidate_label: str,
    native_label: str,
    max_route_ratio: float,
    min_rps_ratio: float,
    max_rss_ratio: float,
    output: object = sys.stdout,
) -> bool:
    if candidate_label not in rows:
        raise ValueError(f"candidate label {candidate_label!r} not found in results")
    if native_label not in rows:
        raise ValueError(f"native label {native_label!r} not found in results")
    candidate = rows[candidate_label]
    native = rows[native_label]
    passed = True

    print("", file=output)
    print("objective_gate", file=output)
    print("metric\tcandidate\tnative\tratio\tlimit\tpass", file=output)
    for metric in ROUTE_METRICS:
        candidate_value = numeric(candidate, metric, candidate_label)
        native_value = numeric(native, metric, native_label)
        if candidate_value <= 0 or native_value <= 0:
            raise ValueError(f"both {metric} values must be greater than zero")
        ratio = candidate_value / native_value
        metric_passed = ratio <= max_route_ratio
        passed = passed and metric_passed
        print(
            f"{metric}\t{candidate_value:.3f}\t{native_value:.3f}\t"
            f"{ratio:.3f}x\t<={max_route_ratio:.2f}x\t{int(metric_passed)}",
            file=output,
        )

    candidate_rps = numeric(candidate, "successful_rps", candidate_label)
    native_rps = numeric(native, "successful_rps", native_label)
    if native_rps <= 0:
        raise ValueError(f"{native_label} successful_rps must be greater than zero")
    rps_ratio = candidate_rps / native_rps
    rps_passed = rps_ratio >= min_rps_ratio
    passed = passed and rps_passed
    print(
        f"successful_rps\t{candidate_rps:.3f}\t{native_rps:.3f}\t"
        f"{rps_ratio:.3f}x\t>={min_rps_ratio:.2f}x\t{int(rps_passed)}",
        file=output,
    )

    candidate_rss = numeric(candidate, "peak_tree_rss_mib", candidate_label)
    native_rss = numeric(native, "peak_tree_rss_mib", native_label)
    if candidate_rss <= 0 or native_rss <= 0:
        raise ValueError("both peak_tree_rss_mib values must be greater than zero")
    rss_ratio = candidate_rss / native_rss
    rss_passed = rss_ratio <= max_rss_ratio
    passed = passed and rss_passed
    print(
        f"peak_tree_rss_mib\t{candidate_rss:.3f}\t{native_rss:.3f}\t"
        f"{rss_ratio:.3f}x\t<={max_rss_ratio:.2f}x\t{int(rss_passed)}",
        file=output,
    )

    candidate_errors = numeric(candidate, "load_errors", candidate_label)
    native_errors = numeric(native, "load_errors", native_label)
    errors_passed = candidate_errors == 0 and native_errors == 0
    passed = passed and errors_passed
    print(
        f"load_errors\t{candidate_errors:.0f}\t{native_errors:.0f}\tn/a\t=0\t"
        f"{int(errors_passed)}",
        file=output,
    )

    candidate_mix_valid, candidate_mix = validate_load_row(candidate, candidate_label)
    native_mix_valid, native_mix = validate_load_row(native, native_label)
    mix_passed = candidate_mix_valid and native_mix_valid
    passed = passed and mix_passed
    print(
        f"equal_route_mix\t{candidate_mix}\t{native_mix}\tn/a\tequal\t"
        f"{int(mix_passed)}",
        file=output,
    )
    print(f"objective_gate_result\t{'PASS' if passed else 'FAIL'}", file=output)
    return passed


def positive_float(value: str) -> float:
    parsed = float(value)
    if not math.isfinite(parsed) or parsed <= 0:
        raise argparse.ArgumentTypeError("must be a finite number greater than zero")
    return parsed


def positive_int(value: str) -> int:
    parsed = int(value)
    if parsed <= 0:
        raise argparse.ArgumentTypeError("must be greater than zero")
    return parsed


def percentile_fraction(value: str) -> float:
    parsed = float(value)
    if not math.isfinite(parsed) or not 0 < parsed <= 1:
        raise argparse.ArgumentTypeError("must be greater than zero and at most one")
    return parsed


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    load_parser = subparsers.add_parser("load", help="run equal-mix sustained load")
    load_parser.add_argument("--base-url", required=True)
    load_parser.add_argument("--cookie-file", type=pathlib.Path)
    load_parser.add_argument("--server-pid", type=positive_int, required=True)
    load_parser.add_argument("--duration", type=positive_float, default=15.0)
    load_parser.add_argument("--concurrency", type=positive_int, default=4)
    load_parser.add_argument("--timeout", type=positive_float, default=30.0)
    load_parser.add_argument("--rss-sample-interval", type=positive_float, default=0.05)
    load_parser.add_argument(
        "--lifetime-rss-file",
        type=pathlib.Path,
        help="read peak RSS from a sampler that started with the server",
    )

    rss_parser = subparsers.add_parser(
        "rss-sample", help="sample recursive RSS until interrupted"
    )
    rss_parser.add_argument("--server-pid", type=positive_int, required=True)
    rss_parser.add_argument("--rss-sample-interval", type=positive_float, default=0.05)
    rss_parser.add_argument("--output", type=pathlib.Path, required=True)

    percentile_parser = subparsers.add_parser(
        "percentile", help="calculate a nearest-rank percentile"
    )
    percentile_parser.add_argument("--values", type=pathlib.Path, required=True)
    percentile_parser.add_argument(
        "--percentile", type=percentile_fraction, required=True
    )

    gate_parser = subparsers.add_parser("gate", help="enforce objective ratios")
    gate_parser.add_argument("--results", type=pathlib.Path, required=True)
    gate_parser.add_argument("--candidate-label", required=True)
    gate_parser.add_argument("--native-label", required=True)
    gate_parser.add_argument("--max-route-ratio", type=positive_float, default=1.40)
    gate_parser.add_argument("--min-rps-ratio", type=positive_float, default=0.70)
    gate_parser.add_argument("--max-rss-ratio", type=positive_float, default=1.50)
    return parser


def main(argv: Iterable[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        if args.command == "load":
            result = run_load(
                base_url=args.base_url,
                cookie_header=parse_cookie_file(args.cookie_file),
                server_pid=args.server_pid,
                duration_seconds=args.duration,
                concurrency=args.concurrency,
                timeout_seconds=args.timeout,
                rss_sample_interval=args.rss_sample_interval,
                sample_rss=args.lifetime_rss_file is None,
                external_peak_rss_path=args.lifetime_rss_file,
            )
            print(result.as_tsv())
            for error in result.error_samples:
                print(f"load request failure: {error}", file=sys.stderr)
            return 0

        if args.command == "rss-sample":
            run_rss_sampler(
                root_pid=args.server_pid,
                interval_seconds=args.rss_sample_interval,
                output_path=args.output,
            )
            return 0

        if args.command == "percentile":
            value = nearest_rank_percentile(
                read_numeric_values(args.values), args.percentile
            )
            print(f"{value:.3f}")
            return 0

        rows = read_result_rows(args.results)
        return 0 if objective_gate(
            rows,
            candidate_label=args.candidate_label,
            native_label=args.native_label,
            max_route_ratio=args.max_route_ratio,
            min_rps_ratio=args.min_rps_ratio,
            max_rss_ratio=args.max_rss_ratio,
        ) else 1
    except (OSError, RuntimeError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
