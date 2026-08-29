#!/usr/bin/env python3
"""Measure Linux process-tree memory and CPU without counting the load client."""

from __future__ import annotations

import argparse
import json
import os
import pathlib
import signal
import statistics
import sys
import time
from collections.abc import Iterable, Sequence
from typing import Any


MIB = 1024 * 1024
KIB = 1024
CLOCK_TICKS = os.sysconf("SC_CLK_TCK") if hasattr(os, "sysconf") else 100


def positive_int(value: str) -> int:
    parsed = int(value)
    if parsed <= 0:
        raise argparse.ArgumentTypeError("must be greater than zero")
    return parsed


def positive_float(value: str) -> float:
    parsed = float(value)
    if parsed <= 0:
        raise argparse.ArgumentTypeError("must be greater than zero")
    return parsed


def write_json(path: pathlib.Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def process_children(pid: int) -> set[int]:
    children: set[int] = set()
    task_root = pathlib.Path("/proc", str(pid), "task")
    try:
        tasks = list(task_root.iterdir())
    except (FileNotFoundError, PermissionError, ProcessLookupError):
        return children
    for task in tasks:
        try:
            raw_children = (task / "children").read_text(encoding="ascii")
        except (FileNotFoundError, PermissionError, ProcessLookupError):
            continue
        for child in raw_children.split():
            if child.isdigit():
                children.add(int(child))
    return children


def process_tree(root_pids: Iterable[int]) -> list[int]:
    pending = list(dict.fromkeys(root_pids))
    visited: set[int] = set()
    while pending:
        pid = pending.pop()
        if pid in visited or not pathlib.Path("/proc", str(pid)).exists():
            continue
        visited.add(pid)
        pending.extend(process_children(pid) - visited)
    return sorted(visited)


def parse_stat(path: pathlib.Path) -> tuple[int, int, int]:
    raw = path.read_text(encoding="ascii")
    close_paren = raw.rfind(")")
    if close_paren < 0:
        raise ValueError(f"malformed proc stat: {path}")
    fields = raw[close_paren + 2 :].split()
    # fields[0] is field 3 (`state`); utime/stime/starttime are 14/15/22.
    return int(fields[11]), int(fields[12]), int(fields[19])


def process_cpu_ticks(pid: int) -> tuple[int, int, dict[str, int]]:
    task_root = pathlib.Path("/proc", str(pid), "task")
    ticks = 0
    thread_count = 0
    starts: dict[str, int] = {}
    try:
        tasks = list(task_root.iterdir())
    except (FileNotFoundError, PermissionError, ProcessLookupError):
        return 0, 0, starts
    for task in tasks:
        try:
            user_ticks, system_ticks, start_ticks = parse_stat(task / "stat")
        except (FileNotFoundError, PermissionError, ProcessLookupError, ValueError):
            continue
        ticks += user_ticks + system_ticks
        thread_count += 1
        starts[f"{pid}:{task.name}"] = start_ticks
    return ticks, thread_count, starts


def process_memory_kib(pid: int) -> tuple[int, int, int]:
    values: dict[str, int] = {}
    smaps = pathlib.Path("/proc", str(pid), "smaps_rollup")
    try:
        lines = smaps.read_text(encoding="ascii").splitlines()
    except (FileNotFoundError, PermissionError, ProcessLookupError):
        lines = []
    for line in lines:
        key, separator, remainder = line.partition(":")
        if not separator:
            continue
        fields = remainder.split()
        if fields and fields[0].isdigit():
            values[key] = int(fields[0])
    if "Rss" not in values:
        status = pathlib.Path("/proc", str(pid), "status")
        try:
            for line in status.read_text(encoding="ascii").splitlines():
                if line.startswith("VmRSS:"):
                    values["Rss"] = int(line.split()[1])
                    break
        except (FileNotFoundError, PermissionError, ProcessLookupError):
            pass
    rss = values.get("Rss", 0)
    pss = values.get("Pss", 0)
    uss = sum(
        values.get(key, 0)
        for key in ("Private_Clean", "Private_Dirty", "Private_Hugetlb")
    )
    return rss, pss, uss


def snapshot_pids(pids: Sequence[int]) -> dict[str, Any]:
    pids = sorted(set(pids))
    if not pids:
        raise RuntimeError("no live processes found")
    cpu_ticks = 0
    thread_count = 0
    starts: dict[str, int] = {}
    rss_kib = 0
    pss_kib = 0
    uss_kib = 0
    for pid in pids:
        process_ticks, process_threads, process_starts = process_cpu_ticks(pid)
        cpu_ticks += process_ticks
        thread_count += process_threads
        starts.update(process_starts)
        rss, pss, uss = process_memory_kib(pid)
        rss_kib += rss
        pss_kib += pss
        uss_kib += uss
    return {
        "monotonic_s": time.monotonic(),
        "pids": pids,
        "threads": thread_count,
        "task_start_ticks": starts,
        "cpu_ticks": cpu_ticks,
        "cpu_seconds": cpu_ticks / CLOCK_TICKS,
        "rss_mib": rss_kib * KIB / MIB,
        "pss_mib": pss_kib * KIB / MIB,
        "uss_mib": uss_kib * KIB / MIB,
    }


def snapshot(root_pids: Sequence[int]) -> dict[str, Any]:
    result = snapshot_pids(process_tree(root_pids))
    result["root_pids"] = list(root_pids)
    return result


def cgroup_root(value: str) -> pathlib.Path:
    root = pathlib.Path(value)
    cgroup_base = pathlib.Path("/sys/fs/cgroup").resolve()
    if not root.is_absolute() or (
        root != cgroup_base and cgroup_base not in root.parents
    ):
        root = cgroup_base / value.lstrip("/")
    root = root.resolve()
    if root != cgroup_base and cgroup_base not in root.parents:
        raise ValueError("cgroup must be below /sys/fs/cgroup")
    if not (root / "cgroup.procs").is_file():
        raise ValueError(f"cgroup is unavailable: {root}")
    return root


def cgroup_pids(root: pathlib.Path) -> list[int]:
    pids: set[int] = set()
    paths = [root]
    paths.extend(path for path in root.rglob("*") if path.is_dir())
    for path in paths:
        try:
            raw = (path / "cgroup.procs").read_text(encoding="ascii")
        except (FileNotFoundError, PermissionError, ProcessLookupError):
            continue
        pids.update(int(value) for value in raw.split() if value.isdigit())
    return sorted(pids)


def key_value_file(path: pathlib.Path) -> dict[str, int]:
    values: dict[str, int] = {}
    for line in path.read_text(encoding="ascii").splitlines():
        fields = line.split()
        if len(fields) == 2 and fields[1].lstrip("-").isdigit():
            values[fields[0]] = int(fields[1])
    return values


def cgroup_cpu_snapshot(value: str) -> dict[str, Any]:
    root = cgroup_root(value)
    cpu = key_value_file(root / "cpu.stat")
    events = key_value_file(root / "memory.events")
    pids = cgroup_pids(root)
    if not pids:
        raise RuntimeError(f"no live processes found in {root}")
    thread_count = 0
    starts: dict[str, int] = {}
    for pid in pids:
        _ticks, threads, process_starts = process_cpu_ticks(pid)
        thread_count += threads
        starts.update(process_starts)
    usage_usec = cpu.get("usage_usec", 0)
    return {
        "monotonic_s": time.monotonic(),
        "cgroup": str(root),
        "pids": pids,
        "threads": thread_count,
        "task_start_ticks": starts,
        "cpu": cpu,
        "cpu_seconds": usage_usec / 1_000_000,
        "memory_current_mib": int((root / "memory.current").read_text()) / MIB,
        "memory_peak_mib": int((root / "memory.peak").read_text()) / MIB,
        "memory_events": events,
    }


def cgroup_memory_snapshot(value: str) -> dict[str, Any]:
    root = cgroup_root(value)
    result = snapshot_pids(cgroup_pids(root))
    result["cgroup"] = str(root)
    result["memory_current_mib"] = int((root / "memory.current").read_text()) / MIB
    result["memory_peak_mib"] = int((root / "memory.peak").read_text()) / MIB
    result["memory_events"] = key_value_file(root / "memory.events")
    return result


def selected_snapshot(args: argparse.Namespace) -> dict[str, Any]:
    if getattr(args, "cgroup", None):
        return cgroup_memory_snapshot(args.cgroup)
    return snapshot(args.pid)


def snapshot_command(args: argparse.Namespace) -> int:
    result = selected_snapshot(args)
    if args.output:
        write_json(args.output, result)
    else:
        print(json.dumps(result, indent=2))
    return 0


def sample_command(args: argparse.Namespace) -> int:
    running = True

    def stop(_signum: int, _frame: Any) -> None:
        nonlocal running
        running = False

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    samples: list[dict[str, Any]] = []
    started = time.monotonic()
    while running:
        current = selected_snapshot(args)
        samples.append(
            {
                "elapsed_s": current["monotonic_s"] - started,
                "pids": current["pids"],
                "threads": current["threads"],
                "rss_mib": current["rss_mib"],
                "pss_mib": current["pss_mib"],
                "uss_mib": current["uss_mib"],
                "memory_current_mib": current.get("memory_current_mib"),
                "memory_peak_mib": current.get("memory_peak_mib"),
            }
        )
        deadline = time.monotonic() + args.interval
        while running and time.monotonic() < deadline:
            time.sleep(min(0.02, max(0.0, deadline - time.monotonic())))
    if not samples:
        raise RuntimeError("resource sampler collected no samples")
    result = {
        "root_pids": list(args.pid or []),
        "cgroup": args.cgroup,
        "interval_s": args.interval,
        "sample_count": len(samples),
        "peak_rss_mib": max(sample["rss_mib"] for sample in samples),
        "peak_pss_mib": max(sample["pss_mib"] for sample in samples),
        "peak_uss_mib": max(sample["uss_mib"] for sample in samples),
        "peak_memory_current_mib": max(
            sample["memory_current_mib"] or 0 for sample in samples
        ),
        "cgroup_memory_peak_mib": max(
            sample["memory_peak_mib"] or 0 for sample in samples
        ),
        "samples": samples,
    }
    write_json(args.output, result)
    return 0


def load_json(path: pathlib.Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def report_command(args: argparse.Namespace) -> int:
    before = load_json(args.before)
    after = load_json(args.after)
    peak = load_json(args.peak)
    load = load_json(args.load)
    successes = int(load["summary"]["successes"])
    errors = int(load["summary"]["errors"])
    elapsed = float(load["elapsed_s"])
    cpu_seconds = float(after["cpu_seconds"]) - float(before["cpu_seconds"])
    if successes <= 0 or elapsed <= 0 or cpu_seconds < 0:
        raise ValueError("invalid load or CPU delta")
    before_tasks = before.get("task_start_ticks", {})
    after_tasks = after.get("task_start_ticks", {})
    result = {
        "schema_version": 1,
        "label": args.label,
        "workload": args.workload,
        "round": args.round,
        "successes": successes,
        "errors": errors,
        "elapsed_s": elapsed,
        "successful_rps": float(load["summary"]["successful_rps"]),
        "cpu_seconds": cpu_seconds,
        "cpu_ms_per_request": cpu_seconds * 1000 / successes,
        "average_cores": cpu_seconds / elapsed,
        "average_cpu_percent": cpu_seconds / elapsed * 100,
        "pre_load_rss_mib": before["rss_mib"],
        "pre_load_pss_mib": before["pss_mib"],
        "pre_load_uss_mib": before["uss_mib"],
        "peak_rss_mib": peak["peak_rss_mib"],
        "peak_pss_mib": peak["peak_pss_mib"],
        "peak_uss_mib": peak["peak_uss_mib"],
        "before_pids": before["pids"],
        "after_pids": after["pids"],
        "before_threads": before["threads"],
        "after_threads": after["threads"],
        "added_tasks": sorted(set(after_tasks) - set(before_tasks)),
        "removed_tasks": sorted(set(before_tasks) - set(after_tasks)),
    }
    write_json(args.output, result)
    print(json.dumps(result, separators=(",", ":")))
    return 0 if errors == 0 else 1


def cgroup_cpu_command(args: argparse.Namespace) -> int:
    result = cgroup_cpu_snapshot(args.cgroup)
    if args.output:
        write_json(args.output, result)
    else:
        print(json.dumps(result, indent=2))
    return 0


def cpu_report_command(args: argparse.Namespace) -> int:
    before = load_json(args.before)
    after = load_json(args.after)
    load = load_json(args.load)
    successes = int(load["summary"]["successes"])
    errors = int(load["summary"]["errors"])
    elapsed = float(load["elapsed_s"])
    usage_usec = int(after["cpu"].get("usage_usec", 0)) - int(
        before["cpu"].get("usage_usec", 0)
    )
    user_usec = int(after["cpu"].get("user_usec", 0)) - int(
        before["cpu"].get("user_usec", 0)
    )
    system_usec = int(after["cpu"].get("system_usec", 0)) - int(
        before["cpu"].get("system_usec", 0)
    )
    throttled_count = int(after["cpu"].get("nr_throttled", 0)) - int(
        before["cpu"].get("nr_throttled", 0)
    )
    throttled_usec = int(after["cpu"].get("throttled_usec", 0)) - int(
        before["cpu"].get("throttled_usec", 0)
    )
    if successes <= 0 or elapsed <= 0 or usage_usec < 0:
        raise ValueError("invalid load or cgroup CPU delta")
    before_tasks = before.get("task_start_ticks", {})
    after_tasks = after.get("task_start_ticks", {})
    cpu_seconds = usage_usec / 1_000_000
    result = {
        "schema_version": 1,
        "label": args.label,
        "workload": args.workload,
        "round": args.round,
        "successes": successes,
        "errors": errors,
        "elapsed_s": elapsed,
        "successful_rps": float(load["summary"]["successful_rps"]),
        "cpu_seconds": cpu_seconds,
        "user_cpu_seconds": user_usec / 1_000_000,
        "system_cpu_seconds": system_usec / 1_000_000,
        "cpu_ms_per_request": usage_usec / successes / 1000,
        "requests_per_cpu_second": successes / cpu_seconds,
        "average_cores": cpu_seconds / elapsed,
        "average_cpu_percent": cpu_seconds / elapsed * 100,
        "nr_throttled": throttled_count,
        "throttled_seconds": throttled_usec / 1_000_000,
        "before_pids": before["pids"],
        "after_pids": after["pids"],
        "before_threads": before["threads"],
        "after_threads": after["threads"],
        "added_tasks": sorted(set(after_tasks) - set(before_tasks)),
        "removed_tasks": sorted(set(before_tasks) - set(after_tasks)),
        "memory_events_delta": {
            key: int(after.get("memory_events", {}).get(key, 0))
            - int(before.get("memory_events", {}).get(key, 0))
            for key in set(before.get("memory_events", {}))
            | set(after.get("memory_events", {}))
        },
    }
    write_json(args.output, result)
    print(json.dumps(result, separators=(",", ":")))
    invalid = errors != 0 or throttled_count != 0 or any(
        result["memory_events_delta"].get(key, 0) != 0
        for key in ("oom", "oom_kill", "oom_group_kill")
    )
    return 1 if invalid else 0


def median(values: Iterable[float]) -> float:
    return statistics.median(values)


def aggregate_command(args: argparse.Namespace) -> int:
    reports = [load_json(path) for path in sorted(args.reports_dir.glob("*.json"))]
    if not reports:
        raise ValueError(f"no reports found in {args.reports_dir}")
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for report in reports:
        grouped.setdefault((report["label"], report["workload"]), []).append(report)
    cpu_rows = []
    for (label, workload), cases in sorted(grouped.items()):
        cpu_rows.append(
            {
                "label": label,
                "workload": workload,
                "rounds": len(cases),
                "errors": sum(case["errors"] for case in cases),
                "cpu_ms_per_request": median(
                    case["cpu_ms_per_request"] for case in cases
                ),
                "average_cores": median(case["average_cores"] for case in cases),
                "successful_rps": median(case["successful_rps"] for case in cases),
            }
        )
    idle_paths: dict[str, pathlib.Path] = {}
    for raw in args.idle:
        label, separator, path = raw.partition("=")
        if not separator or not label or not path:
            raise ValueError("--idle must use LABEL=PATH")
        idle_paths[label] = pathlib.Path(path)
    memory_rows = []
    for label, idle_path in sorted(idle_paths.items()):
        idle = load_json(idle_path)
        label_reports = [report for report in reports if report["label"] == label]
        if not label_reports:
            raise ValueError(f"no reports found for idle label {label}")
        peak_case = max(label_reports, key=lambda report: report["peak_pss_mib"])
        memory_rows.append(
            {
                "label": label,
                "idle_rss_mib": idle["rss_mib"],
                "idle_pss_mib": idle["pss_mib"],
                "idle_uss_mib": idle["uss_mib"],
                "peak_rss_mib": max(report["peak_rss_mib"] for report in label_reports),
                "peak_pss_mib": peak_case["peak_pss_mib"],
                "peak_uss_mib": max(report["peak_uss_mib"] for report in label_reports),
                "peak_pss_workload": peak_case["workload"],
                "peak_pss_round": peak_case["round"],
            }
        )
    artifact = {"schema_version": 1, "cpu_rows": cpu_rows, "memory_rows": memory_rows}
    write_json(args.output, artifact)
    print(json.dumps(artifact, indent=2))
    return 0 if all(row["errors"] == 0 for row in cpu_rows) else 1


def memory_aggregate_command(args: argparse.Namespace) -> int:
    labels = sorted(path.name for path in args.results_dir.iterdir() if path.is_dir())
    if not labels:
        raise ValueError(f"no memory results found in {args.results_dir}")
    memory_rows = []
    workload_rows = []
    for label in labels:
        label_root = args.results_dir / label
        idle = load_json(label_root / "idle-samples.json")
        idle_samples = idle["samples"]
        active_artifacts = {
            workload: load_json(label_root / workload / "active-samples.json")
            for workload in ("public", "mixed", "admin")
        }
        for workload, active in active_artifacts.items():
            samples = active["samples"]
            workload_rows.append(
                {
                    "label": label,
                    "workload": workload,
                    "samples": len(samples),
                    "active_pss_median_mib": median(
                        sample["pss_mib"] for sample in samples
                    ),
                    "active_pss_peak_mib": active["peak_pss_mib"],
                    "active_rss_peak_mib": active["peak_rss_mib"],
                    "active_uss_peak_mib": active["peak_uss_mib"],
                    "active_cgroup_current_peak_mib": active[
                        "peak_memory_current_mib"
                    ],
                    "active_cgroup_memory_peak_mib": active[
                        "cgroup_memory_peak_mib"
                    ],
                }
            )
        memory_rows.append(
            {
                "label": label,
                "idle_samples": len(idle_samples),
                "idle_pss_median_mib": median(
                    sample["pss_mib"] for sample in idle_samples
                ),
                "idle_rss_median_mib": median(
                    sample["rss_mib"] for sample in idle_samples
                ),
                "idle_uss_median_mib": median(
                    sample["uss_mib"] for sample in idle_samples
                ),
                "idle_cgroup_current_median_mib": median(
                    sample["memory_current_mib"] for sample in idle_samples
                ),
                "active_pss_peak_mib": max(
                    active["peak_pss_mib"] for active in active_artifacts.values()
                ),
                "active_rss_peak_mib": max(
                    active["peak_rss_mib"] for active in active_artifacts.values()
                ),
                "active_uss_peak_mib": max(
                    active["peak_uss_mib"] for active in active_artifacts.values()
                ),
                "active_cgroup_current_peak_mib": max(
                    active["peak_memory_current_mib"]
                    for active in active_artifacts.values()
                ),
                "active_cgroup_memory_peak_mib": max(
                    active["cgroup_memory_peak_mib"]
                    for active in active_artifacts.values()
                ),
            }
        )
    artifact = {
        "schema_version": 1,
        "memory_rows": memory_rows,
        "workload_rows": workload_rows,
    }
    write_json(args.output, artifact)
    print(json.dumps(artifact, indent=2))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    snapshot_parser = subparsers.add_parser("snapshot")
    snapshot_source = snapshot_parser.add_mutually_exclusive_group(required=True)
    snapshot_source.add_argument("--pid", type=positive_int, action="append")
    snapshot_source.add_argument("--cgroup")
    snapshot_parser.add_argument("--output", type=pathlib.Path)
    snapshot_parser.set_defaults(handler=snapshot_command)

    sample_parser = subparsers.add_parser("sample")
    sample_source = sample_parser.add_mutually_exclusive_group(required=True)
    sample_source.add_argument("--pid", type=positive_int, action="append")
    sample_source.add_argument("--cgroup")
    sample_parser.add_argument("--interval", type=positive_float, default=0.1)
    sample_parser.add_argument("--output", type=pathlib.Path, required=True)
    sample_parser.set_defaults(handler=sample_command)

    cgroup_cpu_parser = subparsers.add_parser("cgroup-cpu")
    cgroup_cpu_parser.add_argument("--cgroup", required=True)
    cgroup_cpu_parser.add_argument("--output", type=pathlib.Path)
    cgroup_cpu_parser.set_defaults(handler=cgroup_cpu_command)

    report_parser = subparsers.add_parser("report")
    report_parser.add_argument("--label", required=True)
    report_parser.add_argument("--workload", required=True)
    report_parser.add_argument("--round", type=positive_int, required=True)
    report_parser.add_argument("--before", type=pathlib.Path, required=True)
    report_parser.add_argument("--after", type=pathlib.Path, required=True)
    report_parser.add_argument("--peak", type=pathlib.Path, required=True)
    report_parser.add_argument("--load", type=pathlib.Path, required=True)
    report_parser.add_argument("--output", type=pathlib.Path, required=True)
    report_parser.set_defaults(handler=report_command)

    cpu_report_parser = subparsers.add_parser("cpu-report")
    cpu_report_parser.add_argument("--label", required=True)
    cpu_report_parser.add_argument("--workload", required=True)
    cpu_report_parser.add_argument("--round", type=positive_int, required=True)
    cpu_report_parser.add_argument("--before", type=pathlib.Path, required=True)
    cpu_report_parser.add_argument("--after", type=pathlib.Path, required=True)
    cpu_report_parser.add_argument("--load", type=pathlib.Path, required=True)
    cpu_report_parser.add_argument("--output", type=pathlib.Path, required=True)
    cpu_report_parser.set_defaults(handler=cpu_report_command)

    aggregate_parser = subparsers.add_parser("aggregate")
    aggregate_parser.add_argument("--reports-dir", type=pathlib.Path, required=True)
    aggregate_parser.add_argument("--idle", action="append", default=[])
    aggregate_parser.add_argument("--output", type=pathlib.Path, required=True)
    aggregate_parser.set_defaults(handler=aggregate_command)

    memory_aggregate_parser = subparsers.add_parser("memory-aggregate")
    memory_aggregate_parser.add_argument(
        "--results-dir", type=pathlib.Path, required=True
    )
    memory_aggregate_parser.add_argument("--output", type=pathlib.Path, required=True)
    memory_aggregate_parser.set_defaults(handler=memory_aggregate_command)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return args.handler(args)
    except (OSError, RuntimeError, ValueError, KeyError, ZeroDivisionError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
