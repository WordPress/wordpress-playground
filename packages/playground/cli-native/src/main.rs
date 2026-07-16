use std::{path::PathBuf, process::ExitCode};

use serde::Serialize;
use wp_playground_native::{
    args::{parse_cli_args, CommandName},
    commands::{prepare_native_runtime, run_with_control},
    terminal::TerminalStyle,
    CliError, Result,
};

const ARGV_PROBE_FLAG: &str = "--experimental-parse-argv-json";

#[derive(Serialize)]
#[serde(untagged)]
enum ArgvProbeOutput {
    Valid {
        #[serde(rename = "schemaVersion")]
        schema_version: u8,
        status: &'static str,
        command: &'static str,
        port: Option<u16>,
        #[serde(rename = "siteUrl")]
        site_url: Option<String>,
    },
    Invalid {
        #[serde(rename = "schemaVersion")]
        schema_version: u8,
        status: &'static str,
        #[serde(rename = "exitCode")]
        exit_code: u8,
        message: String,
    },
}

fn main() -> ExitCode {
    let mut args = std::env::args().skip(1).collect::<Vec<_>>();
    match extract_argv_probe(&args) {
        Ok(Some(probe_args)) => {
            println!("{}", argv_probe_output(probe_args.to_vec()));
            return ExitCode::SUCCESS;
        }
        Ok(None) => {}
        Err(error) => return exit_with_error(error),
    }
    if let Some(output) = immediate_output(&args, TerminalStyle::stdout().enabled()) {
        println!("{output}");
        return ExitCode::SUCCESS;
    }
    if args == ["runtime", "install"] {
        return match prepare_native_runtime() {
            Ok(()) => {
                println!("Native PHP runtime is ready");
                ExitCode::SUCCESS
            }
            Err(error) => exit_with_error(error),
        };
    }
    let handshake = match extract_control_handshake(&mut args) {
        Ok(handshake) => handshake,
        Err(error) => return exit_with_error(error),
    };
    match parse_cli_args(args).and_then(|options| run_with_control(options, handshake)) {
        Ok(code) => ExitCode::from(code),
        Err(error) => exit_with_error(error),
    }
}

fn extract_argv_probe(args: &[String]) -> Result<Option<&[String]>> {
    if let Some((first, rest)) = args.split_first() {
        if first == ARGV_PROBE_FLAG {
            return Ok(Some(rest));
        }
    }
    if args.iter().any(|arg| arg == ARGV_PROBE_FLAG) {
        return Err(CliError::new(format!(
            "{ARGV_PROBE_FLAG} must be the first argument"
        )));
    }
    Ok(None)
}

fn argv_probe_output(args: Vec<String>) -> String {
    let output = match parse_cli_args(args) {
        Ok(options) => ArgvProbeOutput::Valid {
            schema_version: 1,
            status: "valid",
            command: command_name(&options.command),
            port: options.port,
            site_url: options.site_url,
        },
        Err(error) => ArgvProbeOutput::Invalid {
            schema_version: 1,
            status: "invalid",
            exit_code: 1,
            message: error.to_string(),
        },
    };
    serde_json::to_string(&output).expect("argv probe output is always serializable")
}

fn command_name(command: &CommandName) -> &'static str {
    match command {
        CommandName::Start => "start",
        CommandName::Server => "server",
        CommandName::RunBlueprint => "run-blueprint",
        CommandName::BuildSnapshot => "build-snapshot",
    }
}

fn exit_with_error(error: CliError) -> ExitCode {
    let style = TerminalStyle::stderr();
    eprintln!("{} {error}", style.red("Error:"));
    ExitCode::from(1)
}

