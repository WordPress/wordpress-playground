import pathlib
import re
import subprocess
import sys
import unittest


SCRIPT_PATH = pathlib.Path(__file__).resolve().parents[1] / "benchmark-wordpress.sh"


def shell_function_body(source: str, name: str) -> str:
    match = re.search(
        rf"(?ms)^{re.escape(name)}\(\) \{{\n(.*?)^\}}\n",
        source,
    )
    if match is None:
        raise AssertionError(f"shell function not found: {name}")
    return match.group(1)


@unittest.skipIf(sys.platform == "win32", "shell syntax validation requires bash")
class BenchmarkWordPressScriptUnixTests(unittest.TestCase):
    def test_script_has_valid_shell_syntax(self):
        subprocess.run(["bash", "-n", str(SCRIPT_PATH)], check=True)


class BenchmarkWordPressScriptPortableTests(unittest.TestCase):
    def test_component_php_defaults_reach_bootstrap_and_measured_servers(self):
        source = SCRIPT_PATH.read_text(encoding="utf-8")

        for function_name in ("bootstrap_wordpress_site", "run_wasmtime_case"):
            body = shell_function_body(source, function_name)
            self.assertIn('--php="$PHP_VERSION"', body)

        self.assertIn('PHP_VERSION="${PHP_VERSION:-8.2}"', source)
        self.assertNotIn("PHP_PROFILE", source)
        self.assertNotIn("WASMTIME_DISABLE_INTL", source)
        self.assertNotIn('--opcache=', source)

    def test_benchmark_disables_admin_update_checks_for_both_runtimes(self):
        source = SCRIPT_PATH.read_text(encoding="utf-8")
        body = shell_function_body(source, "write_http_block_mu_plugin")

        for callback in (
            "_maybe_update_core",
            "_maybe_update_plugins",
            "_maybe_update_themes",
        ):
            self.assertIn(
                f"remove_action('admin_init', '{callback}')",
                body,
            )

        self.assertLess(
            source.index('write_http_block_mu_plugin "$SOURCE_SITE"'),
            source.index('copy_site "$SOURCE_SITE" "$WASM_SITE"'),
        )

    def test_component_packages_with_release_equivalent_codegen(self):
        source = SCRIPT_PATH.read_text(encoding="utf-8")
        body = shell_function_body(source, "build_package")

        self.assertIn('"$PACKAGE_PRECOMPILE_WASMTIME" == "1"', body)
        self.assertIn('"$PACKAGE_RELEASE_CODEGEN" == "1"', body)
        self.assertIn("rustc -vV | sed -n 's/^host: //p'", body)
        self.assertIn(
            'package_env+=("WP_PLAYGROUND_NATIVE_TARGET_TRIPLE=$package_target_triple")',
            body,
        )


if __name__ == "__main__":
    unittest.main()
