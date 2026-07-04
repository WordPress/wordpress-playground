use std::process::ExitCode;

use wp_playground_native::{args::parse_cli_args, commands::run};

fn main() -> ExitCode {
    let args = std::env::args().skip(1).collect::<Vec<_>>();
    if let Some(output) = immediate_output(&args) {
        println!("{output}");
        return ExitCode::SUCCESS;
    }
    match parse_cli_args(args).and_then(run) {
        Ok(code) => ExitCode::from(code),
        Err(error) => {
            eprintln!("error: {error}");
            ExitCode::from(1)
        }
    }
}

fn immediate_output(args: &[String]) -> Option<String> {
    match args {
        [flag] if flag == "--help" || flag == "-h" => Some(help_text(None).to_string()),
        [flag] if flag == "--version" || flag == "-V" => Some(version_text()),
        [command, rest @ ..] if is_command(command) && has_help_flag_before_delimiter(rest) => {
            Some(help_text(Some(command)).to_string())
        }
        _ => None,
    }
}

fn has_help_flag_before_delimiter(args: &[String]) -> bool {
    for arg in args {
        if arg == "--" {
            return false;
        }
        if arg == "--help" || arg == "-h" {
            return true;
        }
    }
    false
}

fn is_command(command: &str) -> bool {
    matches!(
        command,
        "start" | "server" | "run-blueprint" | "build-snapshot" | "php"
    )
}

fn version_text() -> String {
    format!(
        "wp-playground-native {}",
        option_env!("WP_PLAYGROUND_NATIVE_VERSION")
            .or(option_env!("CARGO_PKG_VERSION"))
            .unwrap_or("unknown")
    )
}