fn extract_control_handshake(args: &mut Vec<String>) -> Result<Option<PathBuf>> {
    let mut handshake = None;
    let mut index = 0;
    while index < args.len() {
        let inline = args[index]
            .strip_prefix("--experimental-control-handshake=")
            .map(str::to_string);
        if args[index] == "--experimental-control-handshake" || inline.is_some() {
            if handshake.is_some() {
                return Err(CliError::new(
                    "--experimental-control-handshake may only be specified once",
                ));
            }
            let path = if let Some(path) = inline {
                if path.is_empty() {
                    return Err(CliError::new(
                        "--experimental-control-handshake requires a path",
                    ));
                }
                args.remove(index);
                path
            } else {
                if index + 1 >= args.len() {
                    return Err(CliError::new(
                        "--experimental-control-handshake requires a path",
                    ));
                }
                args.remove(index);
                args.remove(index)
            };
            handshake = Some(PathBuf::from(path));
            continue;
        }
        index += 1;
    }
    Ok(handshake)
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
        "start" | "server" | "run-blueprint" | "build-snapshot" | "runtime"
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
        Some("runtime") => concat!(
            "Usage: wp-playground-native runtime install\n\n",
            "Compiles and caches the packaged PHP WASIp2 component for both native engine profiles."
        ),
        _ => concat!(
            "Usage: wp-playground-native <command> [options]\n\n",
            "Experimental Wasmtime WordPress Playground CLI.\n\n",
            "Commands:\n",
            "  start                  Start a local WordPress server with project defaults\n",
            "  server                 Start a lower-level mounted WordPress server\n",
            "  run-blueprint          Run Blueprint startup steps without serving\n",
            "  build-snapshot         Export a ZIP snapshot of /wordpress\n\n",
            "  runtime install        Prepare and cache the packaged PHP runtime\n\n",
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
    use super::{
        argv_probe_output, extract_argv_probe, extract_control_handshake, format_help,
        immediate_output, version_text, ARGV_PROBE_FLAG,
    };

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

    #[test]
    fn extracts_hidden_control_handshake_before_cli_parsing() {
        let mut values = args(&[
            "start",
            "--experimental-control-handshake",
            "/tmp/handshake.json",
            "--port",
            "9400",
        ]);
        let path = extract_control_handshake(&mut values).unwrap().unwrap();
        assert_eq!(path, std::path::PathBuf::from("/tmp/handshake.json"));
        assert_eq!(values, args(&["start", "--port", "9400"]));
    }

    #[test]
    fn argv_probe_reports_valid_server_metadata() {
        assert_eq!(
            argv_probe_output(args(&[
                "server",
                "--port",
                "9501",
                "--site-url",
                "https://playground.test",
            ])),
            r#"{"schemaVersion":1,"status":"valid","command":"server","port":9501,"siteUrl":"https://playground.test"}"#
        );
    }

    #[test]
    fn argv_probe_reports_unknown_arguments_as_invalid_json() {
        let output = argv_probe_output(args(&["server", "--definitely-unknown"]));
        let output: serde_json::Value = serde_json::from_str(&output).unwrap();
        assert_eq!(output["schemaVersion"], 1);
        assert_eq!(output["status"], "invalid");
        assert_eq!(output["exitCode"], 1);
        assert!(output["message"]
            .as_str()
            .unwrap()
            .contains("Unknown option `--definitely-unknown`"));
    }

    #[test]
    fn argv_probe_is_dispatched_before_runtime_asset_startup() {
        let invocation = args(&[ARGV_PROBE_FLAG, "runtime", "install"]);
        let probe_args = extract_argv_probe(&invocation).unwrap().unwrap();
        let output: serde_json::Value =
            serde_json::from_str(&argv_probe_output(probe_args.to_vec())).unwrap();
        assert_eq!(output["status"], "invalid");
        assert!(output["message"]
            .as_str()
            .unwrap()
            .contains("Unknown command `runtime`"));
    }

    #[test]
    fn argv_probe_flag_is_rejected_when_it_is_not_first() {
        let error = extract_argv_probe(&args(&["server", ARGV_PROBE_FLAG])).unwrap_err();
        assert_eq!(
            error.to_string(),
            "--experimental-parse-argv-json must be the first argument"
        );
    }
}
