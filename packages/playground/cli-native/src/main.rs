use std::process::ExitCode;

use wp_playground_native::{args::parse_cli_args, commands::run, terminal::TerminalStyle};

fn main() -> ExitCode {
    let args = std::env::args().skip(1).collect::<Vec<_>>();
    if let Some(output) = immediate_output(&args, TerminalStyle::stdout().enabled()) {
        println!("{output}");
        return ExitCode::SUCCESS;
    }
    match parse_cli_args(args).and_then(run) {
        Ok(code) => ExitCode::from(code),
        Err(error) => {
            let style = TerminalStyle::stderr();
            eprintln!("{} {error}", style.red("Error:"));
            ExitCode::from(1)
        }
    }
}

fn immediate_output(args: &[String], color: bool) -> Option<String> {
    match args {
        [] => Some(format_help(None, color)),
        [flag] if flag == "--help" || flag == "-h" => Some(format_help(None, color)),
        [flag] if flag == "--version" || flag == "-V" => Some(version_text()),
        [command, rest @ ..] if is_command(command) && has_help_flag_before_delimiter(rest) => {
            Some(format_help(Some(command), color))
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
        "start" | "server" | "run-blueprint" | "build-snapshot"
    )
}

fn version_text() -> String {
    format!(
        "wp-playground-native {}",
        option_env!("WP_PLAYGROUND_WASMTIME_VERSION")
            .or(option_env!("WP_PLAYGROUND_NATIVE_VERSION"))
            .or(option_env!("CARGO_PKG_VERSION"))
            .unwrap_or("unknown")
    )
}

fn format_help(command: Option<&str>, color: bool) -> String {
    let text = help_text(command);
    if color {
        colorize_help(text)
    } else {
        text.to_string()
    }
}

fn colorize_help(text: &str) -> String {
    text.lines()
        .map(colorize_help_line)
        .collect::<Vec<_>>()
        .join("\n")
}

fn colorize_help_line(line: &str) -> String {
    let style = TerminalStyle::color();

    if let Some(rest) = line.strip_prefix("Usage:") {
        return format!("{}{rest}", style.bold_cyan("Usage:"));
    }
    if matches!(
        line,
        "Commands:" | "Global options:" | "Common options:" | "Examples:"
    ) {
        return style.bold_yellow(line);
    }
    if let Some(rest) = line.strip_prefix("  wp-playground-native") {
        return format!("  {}{rest}", style.bold_cyan("wp-playground-native"));
    }
    if let Some(rest) = line.strip_prefix("  package-native-cli") {
        return format!("  {}{rest}", style.bold_cyan("package-native-cli"));
    }
    if let Some(rest) = line.strip_prefix("  ") {
        if let Some((name, description)) = split_help_row(rest) {
            if is_command(name) || name.starts_with('-') {
                return format!("  {}{}", style.green(name), style.dim(description));
            }
        }
    }

    line.to_string()
}

fn split_help_row(row: &str) -> Option<(&str, &str)> {
    let split_at = row
        .char_indices()
        .find_map(|(index, _)| row[index..].starts_with("  ").then_some(index))?;
    Some(row.split_at(split_at))
}

fn help_text(command: Option<&str>) -> &'static str {
    match command {
        Some("start") => concat!(
            "Usage: wp-playground-native start [options]\n\n",
            "Starts a local WordPress server with project auto-mounting, managed persistent storage, login, and browser-opening defaults.\n\n",
            "Common options:\n",
            "  --path <path>                  Project path to auto-detect\n",
            "  --wp <version|url>             WordPress version, default latest\n",
            "  --php <version>                PHP version, default 8.2\n",
            "  --port <port>                  Port, default 9400 when available\n",
            "  --site-url <url>               Override WordPress site URL\n",
            "  --skip-browser                 Do not open the browser\n",
            "  --reset                        Reset managed site storage\n",
            "  --login / --no-login           Enable or disable auto-login\n",
            "  --no-auto-mount                Disable project auto-detection\n",
            "  --blueprint <path|url>         Run a Blueprint on startup\n",
            "  --workers <n|auto>             Prewarm and retain a PHP worker pool\n",
            "  --follow-symlinks              Allow mounted symlink targets\n\n",
            "Examples:\n",
            "  wp-playground-native start --path . --php 8.2\n",
            "  wp-playground-native start --blueprint blueprint.json --login"
        ),
        Some("server") => concat!(
            "Usage: wp-playground-native server [options]\n\n",
            "Starts the lower-level Wasmtime HTTP server for an explicitly mounted WordPress runtime.\n\n",
            "Common options:\n",
            "  --mount <host:vfs>             Mount a host path\n",
            "  --mount-before-install <host:vfs>\n",
            "  --mount-dir <host> <vfs>\n",
            "  --wordpress-install-mode <mode>\n",
            "  --skip-wordpress-install       Deprecated alias for do-not-attempt-installing\n",
            "  --skip-sqlite-setup            Do not install the SQLite integration\n",
            "  --login / --no-login           Enable or disable auto-login\n",
            "  --workers <n|auto>             Prewarm and retain a PHP worker pool\n",
            "  --quiet | --verbosity <level>  Output verbosity\n\n",
            "Examples:\n",
            "  wp-playground-native server --mount-dir ./wordpress /wordpress --port 9400\n",
            "  wp-playground-native server --wp 6.9 --php 8.2 --login"
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
            "  wp-playground-native build-snapshot --auto-mount . --php 8.2"
        ),
        _ => concat!(
            "Usage: wp-playground-native <command> [options]\n\n",
            "Experimental Wasmtime WordPress Playground CLI.\n\n",
            "Commands:\n",
            "  start                  Start a local WordPress server with project defaults\n",
            "  server                 Start a lower-level mounted WordPress server\n",
            "  run-blueprint          Run Blueprint startup steps without serving\n",
            "  build-snapshot         Export a ZIP snapshot of /wordpress\n\n",
            "Global options:\n",
            "  -h, --help             Show help\n",
            "  -V, --version          Show version\n\n",
            "Examples:\n",
            "  wp-playground-native start --path .\n",
            "  wp-playground-native run-blueprint blueprint.json\n\n",
            "Run `wp-playground-native <command> --help` for command-specific options."
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::{format_help, immediate_output, version_text};

    fn args(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    #[test]
    fn prints_global_help_and_version_without_runtime_startup() {
        assert!(immediate_output(&args(&[]), false)
            .unwrap()
            .contains("Usage: wp-playground-native <command>"));
        assert!(immediate_output(&args(&["--help"]), false)
            .unwrap()
            .contains("Usage: wp-playground-native <command>"));
        assert_eq!(
            immediate_output(&args(&["--version"]), false).unwrap(),
            version_text()
        );
    }

    #[test]
    fn prints_command_help_for_known_commands_only() {
        let start_help = immediate_output(&args(&["start", "--help"]), false).unwrap();
        assert!(start_help.contains("Usage: wp-playground-native start"));
        assert!(
            immediate_output(&args(&["start", "--path", ".", "--help"]), false)
                .unwrap()
                .contains("Usage: wp-playground-native start")
        );
        assert!(immediate_output(&args(&["unknown", "--help"]), false).is_none());
        assert!(immediate_output(&args(&["php", "--", "--help"]), false).is_none());
    }

    #[test]
    fn can_colorize_help_output() {
        let output = format_help(None, true);
        assert!(output.contains("\x1b[1;36mUsage:\x1b[0m"));
        assert!(output.contains("\x1b[1;33mCommands:\x1b[0m"));
        assert!(output.contains("\x1b[32mstart\x1b[0m"));
    }
}
