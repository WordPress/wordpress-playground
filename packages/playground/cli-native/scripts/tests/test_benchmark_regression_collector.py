from __future__ import annotations

import pathlib
import re
import subprocess
import sys
import unittest


SCRIPT_PATH = (
    pathlib.Path(__file__).resolve().parents[1]
    / "benchmark-regression-collect.sh"
)


def shell_function_body(source: str, name: str) -> str:
    match = re.search(rf"(?ms)^{re.escape(name)}\(\) \{{\n(.*?)^\}}\n", source)
    if match is None:
        raise AssertionError(f"shell function not found: {name}")
    return match.group(1)


class BenchmarkRegressionCollectorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.source = SCRIPT_PATH.read_text(encoding="utf-8")

    def test_login_plugin_requires_dedicated_trigger_and_redirects(self) -> None:
        marker = (
            'cat >"$SITE/wp-content/mu-plugins/'
            '1-native-benchmark-login.php" <<\'PHP\'\n'
        )
        start = self.source.index(marker) + len(marker)
        end = self.source.index("\nPHP\n", start)
        plugin = self.source[start:end]
        gate = "isset($_GET['native_parity_benchmark_login'])"
        self.assertIn(gate, plugin)
        self.assertIn("hash_equals('1'", plugin)
        self.assertLess(
            plugin.index(gate), plugin.index("get_user_by('login', 'admin')")
        )
        self.assertIn("if (!$login_requested)", plugin)
        self.assertIn("wp_safe_redirect(admin_url('site-editor.php'))", plugin)
        self.assertRegex(plugin, r"wp_safe_redirect\([^;]+\);\n\s+exit;")

        login = shell_function_body(self.source, "login")
        self.assertIn('$BASE_URL/?native_parity_benchmark_login=1', login)
        self.assertNotIn('$BASE_URL/wp-admin/site-editor.php', login)

    def test_workload_cookie_scope_is_explicit_and_minimal(self) -> None:
        scope = shell_function_body(self.source, "cookie_scope")
        self.assertRegex(scope, r"public\) echo none ;;")
        self.assertRegex(scope, r"mixed\) echo admin ;;")
        self.assertRegex(scope, r"admin\) echo all ;;")
        run_load = shell_function_body(self.source, "run_load")
        self.assertIn('--cookie-scope "$(cookie_scope "$workload")"', run_load)

    def test_cookie_material_stays_in_private_cleaned_work_root(self) -> None:
        self.assertIn('umask 077', self.source)
        self.assertIn('MAIN_COOKIE="$WORK_ROOT/main.cookies"', self.source)
        self.assertIn('MEMORY_COOKIE="$WORK_ROOT/memory.cookies"', self.source)
        self.assertNotIn('MAIN_COOKIE="$RAW/', self.source)
        self.assertNotIn('MEMORY_COOKIE="$RAW/', self.source)
        self.assertIn('--auth-cookie-file "$LABEL::$AUTH_COOKIE_FILE"', self.source)
        self.assertNotRegex(self.source, r"--auth-cookie(?:\s|\")")

    def test_normalizer_receives_raw_cpu_loads_for_provenance(self) -> None:
        self.assertIn('--cpu-loads-dir "$RAW/cpu"', self.source)
        self.assertIn('--cpu-reports-dir "$RAW/cpu-reports"', self.source)

    def test_transient_service_uses_absolute_tool_paths(self) -> None:
        self.assertIn('BASH_BIN="$(command -v bash)"', self.source)
        self.assertIn('TASKSET_BIN="$(command -v taskset)"', self.source)
        self.assertIn(
            'printf \'exec %q -c %q %q server \' "$TASKSET_BIN"',
            self.source,
        )
        start_service = shell_function_body(self.source, "start_service")
        self.assertIn('"$BASH_BIN" "$START_SCRIPT"', start_service)

    def test_transient_service_runs_as_the_invoking_user(self) -> None:
        self.assertIn('SERVICE_USER="$(id -un)"', self.source)
        self.assertIn('SERVICE_GROUP="$(id -gn)"', self.source)
        start_service = shell_function_body(self.source, "start_service")
        self.assertIn(
            '--uid="$SERVICE_USER" --gid="$SERVICE_GROUP"', start_service
        )

    def test_transient_service_has_an_isolated_home(self) -> None:
        self.assertIn('"$WORK_ROOT/home"', self.source)
        self.assertIn(
            "printf 'export HOME=%q\\n' \"$WORK_ROOT/home\"",
            self.source,
        )

    def test_each_collection_starts_with_fresh_artifacts(self) -> None:
        remove_output = self.source.index('rm -f -- "$OUTPUT"')
        remove_artifacts = self.source.index('rm -rf -- "$ARTIFACT_ROOT"')
        create_artifacts = self.source.index('mkdir -p "$RAW/throughput"')
        self.assertLess(remove_output, create_artifacts)
        self.assertLess(remove_artifacts, create_artifacts)

    def test_public_post_route_disables_canonical_redirects(self) -> None:
        self.assertIn("POST_PATH='/?p=1'", self.source)
        self.assertIn(
            "add_filter('redirect_canonical', '__return_false');",
            self.source,
        )

    @unittest.skipIf(sys.platform == "win32", "collector is a Linux shell script")
    def test_collector_has_valid_bash_syntax(self) -> None:
        subprocess.run(["bash", "-n", str(SCRIPT_PATH)], check=True)


if __name__ == "__main__":
    unittest.main()
