#!/usr/bin/env python3
"""Run and summarize fixed-count WordPress HTTP concurrency measurements."""

from __future__ import annotations

import argparse
import concurrent.futures
import http.client
import json
import math
import pathlib
import statistics
import threading
import time
import urllib.parse
from collections.abc import Iterable, Sequence
from typing import Any


WORKLOAD_NAMES = ("public", "mixed", "admin")
LOCAL_HOSTS = {"127.0.0.1", "localhost", "::1"}


def positive_int(value: str) -> int:
    parsed = int(value)
    if parsed < 1:
        raise argparse.ArgumentTypeError("must be a positive integer")
    return parsed


def positive_float(value: str) -> float:
    parsed = float(value)
    if not math.isfinite(parsed) or parsed <= 0:
        raise argparse.ArgumentTypeError("must be a finite number greater than zero")
    return parsed


def percentile(values: Sequence[float], fraction: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = max(0, math.ceil(len(ordered) * fraction) - 1)
    return round(ordered[index], 3)


def read_cookie_jar(path: pathlib.Path | None) -> str:
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
        if len(fields) == 7:
            cookies[fields[5]] = fields[6]
    return "; ".join(f"{name}={value}" for name, value in sorted(cookies.items()))


def parse_local_url(value: str) -> urllib.parse.SplitResult:
    parsed = urllib.parse.urlsplit(value)
    if (
        parsed.scheme != "http"
        or parsed.hostname not in LOCAL_HOSTS
        or parsed.port is None
        or parsed.path not in ("", "/")
        or parsed.query
        or parsed.fragment
        or parsed.username
        or parsed.password
    ):
        raise ValueError("base URL must be an explicit loopback HTTP origin")
    return parsed


def workload_routes(workload: str, post_path: str) -> tuple[tuple[str, str], ...]:
    parsed = urllib.parse.urlsplit(post_path)
    if (
        not post_path.startswith("/")
        or parsed.scheme
        or parsed.netloc
        or parsed.fragment
        or any(character in post_path for character in "\r\n\0")
    ):
        raise ValueError("post path must be an origin-form path without a fragment")
    routes = (
        ("home", "/"),
        ("search", "/?s=hello"),
        ("post", post_path),
        ("editor", "/wp-admin/post-new.php"),
    )
    if workload == "public":
        return routes[:3]
    if workload == "mixed":
        return routes
    if workload == "admin":
        return (routes[3],)
    raise ValueError(f"unsupported workload: {workload}")


def response_is_valid(route: str, status: int, body: bytes) -> bool:
    if status != 200:
        return False
    lowered = body.lower()
    if route == "editor":
        return b"post-new-php" in body
    return len(body) > 1000 and b"</html>" in lowered


def run_worker(
    worker_index: int,
    parsed: urllib.parse.SplitResult,
    routes: Sequence[tuple[str, str]],
    cookie_header: str,
    cookie_scope: str,
    timeout: float,
    requests_per_worker: int,
    barrier: threading.Barrier,
    clock: dict[str, float],
) -> tuple[list[dict[str, Any]], float]:
    records: list[dict[str, Any]] = []
    connection: http.client.HTTPConnection | None = None
    barrier.wait()
    for request_index in range(requests_per_worker):
        route, path = routes[(worker_index + request_index) % len(routes)]
        started = time.perf_counter()
        status = 0
        body = b""
        error: str | None = None
        ttfb_ms: float | None = None
        try:
            if connection is None:
                connection = http.client.HTTPConnection(
                    parsed.hostname,
                    parsed.port,
                    timeout=timeout,
                )
            headers = {
                "Accept": "text/html,application/xhtml+xml",
                "Accept-Encoding": "identity",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "User-Agent": "wp-playground-native-parity-benchmark/1",
            }
            should_authenticate = cookie_scope == "all" or (
                cookie_scope == "admin" and route == "editor"
            )
            if cookie_header and should_authenticate:
                headers["Cookie"] = cookie_header
            connection.request("GET", path, headers=headers)
            response = connection.getresponse()
            ttfb_ms = (time.perf_counter() - started) * 1000
            status = response.status
            body = response.read()
        except Exception as exc:  # Keep the concrete error in the raw artifact.
            error = f"{type(exc).__name__}: {exc}"[:240]
            if connection is not None:
                connection.close()
            connection = None
        finished = time.perf_counter()
        valid = error is None and response_is_valid(route, status, body)
        if not valid and error is None:
            error = f"invalid response: status={status}, bytes={len(body)}"
        records.append(
            {
                "route": route,
                "status": status,
                "ok": valid,
                "error": error,
                "bytes": len(body),
                "ttfb_ms": round(ttfb_ms, 3) if ttfb_ms is not None else None,
                "total_ms": round((finished - started) * 1000, 3),
            }
        )
    if connection is not None:
        connection.close()
    return records, time.perf_counter()


def metric_summary(
    records: Sequence[dict[str, Any]],
    elapsed: float,
    routes: Sequence[tuple[str, str]],
) -> dict[str, Any]:
    successful = [record for record in records if record["ok"]]
    ttfb = [record["ttfb_ms"] for record in successful]
    total = [record["total_ms"] for record in successful]
    by_route: dict[str, dict[str, Any]] = {}
    for route, _ in routes:
        route_records = [record for record in successful if record["route"] == route]
        by_route[route] = {
            "requests": len(route_records),
            "ttfb_p50_ms": percentile(
                [record["ttfb_ms"] for record in route_records], 0.50
            ),
            "ttfb_p95_ms": percentile(
                [record["ttfb_ms"] for record in route_records], 0.95
            ),
            "total_p50_ms": percentile(
                [record["total_ms"] for record in route_records], 0.50
            ),
            "total_p95_ms": percentile(
                [record["total_ms"] for record in route_records], 0.95
            ),
        }
    return {
        "requests": len(records),
        "successes": len(successful),
        "errors": len(records) - len(successful),
        "successful_rps": round(len(successful) / elapsed, 3),
        "ttfb_p50_ms": percentile(ttfb, 0.50),
        "ttfb_p95_ms": percentile(ttfb, 0.95),
        "ttfb_p99_ms": percentile(ttfb, 0.99),
        "total_p50_ms": percentile(total, 0.50),
        "total_p95_ms": percentile(total, 0.95),
        "total_p99_ms": percentile(total, 0.99),
        "routes": by_route,
    }


def load_command(args: argparse.Namespace) -> int:
    parsed = parse_local_url(args.base_url)
    cookie_header = read_cookie_jar(args.cookie_file)
    routes = workload_routes(args.workload, args.post_path)
    clock: dict[str, float] = {}

    def start_run() -> None:
        clock["started"] = time.perf_counter()

    barrier = threading.Barrier(args.concurrency + 1, action=start_run)
    with concurrent.futures.ThreadPoolExecutor(
        max_workers=args.concurrency
    ) as executor:
        futures = [
            executor.submit(
                run_worker,
                worker,
                parsed,
                routes,
                cookie_header,
                args.cookie_scope,
                args.timeout,
                args.requests_per_worker,
                barrier,
                clock,
            )
            for worker in range(args.concurrency)
        ]
        barrier.wait()
        worker_results = [future.result() for future in futures]

    records = [record for worker, _ in worker_results for record in worker]
    elapsed = max(ended for _, ended in worker_results) - clock["started"]
    result = {
        "schema_version": 1,
        "label": args.label,
        "round": args.round,
        "base_url": args.base_url,
        "concurrency": args.concurrency,
        "requests_per_worker": args.requests_per_worker,
        "exact_request_target": args.concurrency * args.requests_per_worker,
        "workload": args.workload,
        "cookie_scope": args.cookie_scope,
        "elapsed_s": round(elapsed, 6),
        "summary": metric_summary(records, elapsed, routes),
        "records": records,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    compact = {
        "label": args.label,
        "round": args.round,
        "workload": args.workload,
        "concurrency": args.concurrency,
        "elapsed_s": result["elapsed_s"],
        **{key: value for key, value in result["summary"].items() if key != "routes"},
    }
    print(json.dumps(compact, separators=(",", ":")), flush=True)
    return 0 if result["summary"]["errors"] == 0 else 1


def arithmetic_mean(values: Iterable[float]) -> float:
    return round(statistics.fmean(values), 3)


def summarize_command(args: argparse.Namespace) -> int:
    paths = sorted(args.runs_dir.glob("*.json"))
    if not paths:
        raise ValueError(f"no JSON runs found in {args.runs_dir}")
    runs = [json.loads(path.read_text(encoding="utf-8")) for path in paths]
    grouped: dict[tuple[str, int], list[dict[str, Any]]] = {}
    for run in runs:
        key = (run["label"], run["concurrency"])
        grouped.setdefault(key, []).append(run)

    rows: list[dict[str, Any]] = []
    for (label, concurrency), cases in sorted(grouped.items()):
        workloads = {case["workload"] for case in cases}
        if workloads != {args.workload}:
            raise ValueError(
                f"unexpected workloads for {label} c{concurrency}: {workloads}"
            )
        row = {
            "workload": args.workload,
            "backend": label,
            "concurrency": concurrency,
            "rounds": len(cases),
            "errors": sum(case["summary"]["errors"] for case in cases),
        }
        for metric in (
            "successful_rps",
            "ttfb_p50_ms",
            "ttfb_p95_ms",
            "total_p50_ms",
            "total_p95_ms",
        ):
            row[metric] = arithmetic_mean(
                case["summary"][metric] for case in cases
            )
        rows.append(row)

    ratios: list[dict[str, Any]] = []
    concurrencies = sorted({row["concurrency"] for row in rows})
    for concurrency in concurrencies:
        native = next(
            (
                row
                for row in rows
                if row["backend"] == args.native_label
                and row["concurrency"] == concurrency
            ),
            None,
        )
        fpm = next(
            (
                row
                for row in rows
                if row["backend"] == args.fpm_label
                and row["concurrency"] == concurrency
            ),
            None,
        )
        if native is None or fpm is None:
            raise ValueError(f"missing backend at concurrency {concurrency}")
        ratios.append(
            {
                "workload": args.workload,
                "concurrency": concurrency,
                "native_over_fpm_rps": round(
                    native["successful_rps"] / fpm["successful_rps"], 3
                ),
                "native_over_fpm_ttfb_p50": round(
                    native["ttfb_p50_ms"] / fpm["ttfb_p50_ms"], 3
                ),
                "native_over_fpm_total_p50": round(
                    native["total_p50_ms"] / fpm["total_p50_ms"], 3
                ),
            }
        )

    artifact = {
        "schema_version": 1,
        "protocol": {
            "aggregation": "arithmetic mean of per-round metrics",
            "request_count": "fixed requests per worker",
            "connection": "one persistent HTTP/1.1 connection per worker",
        },
        "rows": rows,
        "ratios": ratios,
    }
    args.output_prefix.parent.mkdir(parents=True, exist_ok=True)
    json_path = args.output_prefix.with_suffix(".json")
    tsv_path = args.output_prefix.with_suffix(".tsv")
    json_path.write_text(json.dumps(artifact, indent=2) + "\n", encoding="utf-8")
    columns = list(rows[0])
    lines = ["\t".join(columns)]
    lines.extend("\t".join(str(row[column]) for column in columns) for row in rows)
    tsv_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"rows": rows, "ratios": ratios}, indent=2))
    return 0 if all(row["errors"] == 0 for row in rows) else 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    load = subparsers.add_parser("load", help="run one fixed-count load case")
    load.add_argument("--label", required=True)
    load.add_argument("--base-url", required=True)
    load.add_argument("--cookie-file", type=pathlib.Path)
    load.add_argument("--cookie-scope", choices=("all", "admin", "none"), default="all")
    load.add_argument("--workload", choices=WORKLOAD_NAMES, default="mixed")
    load.add_argument("--post-path", default="/?p=1")
    load.add_argument("--concurrency", type=positive_int, required=True)
    load.add_argument("--requests-per-worker", type=positive_int, required=True)
    load.add_argument("--round", type=positive_int, default=1)
    load.add_argument("--timeout", type=positive_float, default=60)
    load.add_argument("--output", type=pathlib.Path, required=True)
    load.set_defaults(handler=load_command)

    summarize = subparsers.add_parser("summarize", help="summarize one workload")
    summarize.add_argument("--runs-dir", type=pathlib.Path, required=True)
    summarize.add_argument("--workload", choices=WORKLOAD_NAMES, required=True)
    summarize.add_argument("--native-label", default="native-wasm")
    summarize.add_argument("--fpm-label", default="nginx-php-fpm")
    summarize.add_argument("--output-prefix", type=pathlib.Path, required=True)
    summarize.set_defaults(handler=summarize_command)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return args.handler(args)
    except (OSError, ValueError, KeyError, ZeroDivisionError) as exc:
        print(f"error: {exc}", file=__import__("sys").stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
