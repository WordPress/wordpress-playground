from __future__ import annotations

import argparse
import contextlib
import importlib.util
import io
import json
import pathlib
import sys
import tempfile
import unittest
from unittest import mock


SCRIPT_DIR = pathlib.Path(__file__).resolve().parents[1]
MODULE_PATH = SCRIPT_DIR / "benchmark-process-resources.py"
SPEC = importlib.util.spec_from_file_location(
    "benchmark_process_resources", MODULE_PATH
)
assert SPEC is not None and SPEC.loader is not None
resources = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = resources
SPEC.loader.exec_module(resources)


def write_json(path: pathlib.Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value) + "\n", encoding="utf-8")


class BenchmarkProcessResourcesTests(unittest.TestCase):
    def test_proc_stat_and_key_value_parsers_handle_expected_shapes(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = pathlib.Path(temp_dir)
            stat = root / "stat"
            fields = ["S", *(str(value) for value in range(1, 25))]
            stat.write_text(
                f"123 (worker ) name) {' '.join(fields)}\n", encoding="ascii"
            )
            self.assertEqual(resources.parse_stat(stat), (11, 12, 19))
            values = root / "values"
            values.write_text(
                "usage_usec 1200\nnr_throttled 0\ninvalid line here\n",
                encoding="ascii",
            )
            self.assertEqual(
                resources.key_value_file(values),
                {"usage_usec": 1200, "nr_throttled": 0},
            )

    def test_cgroup_cpu_snapshot_aggregates_tasks_and_counters(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = pathlib.Path(temp_dir)
            (root / "cpu.stat").write_text(
                "usage_usec 2500000\nuser_usec 2000000\nsystem_usec 500000\n",
                encoding="ascii",
            )
            (root / "memory.events").write_text("oom 0\noom_kill 0\n", encoding="ascii")
            (root / "memory.current").write_text(
                str(10 * resources.MIB), encoding="ascii"
            )
            (root / "memory.peak").write_text(str(12 * resources.MIB), encoding="ascii")
            with (
                mock.patch.object(resources, "cgroup_root", return_value=root),
                mock.patch.object(resources, "cgroup_pids", return_value=[10, 20]),
                mock.patch.object(
                    resources,
                    "process_cpu_ticks",
                    side_effect=[(5, 2, {"10:10": 1}), (7, 3, {"20:20": 2})],
                ),
            ):
                result = resources.cgroup_cpu_snapshot("fixture")
            self.assertEqual(result["pids"], [10, 20])
            self.assertEqual(result["threads"], 5)
            self.assertEqual(result["cpu_seconds"], 2.5)
            self.assertEqual(result["memory_current_mib"], 10)
            self.assertEqual(result["memory_peak_mib"], 12)

    def test_cpu_report_computes_deltas_and_rejects_throttling(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = pathlib.Path(temp_dir)
            before_path = root / "before.json"
            after_path = root / "after.json"
            load_path = root / "load.json"
            output_path = root / "report.json"
            before = {
                "cpu": {
                    "usage_usec": 1_000_000,
                    "user_usec": 800_000,
                    "system_usec": 200_000,
                    "nr_throttled": 0,
                    "throttled_usec": 0,
                },
                "memory_events": {"oom": 0, "oom_kill": 0, "oom_group_kill": 0},
                "pids": [1],
                "threads": 2,
                "task_start_ticks": {"1:1": 1},
            }
            after = {
                **before,
                "cpu": {
                    "usage_usec": 2_080_000,
                    "user_usec": 1_700_000,
                    "system_usec": 380_000,
                    "nr_throttled": 0,
                    "throttled_usec": 0,
                },
            }
            load = {
                "elapsed_s": 0.5,
                "summary": {
                    "successes": 216,
                    "errors": 0,
                    "successful_rps": 432,
                },
            }
            write_json(before_path, before)
            write_json(after_path, after)
            write_json(load_path, load)
            args = argparse.Namespace(
                label="wasmtime",
                workload="public",
                round=1,
                before=before_path,
                after=after_path,
                load=load_path,
                output=output_path,
            )
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(resources.cpu_report_command(args), 0)
            report = json.loads(output_path.read_text(encoding="utf-8"))
            self.assertEqual(report["schema_version"], 1)
            self.assertEqual(report["successes"], 216)
            self.assertEqual(report["successful_rps"], 432)
            self.assertEqual(report["cpu_ms_per_request"], 5)
            after["cpu"]["nr_throttled"] = 1
            write_json(after_path, after)
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(resources.cpu_report_command(args), 1)

    def test_cpu_and_memory_aggregates_are_deterministic(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = pathlib.Path(temp_dir)
            reports = root / "reports"
            for workload_index, workload in enumerate(("public", "mixed", "admin")):
                for round_number, value in enumerate((10.0, 30.0), start=1):
                    write_json(
                        reports / f"wasmtime-{workload}-{round_number}.json",
                        {
                            "label": "wasmtime",
                            "workload": workload,
                            "errors": 0,
                            "cpu_ms_per_request": value + workload_index,
                            "average_cores": 2 + workload_index,
                            "successful_rps": 50 - workload_index,
                        },
                    )
            cpu_output = root / "cpu.json"
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(
                    resources.aggregate_command(
                        argparse.Namespace(
                            reports_dir=reports,
                            idle=[],
                            output=cpu_output,
                        )
                    ),
                    0,
                )
            cpu = json.loads(cpu_output.read_text(encoding="utf-8"))
            self.assertEqual(cpu["schema_version"], 1)
            public = next(row for row in cpu["cpu_rows"] if row["workload"] == "public")
            self.assertEqual(public["cpu_ms_per_request"], 20)

            memory_root = root / "memory" / "wasmtime"
            idle_samples = [
                {
                    "pss_mib": 100,
                    "rss_mib": 110,
                    "uss_mib": 90,
                    "memory_current_mib": 105,
                },
                {
                    "pss_mib": 120,
                    "rss_mib": 130,
                    "uss_mib": 100,
                    "memory_current_mib": 115,
                },
            ]
            write_json(memory_root / "idle-samples.json", {"samples": idle_samples})
            for index, workload in enumerate(("public", "mixed", "admin"), start=1):
                write_json(
                    memory_root / workload / "active-samples.json",
                    {
                        "sample_count": 2,
                        "peak_pss_mib": 130 + index,
                        "peak_rss_mib": 140 + index,
                        "peak_uss_mib": 120 + index,
                        "peak_memory_current_mib": 135 + index,
                        "cgroup_memory_peak_mib": 136 + index,
                        "samples": [
                            {
                                "pss_mib": 125 + index,
                                "rss_mib": 135 + index,
                                "uss_mib": 115 + index,
                                "memory_current_mib": 130 + index,
                            },
                            {
                                "pss_mib": 130 + index,
                                "rss_mib": 140 + index,
                                "uss_mib": 120 + index,
                                "memory_current_mib": 135 + index,
                            },
                        ],
                    },
                )
            memory_output = root / "memory.json"
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(
                    resources.memory_aggregate_command(
                        argparse.Namespace(
                            results_dir=root / "memory", output=memory_output
                        )
                    ),
                    0,
                )
            memory = json.loads(memory_output.read_text(encoding="utf-8"))
            self.assertEqual(memory["schema_version"], 1)
            self.assertEqual(memory["memory_rows"][0]["idle_pss_median_mib"], 110)
            self.assertEqual(memory["memory_rows"][0]["active_pss_peak_mib"], 133)


if __name__ == "__main__":
    unittest.main()