fn help_text(command: Option<&str>) -> &'static str {
    match command {
        Some("start") => concat!(
            "Usage: wp-playground-native start [options]\n\n",
            "Starts a local WordPress server with project auto-mounting, managed persistent storage, login, and browser-opening defaults.\n\n",
            "Common options:\n",
            "  --path <path>                  Project path to auto-detect\n",
            "  --wp <version|url>             WordPress version, default latest\n",
            "  --php <version>                PHP version, default 8.3\n",
            "  --port <port>                  Port, default 9400 when available\n",
            "  --site-url <url>               Override WordPress site URL\n",
            "  --skip-browser                 Do not open the browser\n",
            "  --reset                        Reset managed site storage\n",
            "  --no-auto-mount                Disable project auto-detection\n",
            "  --blueprint <path|url>         Run a Blueprint on startup\n",
            "  --workers <n|auto>             PHP worker count\n",
            "  --opcache <mode>               validate, revalidate, immutable, middle (default), low-memory, or off\n",
            "  --follow-symlinks              Allow mounted symlink targets\n\n",
            "Examples:\n",
            "  wp-playground-native start --path . --php 8.5\n",
            "  wp-playground-native start --blueprint blueprint.json --login"
        ),
        Some("server") => concat!(
            "Usage: wp-playground-native server [options]\n\n",
            "Starts the lower-level native HTTP server for an explicitly mounted WordPress runtime.\n\n",
            "Common options:\n",
            "  --mount <host:vfs>             Mount a host path\n",
            "  --mount-before-install <host:vfs>\n",
            "  --mount-dir <host> <vfs>\n",
            "  --wordpress-install-mode <mode>\n",
            "  --skip-wordpress-install       Deprecated alias for do-not-attempt-installing\n",
            "  --skip-sqlite-setup            Do not install the SQLite integration\n",
            "  --login / --no-login           Enable or disable auto-login\n",
            "  --workers <n|auto>             PHP worker count\n",
            "  --opcache <mode>               validate, revalidate, immutable, middle (default), low-memory, or off\n",
            "  --quiet | --verbosity <level>  Output verbosity\n\n",
            "Examples:\n",
            "  wp-playground-native server --mount-dir ./wordpress /wordpress --port 9400\n",
            "  wp-playground-native server --wp 6.9 --php 8.3 --login"
        ),
        Some("run-blueprint") => concat!(
            "Usage: wp-playground-native run-blueprint [options] [blueprint.json]\n\n",
            "Boots WordPress, runs Blueprint v1 startup steps, and exits without opening an HTTP listener.\n\n",
            "Common options:\n",
            "  --blueprint <path|url>         Blueprint JSON or ZIP source\n",
            "  --blueprint-may-read-adjacent-files\n",
            "  --auto-mount [path]            Auto-detect project mounts\n",
            "  --wp <version|url>\n",
            "  --php <version>\n",
            "  --site-url <url>\n",
            "  --quiet | --verbosity <level>\n\n",
            "Examples:\n",
            "  wp-playground-native run-blueprint blueprint.json\n",
            "  wp-playground-native run-blueprint --blueprint https://example.com/blueprint.json --quiet"
        ),
        Some("build-snapshot") => concat!(
            "Usage: wp-playground-native build-snapshot [options]\n\n",
            "Boots WordPress, applies Blueprint startup steps, and writes a ZIP snapshot of /wordpress.\n\n",
            "Common options:\n",
            "  --outfile <path>               Snapshot path, default wordpress.zip\n",
            "  --blueprint <path|url>         Blueprint JSON or ZIP source\n",
            "  --auto-mount [path]            Auto-detect project mounts\n",
            "  --wp <version|url>\n",
            "  --php <version>\n",
            "  --follow-symlinks              Include followed symlink targets\n",
            "  --quiet | --verbosity <level>\n\n",
            "Examples:\n",
            "  wp-playground-native build-snapshot --blueprint blueprint.json --outfile wordpress.zip\n",
            "  wp-playground-native build-snapshot --auto-mount . --php 8.5"
        ),
        Some("php") => concat!(
            "Usage: wp-playground-native php [options] <script.php|php-args...>\n\n",
            "Runs PHP CLI mode through the native Wasmtime host.\n\n",
            "Common options:\n",
            "  --php <version>                PHP version, default 8.3\n",
            "  --wp <version|url>             WordPress version for shared boot/setup\n",
            "  --mount <host:vfs>\n",
            "  --mount-dir <host> <vfs>\n",
            "  --skip-wordpress-install\n",
            "  --skip-sqlite-setup\n",
            "  --define <name> <value>\n",
            "  --define-bool <name> <value>\n",
            "  --define-number <name> <value>\n",
            "  --opcache <mode>               validate, revalidate, immutable, middle (default), low-memory, or off\n\n",
            "Unknown PHP long options are passed through after native option parsing.\n",
            "Use `--` before PHP flags that should bypass native parsing.\n\n",
            "Examples:\n",
            "  wp-playground-native php --php 8.5 -- -v\n",
            "  wp-playground-native php --skip-wordpress-install script.php"
        ),
        _ => concat!(
            "Usage: wp-playground-native <command> [options]\n\n",
            "Experimental native WordPress Playground CLI backed by Wasmtime.\n\n",
            "Commands:\n",
            "  start                  Start a local WordPress server with project defaults\n",
            "  server                 Start a lower-level mounted WordPress server\n",
            "  run-blueprint          Run Blueprint startup steps without serving\n",
            "  build-snapshot         Export a ZIP snapshot of /wordpress\n",
            "  php                    Run PHP CLI mode\n\n",
            "Global options:\n",
            "  -h, --help             Show help\n",
            "  -V, --version          Show version\n\n",
            "Examples:\n",
            "  wp-playground-native start --path .\n",
            "  wp-playground-native php --php 8.5 -- -v\n\n",
            "Run `wp-playground-native <command> --help` for command-specific options."
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::{immediate_output, version_text};

    fn args(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    #[test]
    fn prints_global_help_and_version_without_runtime_startup() {
        assert!(immediate_output(&args(&["--help"]))
            .unwrap()
            .contains("Usage: wp-playground-native <command>"));
        assert_eq!(
            immediate_output(&args(&["--version"])).unwrap(),
            version_text()
        );
    }

    #[test]
    fn prints_command_help_for_known_commands_only() {
        assert!(immediate_output(&args(&["start", "--help"]))
            .unwrap()
            .contains("Usage: wp-playground-native start"));
        assert!(immediate_output(&args(&["start", "--path", ".", "--help"]))
            .unwrap()
            .contains("Usage: wp-playground-native start"));
        assert!(immediate_output(&args(&["unknown", "--help"])).is_none());
        assert!(immediate_output(&args(&["php", "--", "--help"])).is_none());
    }
}
