use std::{
    env, fs,
    path::{Path, PathBuf},
};

use crate::{
    automount::{expand_auto_mounts, AutoMountInput, BlueprintStep},
    host::{OpcacheMode, PhpConstantValue},
    mount::{parse_mount_dir_arguments, parse_mount_with_delimiter_arguments, Mount},
    paths::{resolve_site_storage, SiteStorage, WordPressInstallMode},
    CliError, Result,
};

pub const DEFAULT_PHP_VERSION: &str = "8.3";
pub const DEFAULT_WP_VERSION: &str = "latest";
pub const DEFAULT_PORT: u16 = 9400;
pub const SUPPORTED_PHP_VERSIONS: &[&str] = &["7.4", "8.0", "8.1", "8.2", "8.3", "8.4", "8.5"];
const COMMAND_NAMES: &[&str] = &["start", "server", "run-blueprint", "build-snapshot", "php"];
const SUPPORTED_OPTION_NAMES: &[&str] = &[
    "path",
    "wp",
    "php",
    "port",
    "site-url",
    "mount",
    "mount-before-install",
    "mount-dir",
    "mount-dir-before-install",
    "auto-mount",
    "no-auto-mount",
    "reset",
    "login",
    "no-login",
    "skip-browser",
    "blueprint",
    "blueprint-may-read-adjacent-files",
    "outfile",
    "wordpress-install-mode",
    "skip-wordpress-install",
    "skip-sqlite-setup",
    "define",
    "define-bool",
    "define-number",
    "workers",
    "verbosity",
    "quiet",
    "debug",
    "follow-symlinks",
    "intl",
    "opcache",
];
const UNSUPPORTED_NATIVE_V1_OPTION_NAMES: &[&str] = &[
    "phpmyadmin",
    "xdebug",
    "experimental-unsafe-ide-integration",
    "experimental-devtools",
    "experimental-blueprints-v2-runner",
    "experimental-multi-worker",
    "experimental-trace",
    "internal-cookie-store",
    "php-extension",
    "no-intl",
    "mode",
    "redis",
    "memcached",
];

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CommandName {
    Start,
    Server,
    RunBlueprint,
    BuildSnapshot,
    Php,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RuntimeCommand {
    Server,
    RunBlueprint,
    BuildSnapshot,
    Php,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AutoMountSetting {
    Unspecified,
    Enabled,
    Disabled,
    Path(PathBuf),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WorkerCount {
    Auto,
    Fixed(usize),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Verbosity {
    Quiet,
    Normal,
    Debug,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DefinedConstantKind {
    String,
    Bool,
    Number,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DefinedConstant {
    pub name: String,
    pub value: PhpConstantValue,
    pub kind: DefinedConstantKind,
    pub is_default: bool,
}

impl DefinedConstant {
    pub fn as_host_pair(&self) -> (String, PhpConstantValue) {
        (self.name.clone(), self.value.clone())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CliOptions {
    pub command: CommandName,
    pub php: String,
    pub wp: String,
    pub port: Option<u16>,
    pub site_url: Option<String>,
    pub path: Option<PathBuf>,
    pub mounts: Vec<Mount>,
    pub mounts_before_install: Vec<Mount>,
    pub auto_mount: AutoMountSetting,
    pub reset: bool,
    pub login: bool,
    pub skip_browser: bool,
    pub blueprint: Option<String>,
    pub blueprint_may_read_adjacent_files: bool,
    pub wordpress_install_mode: WordPressInstallMode,
    pub wordpress_install_mode_explicit: bool,
    pub skip_sqlite_setup: bool,
    pub workers: Option<WorkerCount>,
    pub verbosity: Verbosity,
    pub debug: bool,
    pub follow_symlinks: bool,
    pub intl: bool,
    pub opcache: OpcacheMode,
    pub defined_constants: Vec<DefinedConstant>,
    pub mode: Option<String>,
    pub outfile: Option<PathBuf>,
    pub additional_blueprint_steps: Vec<BlueprintStep>,
    pub script: Option<PathBuf>,
    pub php_args: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RuntimeConfig {
    pub command: RuntimeCommand,
    pub original_command: CommandName,
    pub options: CliOptions,
    pub site_storage: Option<SiteStorage>,
    pub server_url: Option<String>,
}

pub fn parse_cli_args(args: Vec<String>) -> Result<CliOptions> {
    let cwd = env::current_dir()?;
    parse_cli_args_from(args, &cwd)
}

pub fn parse_cli_args_from(args: Vec<String>, cwd: &Path) -> Result<CliOptions> {
    let mut parser = Parser::new(args);
    let command = match parser.next() {
        Some(command) if command == "start" => CommandName::Start,
        Some(command) if command == "server" => CommandName::Server,
        Some(command) if command == "run-blueprint" => CommandName::RunBlueprint,
        Some(command) if command == "build-snapshot" => CommandName::BuildSnapshot,
        Some(command) if command == "php" => CommandName::Php,
        Some(command) => return Err(unknown_command_error(&command)),
        None => {
            return Err(CliError::new(
                "Please specify a command: start, server, run-blueprint, build-snapshot, or php. Run `wp-playground-native --help` for examples.",
            ));
        }
    };

    let mut options = default_options(command, cwd);

    let mut php_passthrough = false;
    let mut debug_flag_seen = false;
    while let Some(token) = parser.next() {
        if options.command == CommandName::Php && php_passthrough {
            options.php_args.push(token);
            continue;
        }

        if token == "--" {
            if options.command != CommandName::Php {
                return Err(CliError::new(format!(
                    "Unexpected `--` for the {} command. The option terminator is only supported by `wp-playground-native php` when passing flags through to PHP.",
                    options.command.as_str()
                )));
            }
            while let Some(value) = parser.next() {
                options.php_args.push(value);
            }
            php_passthrough = true;
            continue;
        }

        if token.starts_with('-') && !token.starts_with("--") {
            if options.command == CommandName::Php {
                options.php_args.push(token);
                php_passthrough = true;
                continue;
            }
            return Err(unknown_short_option_error(&token, &options.command));
        }

        if !token.starts_with("--") {
            if options.command == CommandName::Php {
                if options.script.is_none() && !token.starts_with('-') {
                    options.script = Some(resolve_path(cwd, &token));
                }
                options.php_args.push(token);
                php_passthrough = true;
                continue;
            }
            if options.command == CommandName::RunBlueprint && options.blueprint.is_none() {
                options.blueprint = Some(resolve_blueprint_source(cwd, &token));
                continue;
            }
            return Err(CliError::new(format!(
                "Unexpected positional argument: {token}"
            )));
        }

        let (flag, inline_value) = split_long_option(&token)?;
        ensure_option_allowed_for_command(flag, &options.command)?;
        match flag {
            "path" => {
                options.path = Some(resolve_path(cwd, &parser.value(flag, inline_value)?));
            }
            "wp" => {
                options.wp = parser.value(flag, inline_value)?;
            }
            "php" => {
                let php = parser.value(flag, inline_value)?;
                validate_php_version(&php)?;
                options.php = php;
            }
            "port" => {
                let value = parser.value(flag, inline_value)?;
                options.port = Some(parse_port(&value)?);
            }
            "site-url" => {
                let value = parser.value(flag, inline_value)?;
                validate_site_url(&value)?;
                options.site_url = Some(value);
            }
            "mount" => {
                let value = parser.value(flag, inline_value)?;
                options
                    .mounts
                    .extend(parse_mount_with_delimiter_arguments(&[value])?);
            }
            "mount-before-install" => {
                let value = parser.value(flag, inline_value)?;
                options
                    .mounts_before_install
                    .extend(parse_mount_with_delimiter_arguments(&[value])?);
            }
            "mount-dir" => {
                if inline_value.is_some() {
                    return Err(CliError::new("--mount-dir expects two separate values"));
                }
                let values = vec![parser.required_value(flag)?, parser.required_value(flag)?];
                options
                    .mounts
                    .extend(parse_mount_dir_arguments(&values, cwd)?);
            }
            "mount-dir-before-install" => {
                if inline_value.is_some() {
                    return Err(CliError::new(
                        "--mount-dir-before-install expects two separate values",
                    ));
                }
                let values = vec![parser.required_value(flag)?, parser.required_value(flag)?];
                options
                    .mounts_before_install
                    .extend(parse_mount_dir_arguments(&values, cwd)?);
            }
            "auto-mount" => {
                options.auto_mount = parse_auto_mount(&mut parser, inline_value, cwd)?;
            }
            "no-auto-mount" => {
                if inline_value.is_some() {
                    return Err(CliError::new("--no-auto-mount does not accept a value"));
                }
                options.auto_mount = AutoMountSetting::Disabled;
            }
            "reset" => {
                reject_value(flag, inline_value)?;
                options.reset = true;
            }
            "login" => {
                reject_value(flag, inline_value)?;
                options.login = true;
            }
            "no-login" => {
                reject_value(flag, inline_value)?;
                options.login = false;
            }
            "skip-browser" => {
                reject_value(flag, inline_value)?;
                options.skip_browser = true;
            }
            "blueprint" => {
                options.blueprint = Some(resolve_blueprint_source(
                    cwd,
                    &parser.value(flag, inline_value)?,
                ));
            }
            "blueprint-may-read-adjacent-files" => {
                reject_value(flag, inline_value)?;
                options.blueprint_may_read_adjacent_files = true;
            }
            "outfile" => {
                options.outfile = Some(resolve_path(cwd, &parser.value(flag, inline_value)?));
            }
            "wordpress-install-mode" => {
                options.wordpress_install_mode =
                    WordPressInstallMode::parse(&parser.value(flag, inline_value)?)?;
                options.wordpress_install_mode_explicit = true;
            }
            "skip-wordpress-install" => {
                reject_value(flag, inline_value)?;
                options.wordpress_install_mode = WordPressInstallMode::DoNotAttemptInstalling;
                options.wordpress_install_mode_explicit = true;
            }
            "skip-sqlite-setup" => {
                reject_value(flag, inline_value)?;
                options.skip_sqlite_setup = true;
            }
            "define" => {
                let name = parser.value(flag, inline_value)?;
                let value = parser.required_value(flag)?;
                add_defined_constant(
                    &mut options,
                    DefinedConstantKind::String,
                    name,
                    PhpConstantValue::string(value),
                    false,
                )?;
            }
            "define-bool" => {
                let name = parser.value(flag, inline_value)?;
                let value = parser.required_value(flag)?;
                let value = parse_define_bool(&value, &name)?;
                add_defined_constant(
                    &mut options,
                    DefinedConstantKind::Bool,
                    name,
                    PhpConstantValue::bool(value),
                    false,
                )?;
            }
            "define-number" => {
                let name = parser.value(flag, inline_value)?;
                let value = parser.required_value(flag)?;
                let value = parse_define_number(&value, &name)?;
                add_defined_constant(
                    &mut options,
                    DefinedConstantKind::Number,
                    name,
                    PhpConstantValue::number(value),
                    false,
                )?;
            }
            "workers" => {
                options.workers = Some(parse_workers(&parser.value(flag, inline_value)?)?);
            }
            "verbosity" => {
                let verbosity = parse_verbosity(&parser.value(flag, inline_value)?)?;
                if !debug_flag_seen {
                    options.debug = matches!(verbosity, Verbosity::Debug);
                }
                options.verbosity = verbosity;
            }
            "quiet" => {
                reject_value(flag, inline_value)?;
                if !debug_flag_seen {
                    options.debug = false;
                }
                options.verbosity = Verbosity::Quiet;
            }
            "debug" => {
                reject_value(flag, inline_value)?;
                debug_flag_seen = true;
                options.debug = true;
                options.verbosity = Verbosity::Debug;
            }
            "follow-symlinks" => {
                reject_value(flag, inline_value)?;
                options.follow_symlinks = true;
            }
            "intl" => {
                reject_value(flag, inline_value)?;
                options.intl = true;
            }
            "opcache" => {
                options.opcache = parse_opcache_mode(&parser.value(flag, inline_value)?)?;
            }
            unsupported => {
                if let Some(feature) = unsupported_native_v1_option(unsupported) {
                    return Err(CliError::new(format!(
                        "--{unsupported} is not supported by wp-playground-native v1 yet ({feature}). Use the Node CLI for this option."
                    )));
                }
                if options.command == CommandName::Php {
                    options.php_args.push(token);
                    php_passthrough = true;
                    continue;
                }
                return Err(CliError::new(unknown_option_message(
                    unsupported,
                    &options.command,
                )));
            }
        }
    }

    if debug_flag_seen {
        options.debug = true;
        options.verbosity = Verbosity::Debug;
    }
    validate_wp_slug_or_url(&options.wp)?;
    apply_default_debug_constants(&mut options)?;
    if options.command == CommandName::Php && options.php_args.is_empty() {
        return Err(CliError::new(
            "The php command requires PHP arguments. Try `wp-playground-native php -- -v` or `wp-playground-native php <script.php>`.",
        ));
    }

    Ok(options)
}

pub fn normalize_for_runtime(
    options: CliOptions,
    cwd: &Path,
    home_dir: &Path,
) -> Result<RuntimeConfig> {
    match options.command.clone() {
        CommandName::Start => normalize_start(options, cwd, home_dir),
        CommandName::Server => normalize_server(options, cwd),
        CommandName::RunBlueprint => normalize_run_blueprint(options, cwd),
        CommandName::BuildSnapshot => normalize_build_snapshot(options, cwd),
        CommandName::Php => Ok(RuntimeConfig {
            command: RuntimeCommand::Php,
            original_command: CommandName::Php,
            options,
            site_storage: None,
            server_url: None,
        }),
    }
}

fn normalize_build_snapshot(options: CliOptions, cwd: &Path) -> Result<RuntimeConfig> {
    normalize_one_shot_wordpress_command(options, cwd, RuntimeCommand::BuildSnapshot)
}

fn normalize_run_blueprint(options: CliOptions, cwd: &Path) -> Result<RuntimeConfig> {
    normalize_one_shot_wordpress_command(options, cwd, RuntimeCommand::RunBlueprint)
}

fn normalize_one_shot_wordpress_command(
    mut options: CliOptions,
    cwd: &Path,
    runtime_command: RuntimeCommand,
) -> Result<RuntimeConfig> {
    if matches!(
        options.auto_mount,
        AutoMountSetting::Enabled | AutoMountSetting::Path(_)
    ) {
        let auto_mount_path = match &options.auto_mount {
            AutoMountSetting::Path(path) => path.clone(),
            _ => cwd.to_path_buf(),
        };
        let expanded = expand_auto_mounts(AutoMountInput {
            path: auto_mount_path,
            mounts: options.mounts,
            mounts_before_install: options.mounts_before_install,
            additional_blueprint_steps: options.additional_blueprint_steps,
            experimental_blueprints_v2_runner: false,
            wordpress_install_mode: options
                .wordpress_install_mode_explicit
                .then(|| options.wordpress_install_mode.clone()),
        })?;
        options.mounts = expanded.mounts;
        options.mounts_before_install = expanded.mounts_before_install;
        options.additional_blueprint_steps = expanded.additional_blueprint_steps;
        options.mode = expanded.mode;
        if let Some(mode) = expanded.wordpress_install_mode {
            options.wordpress_install_mode = mode;
        }
    }

    Ok(RuntimeConfig {
        command: runtime_command,
        original_command: options.command.clone(),
        options,
        site_storage: None,
        server_url: None,
    })
}

fn normalize_start(mut options: CliOptions, cwd: &Path, home_dir: &Path) -> Result<RuntimeConfig> {
    let original_command = options.command.clone();
    options.command = CommandName::Server;

    if options.auto_mount != AutoMountSetting::Disabled {
        let auto_mount_path = match &options.auto_mount {
            AutoMountSetting::Path(path) => path.clone(),
            _ => options.path.clone().unwrap_or_else(|| cwd.to_path_buf()),
        };
        let expanded = expand_auto_mounts(AutoMountInput {
            path: auto_mount_path,
            mounts: options.mounts,
            mounts_before_install: options.mounts_before_install,
            additional_blueprint_steps: options.additional_blueprint_steps,
            experimental_blueprints_v2_runner: false,
            wordpress_install_mode: options
                .wordpress_install_mode_explicit
                .then(|| options.wordpress_install_mode.clone()),
        })?;
        options.mounts = expanded.mounts;
        options.mounts_before_install = expanded.mounts_before_install;
        options.additional_blueprint_steps = expanded.additional_blueprint_steps;
        options.mode = expanded.mode;
        if let Some(mode) = expanded.wordpress_install_mode {
            options.wordpress_install_mode = mode;
        }
    }
    options.auto_mount = AutoMountSetting::Unspecified;

    // The current Node CLI keys managed start sites by process.cwd().
    let site_storage = resolve_site_storage(
        home_dir,
        cwd,
        &options.mounts,
        &options.mounts_before_install,
    );
    match &site_storage {
        SiteStorage::Managed(host_path) => {
            options
                .mounts_before_install
                .push(Mount::new(host_path.clone(), "/wordpress")?);
            if !options.wordpress_install_mode_explicit {
                options.wordpress_install_mode = if options.reset {
                    WordPressInstallMode::DownloadAndInstall
                } else if directory_exists_and_is_not_empty(host_path)? {
                    WordPressInstallMode::InstallFromExistingFilesIfNeeded
                } else {
                    WordPressInstallMode::DownloadAndInstall
                };
            }
        }
        SiteStorage::ExplicitMount(host_path) if options.reset => {
            return Err(CliError::new(format!(
                "This site is not managed by Playground CLI and cannot be reset: {}",
                host_path.display()
            )));
        }
        SiteStorage::ExplicitMount(_) => {}
    }

    let server_url = server_url(&options);
    Ok(RuntimeConfig {
        command: RuntimeCommand::Server,
        original_command,
        options,
        site_storage: Some(site_storage),
        server_url: Some(server_url),
    })
}

fn normalize_server(mut options: CliOptions, cwd: &Path) -> Result<RuntimeConfig> {
    if let AutoMountSetting::Path(path) = &options.auto_mount {
        let expanded = expand_auto_mounts(AutoMountInput {
            path: path.clone(),
            mounts: options.mounts,
            mounts_before_install: options.mounts_before_install,
            additional_blueprint_steps: options.additional_blueprint_steps,
            experimental_blueprints_v2_runner: false,
            wordpress_install_mode: options
                .wordpress_install_mode_explicit
                .then(|| options.wordpress_install_mode.clone()),
        })?;
        options.mounts = expanded.mounts;
        options.mounts_before_install = expanded.mounts_before_install;
        options.additional_blueprint_steps = expanded.additional_blueprint_steps;
        options.mode = expanded.mode;
        if let Some(mode) = expanded.wordpress_install_mode {
            options.wordpress_install_mode = mode;
        }
    } else if matches!(options.auto_mount, AutoMountSetting::Enabled) {
        let expanded = expand_auto_mounts(AutoMountInput {
            path: cwd.to_path_buf(),
            mounts: options.mounts,
            mounts_before_install: options.mounts_before_install,
            additional_blueprint_steps: options.additional_blueprint_steps,
            experimental_blueprints_v2_runner: false,
            wordpress_install_mode: options
                .wordpress_install_mode_explicit
                .then(|| options.wordpress_install_mode.clone()),
        })?;
        options.mounts = expanded.mounts;
        options.mounts_before_install = expanded.mounts_before_install;
        options.additional_blueprint_steps = expanded.additional_blueprint_steps;
        options.mode = expanded.mode;
        if let Some(mode) = expanded.wordpress_install_mode {
            options.wordpress_install_mode = mode;
        }
    }

    let server_url = server_url(&options);
    Ok(RuntimeConfig {
        command: RuntimeCommand::Server,
        original_command: CommandName::Server,
        options,
        site_storage: None,
        server_url: Some(server_url),
    })
}

fn default_options(command: CommandName, cwd: &Path) -> CliOptions {
    let is_start = matches!(command, CommandName::Start);
    let is_build_snapshot = matches!(command, CommandName::BuildSnapshot);
    let auto_mount = if is_start {
        AutoMountSetting::Enabled
    } else {
        AutoMountSetting::Unspecified
    };
    let login = is_start;
    let path = if is_start {
        Some(cwd.to_path_buf())
    } else {
        None
    };

    CliOptions {
        command,
        php: DEFAULT_PHP_VERSION.to_string(),
        wp: DEFAULT_WP_VERSION.to_string(),
        port: None,
        site_url: None,
        path,
        mounts: Vec::new(),
        mounts_before_install: Vec::new(),
        auto_mount,
        reset: false,
        login,
        skip_browser: false,
        blueprint: None,
        blueprint_may_read_adjacent_files: false,
        wordpress_install_mode: WordPressInstallMode::DownloadAndInstall,
        wordpress_install_mode_explicit: false,
        skip_sqlite_setup: false,
        workers: None,
        verbosity: Verbosity::Normal,
        debug: false,
        follow_symlinks: false,
        intl: true,
        opcache: OpcacheMode::Middle,
        defined_constants: Vec::new(),
        mode: None,
        outfile: is_build_snapshot.then(|| cwd.join("wordpress.zip")),
        additional_blueprint_steps: Vec::new(),
        script: None,
        php_args: Vec::new(),
    }
}

fn parse_auto_mount(
    parser: &mut Parser,
    inline_value: Option<&str>,
    cwd: &Path,
) -> Result<AutoMountSetting> {
    if let Some(value) = inline_value {
        return Ok(match value {
            "true" => AutoMountSetting::Enabled,
            "false" => AutoMountSetting::Disabled,
            "" => AutoMountSetting::Path(cwd.to_path_buf()),
            _ => AutoMountSetting::Path(resolve_path(cwd, value)),
        });
    }
    if parser.peek_is_value() {
        Ok(AutoMountSetting::Path(resolve_path(
            cwd,
            &parser.required_value("auto-mount")?,
        )))
    } else {
        Ok(AutoMountSetting::Enabled)
    }
}

fn server_url(options: &CliOptions) -> String {
    options
        .site_url
        .clone()
        .unwrap_or_else(|| format!("http://127.0.0.1:{}", options.port.unwrap_or(DEFAULT_PORT)))
}

fn directory_exists_and_is_not_empty(path: &Path) -> Result<bool> {
    if !path.exists() {
        return Ok(false);
    }
    Ok(fs::read_dir(path)?.next().transpose()?.is_some())
}

fn split_long_option(token: &str) -> Result<(&str, Option<&str>)> {
    let without_prefix = token
        .strip_prefix("--")
        .ok_or_else(|| CliError::new(format!("Expected long option, got {token}")))?;
    if without_prefix.is_empty() {
        return Err(CliError::new(
            "Expected an option name after `--`. Use `--` only after `wp-playground-native php` to pass the remaining flags through to PHP.",
        ));
    }
    if let Some((flag, value)) = without_prefix.split_once('=') {
        Ok((flag, Some(value)))
    } else {
        Ok((without_prefix, None))
    }
}

fn ensure_option_allowed_for_command(flag: &str, command: &CommandName) -> Result<()> {
    let Some(allowed_commands) = supported_option_command_scope(flag) else {
        return Ok(());
    };
    let command_name = command.as_str();
    if allowed_commands.contains(&command_name) {
        return Ok(());
    }

    Err(CliError::new(format!(
        "--{flag} is only supported by {}; you are using the {command_name} command. Run `wp-playground-native {} --help` for the supported options.",
        format_command_list(allowed_commands),
        allowed_commands[0]
    )))
}

fn supported_option_command_scope(flag: &str) -> Option<&'static [&'static str]> {
    match flag {
        "path" => Some(&["start"]),
        "wp"
        | "php"
        | "port"
        | "site-url"
        | "mount"
        | "mount-before-install"
        | "mount-dir"
        | "mount-dir-before-install"
        | "blueprint"
        | "blueprint-may-read-adjacent-files"
        | "wordpress-install-mode"
        | "skip-wordpress-install"
        | "skip-sqlite-setup"
        | "debug"
        | "follow-symlinks"
        | "intl"
        | "opcache"
        | "define"
        | "define-bool"
        | "define-number" => Some(&["start", "server", "run-blueprint", "build-snapshot", "php"]),
        "auto-mount" | "no-auto-mount" => {
            Some(&["start", "server", "run-blueprint", "build-snapshot"])
        }
        "reset" | "skip-browser" => Some(&["start"]),
        "login" | "no-login" => Some(&["start", "server"]),
        "workers" => Some(&["start", "server"]),
        "verbosity" | "quiet" => Some(&["start", "server", "run-blueprint", "build-snapshot"]),
        "outfile" => Some(&["build-snapshot"]),
        _ => None,
    }
}

fn format_command_list(commands: &[&str]) -> String {
    match commands {
        [] => "no commands".to_string(),
        [command] => format!("the {command} command"),
        [first, second] => format!("the {first} and {second} commands"),
        _ => {
            let mut formatted = String::from("the ");
            for (index, command) in commands.iter().enumerate() {
                if index > 0 {
                    if index == commands.len() - 1 {
                        formatted.push_str(", and ");
                    } else {
                        formatted.push_str(", ");
                    }
                }
                formatted.push_str(command);
            }
            formatted.push_str(" commands");
            formatted
        }
    }
}

fn unknown_command_error(command: &str) -> CliError {
    let suggestion =
        command_alias_suggestion(command).or_else(|| suggest_name(command, COMMAND_NAMES));
    let mut message = format!(
        "Unknown command `{command}`. Expected one of: {}.",
        COMMAND_NAMES.join(", ")
    );
    if let Some(suggestion) = suggestion {
        message.push_str(&format!(" Did you mean `{suggestion}`?"));
    }
    message.push_str(" Run `wp-playground-native --help` for examples.");
    CliError::new(message)
}

fn command_alias_suggestion(command: &str) -> Option<&'static str> {
    match command {
        "serve" => Some("server"),
        "blueprint" | "run-blueprints" => Some("run-blueprint"),
        "snapshot" | "snap" | "build" => Some("build-snapshot"),
        "php-cli" => Some("php"),
        _ => None,
    }
}

fn unknown_short_option_error(token: &str, command: &CommandName) -> CliError {
    CliError::new(format!(
        "Unknown short option `{token}` for the {} command. wp-playground-native uses long options such as `--port`; run `wp-playground-native {} --help` for supported options.",
        command.as_str(),
        command.as_str()
    ))
}

fn unknown_option_message(flag: &str, command: &CommandName) -> String {
    let mut message = format!(
        "Unknown option `--{flag}` for the {} command.",
        command.as_str()
    );
    if let Some(suggestion) = option_alias_suggestion(flag).or_else(|| suggest_option_name(flag)) {
        message.push_str(&format!(" Did you mean `--{suggestion}`?"));
    }
    message.push_str(&format!(
        " Run `wp-playground-native {} --help` for supported options.",
        command.as_str()
    ));
    message
}

fn option_alias_suggestion(flag: &str) -> Option<&'static str> {
    match flag {
        "wordpress" | "wordpress-version" | "wp-version" => Some("wp"),
        "php-version" => Some("php"),
        "worker" => Some("workers"),
        "verbose" => Some("verbosity"),
        "out" | "output" => Some("outfile"),
        "mount-before" => Some("mount-before-install"),
        "mount-dir-before" => Some("mount-dir-before-install"),
        "skip-wordpress" => Some("skip-wordpress-install"),
        "skip-sqlite" => Some("skip-sqlite-setup"),
        _ => None,
    }
}

fn suggest_option_name(flag: &str) -> Option<&'static str> {
    suggest_name(flag, SUPPORTED_OPTION_NAMES)
        .or_else(|| suggest_name(flag, UNSUPPORTED_NATIVE_V1_OPTION_NAMES))
}

fn suggest_name<'a>(input: &str, candidates: &'a [&str]) -> Option<&'a str> {
    if input.is_empty() {
        return None;
    }

    let normalized = input.to_ascii_lowercase();
    let mut best = None;
    let mut best_distance = usize::MAX;
    for candidate in candidates {
        if *candidate == normalized {
            continue;
        }
        if candidate.starts_with(&normalized) || normalized.starts_with(*candidate) {
            return Some(candidate);
        }
        let distance = edit_distance(&normalized, candidate);
        if distance < best_distance {
            best = Some(*candidate);
            best_distance = distance;
        }
    }

    let threshold = (normalized.chars().count() / 3).max(2);
    if best_distance <= threshold {
        best
    } else {
        None
    }
}

fn edit_distance(left: &str, right: &str) -> usize {
    let right_chars = right.chars().collect::<Vec<_>>();
    let mut previous = (0..=right_chars.len()).collect::<Vec<_>>();
    let mut current = vec![0; right_chars.len() + 1];

    for (left_index, left_char) in left.chars().enumerate() {
        current[0] = left_index + 1;
        for (right_index, right_char) in right_chars.iter().enumerate() {
            let insertion = current[right_index] + 1;
            let deletion = previous[right_index + 1] + 1;
            let substitution = previous[right_index] + usize::from(left_char != *right_char);
            current[right_index + 1] = insertion.min(deletion).min(substitution);
        }
        std::mem::swap(&mut previous, &mut current);
    }

    previous[right_chars.len()]
}

fn value_hint(flag: &str) -> String {
    format!("Use `--{flag}=<value>` or `--{flag} <value>`.")
}

impl CommandName {
    fn as_str(&self) -> &'static str {
        match self {
            CommandName::Start => "start",
            CommandName::Server => "server",
            CommandName::RunBlueprint => "run-blueprint",
            CommandName::BuildSnapshot => "build-snapshot",
            CommandName::Php => "php",
        }
    }
}

fn reject_value(flag: &str, value: Option<&str>) -> Result<()> {
    if value.is_some() {
        return Err(CliError::new(format!("--{flag} does not accept a value")));
    }
    Ok(())
}

fn unsupported_native_v1_option(flag: &str) -> Option<&'static str> {
    match flag {
        "phpmyadmin" => Some("phpMyAdmin installation"),
        "xdebug" => Some("Xdebug bridge"),
        "experimental-unsafe-ide-integration" => Some("unsafe IDE integration"),
        "experimental-devtools" => Some("browser devtools bridge"),
        "experimental-blueprints-v2-runner" => Some("Blueprints v2 runner"),
        "experimental-multi-worker" => Some("deprecated Node worker option"),
        "experimental-trace" => Some("Node CLI trace output"),
        "internal-cookie-store" => Some("Node cookie-store mediation"),
        "php-extension" => Some("custom PHP extension loading"),
        "no-intl" => Some("disabling bundled Intl"),
        "mode" => Some("Blueprints v2 mode selection"),
        "redis" => Some("Redis integration"),
        "memcached" => Some("Memcached integration"),
        _ => None,
    }
}

fn parse_port(value: &str) -> Result<u16> {
    value
        .parse::<u16>()
        .map_err(|_| CliError::new(format!("Invalid --port value \"{value}\"")))
}

fn parse_workers(value: &str) -> Result<WorkerCount> {
    if value == "auto" {
        return Ok(WorkerCount::Auto);
    }
    let workers = value
        .parse::<usize>()
        .map_err(|_| CliError::new(format!("Invalid --workers value \"{value}\"")))?;
    if workers == 0 {
        return Err(CliError::new(
            "Invalid --workers value \"0\": expected a positive integer or \"auto\".",
        ));
    }
    Ok(WorkerCount::Fixed(workers))
}

fn parse_opcache_mode(value: &str) -> Result<OpcacheMode> {
    match value {
        "validate" => Ok(OpcacheMode::Validate),
        "revalidate" => Ok(OpcacheMode::Revalidate),
        "immutable" => Ok(OpcacheMode::Immutable),
        "middle" => Ok(OpcacheMode::Middle),
        "low-memory" => Ok(OpcacheMode::LowMemory),
        "off" => Ok(OpcacheMode::Off),
        _ => Err(CliError::new(format!(
            "Invalid --opcache value \"{value}\": expected validate, revalidate, immutable, middle, low-memory, or off."
        ))),
    }
}

fn parse_verbosity(value: &str) -> Result<Verbosity> {
    match value {
        "quiet" => Ok(Verbosity::Quiet),
        "normal" => Ok(Verbosity::Normal),
        "debug" => Ok(Verbosity::Debug),
        _ => Err(CliError::new(format!(
            "Invalid --verbosity value \"{value}\": expected quiet, normal, or debug."
        ))),
    }
}

fn add_defined_constant(
    options: &mut CliOptions,
    kind: DefinedConstantKind,
    name: String,
    value: PhpConstantValue,
    is_default: bool,
) -> Result<()> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err(CliError::new("Constant name cannot be empty"));
    }

    if let Some(existing) = options
        .defined_constants
        .iter_mut()
        .find(|constant| constant.name == name)
    {
        if existing.kind != kind {
            return Err(CliError::new(format!(
                "Constant \"{name}\" is defined multiple times across different --define flags"
            )));
        }
        existing.value = value;
        existing.is_default = is_default;
        return Ok(());
    }

    options.defined_constants.push(DefinedConstant {
        name,
        value,
        kind,
        is_default,
    });
    Ok(())
}

fn parse_define_bool(value: &str, name: &str) -> Result<bool> {
    match value.trim().to_ascii_lowercase().as_str() {
        "true" | "1" => Ok(true),
        "false" | "0" => Ok(false),
        normalized => Err(CliError::new(format!(
            "Invalid boolean value for constant \"{name}\": \"{normalized}\". Must be \"true\", \"false\", \"1\", or \"0\"."
        ))),
    }
}

fn parse_define_number(value: &str, name: &str) -> Result<String> {
    let value = value.trim();
    let number = value.parse::<f64>().map_err(|_| {
        CliError::new(format!(
            "Invalid number value for constant \"{name}\": \"{value}\". Must be a valid finite number."
        ))
    })?;
    if !number.is_finite() {
        return Err(CliError::new(format!(
            "Invalid number value for constant \"{name}\": \"{value}\". Must be a valid finite number."
        )));
    }
    Ok(value.to_string())
}

fn apply_default_debug_constants(options: &mut CliOptions) -> Result<()> {
    for (name, value) in [
        ("WP_DEBUG", true),
        ("WP_DEBUG_LOG", true),
        ("WP_DEBUG_DISPLAY", false),
    ] {
        if !options
            .defined_constants
            .iter()
            .any(|constant| constant.name == name)
        {
            add_defined_constant(
                options,
                DefinedConstantKind::Bool,
                name.to_string(),
                PhpConstantValue::bool(value),
                true,
            )?;
        }
    }
    Ok(())
}

fn validate_php_version(value: &str) -> Result<()> {
    if SUPPORTED_PHP_VERSIONS.contains(&value) {
        Ok(())
    } else {
        Err(CliError::new(format!(
            "Unsupported PHP version \"{value}\". Supported versions: {}",
            SUPPORTED_PHP_VERSIONS.join(", ")
        )))
    }
}

fn validate_site_url(value: &str) -> Result<()> {
    if value.starts_with("http://") || value.starts_with("https://") {
        Ok(())
    } else {
        Err(CliError::new(format!(
            "Invalid site-url \"{value}\". Please provide a valid http(s) URL."
        )))
    }
}

fn validate_wp_slug_or_url(value: &str) -> Result<()> {
    if value.starts_with("http://") || value.starts_with("https://") {
        return Ok(());
    }
    if matches!(value, "latest" | "beta" | "trunk" | "nightly") {
        return Ok(());
    }
    let valid = value
        .chars()
        .all(|char| char.is_ascii_alphanumeric() || matches!(char, '.' | '-' | '_'));
    if valid && value.chars().any(|char| char.is_ascii_digit()) {
        return Ok(());
    }
    Err(CliError::new(
		"Unrecognized WordPress version. Use latest, beta, trunk, nightly, a URL, or a numeric version such as 6.7.",
	))
}

fn resolve_blueprint_source(cwd: &Path, value: &str) -> String {
    if value.starts_with("http://") || value.starts_with("https://") {
        value.to_string()
    } else {
        resolve_path(cwd, value).to_string_lossy().to_string()
    }
}

fn resolve_path(cwd: &Path, value: &str) -> PathBuf {
    let path = PathBuf::from(value);
    if path.is_absolute() {
        path
    } else {
        cwd.join(path)
    }
}

struct Parser {
    tokens: Vec<String>,
    index: usize,
}

impl Parser {
    fn new(tokens: Vec<String>) -> Self {
        Self { tokens, index: 0 }
    }

    fn next(&mut self) -> Option<String> {
        if self.index >= self.tokens.len() {
            return None;
        }
        let value = self.tokens[self.index].clone();
        self.index += 1;
        Some(value)
    }

    fn value(&mut self, flag: &str, inline_value: Option<&str>) -> Result<String> {
        if let Some(value) = inline_value {
            return Ok(value.to_string());
        }
        self.required_value(flag)
    }

    fn required_value(&mut self, flag: &str) -> Result<String> {
        let value = self.next().ok_or_else(|| {
            CliError::new(format!("--{flag} expects a value. {}", value_hint(flag)))
        })?;
        if value.starts_with("--") {
            return Err(CliError::new(format!(
                "--{flag} expects a value, but got option `{value}`. {}",
                value_hint(flag)
            )));
        }
        Ok(value)
    }

    fn peek_is_value(&self) -> bool {
        self.tokens
            .get(self.index)
            .is_some_and(|value| !value.starts_with("--"))
    }
}

#[cfg(test)]
mod tests {
    use std::{
        env, fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    use crate::{
        args::{
            normalize_for_runtime, parse_cli_args_from, resolve_path, AutoMountSetting,
            CommandName, DefinedConstantKind, RuntimeCommand, Verbosity, WorkerCount,
        },
        host::{OpcacheMode, PhpConstantValue},
        paths::persistent_site_path,
        paths::{SiteStorage, WordPressInstallMode},
    };

    fn temp_dir(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = env::temp_dir().join(format!("wp-playground-native-{name}-{unique}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn args(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    fn matrix() -> serde_json::Value {
        serde_json::from_str(include_str!("../compatibility.json")).unwrap()
    }

    #[test]
    fn compatibility_matrix_is_valid() {
        let matrix = matrix();

        assert_eq!(matrix["schemaVersion"], 1);
        let commands = matrix["commands"].as_array().unwrap();
        for command in ["start", "server", "php", "run-blueprint", "build-snapshot"] {
            assert!(
                commands
                    .iter()
                    .any(|entry| entry["name"].as_str() == Some(command)),
                "missing command {command}"
            );
        }

        let options = matrix["options"].as_array().unwrap();
        for option in [
            "--path",
            "--wp",
            "--php",
            "--port",
            "--site-url",
            "--mount",
            "--mount-before-install",
            "--mount-dir",
            "--mount-dir-before-install",
            "--auto-mount",
            "--no-auto-mount",
            "--reset",
            "--login",
            "--no-login",
            "--skip-browser",
            "--blueprint",
            "--blueprint-may-read-adjacent-files",
            "--wordpress-install-mode",
            "--skip-wordpress-install",
            "--skip-sqlite-setup",
            "--workers",
            "--verbosity",
            "--quiet",
            "--debug",
            "--follow-symlinks",
            "--intl",
            "--define",
            "--define-bool",
            "--define-number",
            "--phpmyadmin",
            "--xdebug",
            "--experimental-unsafe-ide-integration",
            "--experimental-devtools",
            "--experimental-blueprints-v2-runner",
            "--experimental-multi-worker",
            "--experimental-trace",
            "--internal-cookie-store",
            "--php-extension",
            "--no-intl",
            "--mode",
            "--outfile",
            "--redis",
            "--memcached",
        ] {
            assert!(
                options
                    .iter()
                    .any(|entry| entry["name"].as_str() == Some(option)),
                "missing option {option}"
            );
        }

        for entry in commands.iter().chain(options.iter()) {
            let status = entry["status"].as_str().unwrap();
            assert!(
                matches!(status, "supported" | "unsupported" | "pending"),
                "invalid compatibility status {status}"
            );
        }
    }

    #[test]
    fn compatibility_matrix_supported_and_unsupported_options_match_parser() {
        let cwd = temp_dir("compat-matrix-contract");
        fs::create_dir_all(cwd.join("mount-dir-host")).unwrap();
        let process_mount_dir = format!(
            "wp-playground-native-compat-mount-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        );
        fs::create_dir_all(&process_mount_dir).unwrap();
        let matrix = matrix();
        let options = matrix["options"].as_array().unwrap();

        for entry in options {
            let name = entry["name"].as_str().unwrap();
            let status = entry["status"].as_str().unwrap();
            let commands = entry["commands"].as_array().unwrap();
            for command in commands.iter().map(|command| command.as_str().unwrap()) {
                match status {
                    "supported" => {
                        let argv = compatibility_supported_argv(command, name, &process_mount_dir);
                        parse_cli_args_from(argv.clone(), &cwd).unwrap_or_else(|error| {
                            panic!("{command} {name} should parse from {argv:?}: {error}");
                        });
                    }
                    "unsupported" => {
                        let argv = compatibility_unsupported_argv(command, name);
                        let error = parse_cli_args_from(argv.clone(), &cwd).unwrap_err();
                        let expected = entry["errorContains"].as_str().unwrap();
                        assert!(
                            error.message().contains(expected),
                            "{command} {name} from {argv:?} should contain {expected:?}, got {}",
                            error.message()
                        );
                    }
                    "pending" => {}
                    other => panic!("unexpected compatibility status {other}"),
                }
            }
        }

        let _ = fs::remove_dir_all(&cwd);
        let _ = fs::remove_dir_all(&process_mount_dir);
    }

    fn compatibility_supported_argv(
        command: &str,
        option: &str,
        process_mount_dir: &str,
    ) -> Vec<String> {
        let mut argv = vec![command.to_string()];
        match option {
            "--path" => argv.push("--path=.".to_string()),
            "--wp" => argv.push("--wp=6.9".to_string()),
            "--php" => argv.push("--php=8.3".to_string()),
            "--port" => argv.push("--port=9400".to_string()),
            "--site-url" => argv.push("--site-url=http://127.0.0.1:9400".to_string()),
            "--mount" => {
                argv.push("--mount".to_string());
                argv.push(format!("{process_mount_dir}:/tmp"));
            }
            "--mount-before-install" => {
                argv.push("--mount-before-install".to_string());
                argv.push(format!("{process_mount_dir}:/tmp"));
            }
            "--mount-dir" => {
                argv.extend([
                    "--mount-dir".to_string(),
                    "mount-dir-host".to_string(),
                    "/tmp".to_string(),
                ]);
            }
            "--mount-dir-before-install" => {
                argv.extend([
                    "--mount-dir-before-install".to_string(),
                    "mount-dir-host".to_string(),
                    "/tmp".to_string(),
                ]);
            }
            "--auto-mount" => argv.push("--auto-mount".to_string()),
            "--no-auto-mount" => argv.push("--no-auto-mount".to_string()),
            "--reset" => argv.push("--reset".to_string()),
            "--login" => argv.push("--login".to_string()),
            "--no-login" => argv.push("--no-login".to_string()),
            "--skip-browser" => argv.push("--skip-browser".to_string()),
            "--blueprint" => argv.push("--blueprint=blueprint.json".to_string()),
            "--blueprint-may-read-adjacent-files" => {
                argv.push("--blueprint-may-read-adjacent-files".to_string());
            }
            "--wordpress-install-mode" => {
                argv.push("--wordpress-install-mode=download-and-install".to_string());
            }
            "--skip-wordpress-install" => argv.push("--skip-wordpress-install".to_string()),
            "--skip-sqlite-setup" => argv.push("--skip-sqlite-setup".to_string()),
            "--workers" => argv.push("--workers=1".to_string()),
            "--verbosity" => argv.push("--verbosity=debug".to_string()),
            "--quiet" => argv.push("--quiet".to_string()),
            "--debug" => argv.push("--debug".to_string()),
            "--follow-symlinks" => argv.push("--follow-symlinks".to_string()),
            "--intl" => argv.push("--intl".to_string()),
            "--opcache" => argv.push("--opcache=immutable".to_string()),
            "--define" => argv.extend([
                "--define".to_string(),
                "MATRIX_STRING".to_string(),
                "value".to_string(),
            ]),
            "--define-bool" => argv.extend([
                "--define-bool".to_string(),
                "MATRIX_BOOL".to_string(),
                "true".to_string(),
            ]),
            "--define-number" => argv.extend([
                "--define-number".to_string(),
                "MATRIX_NUMBER".to_string(),
                "42".to_string(),
            ]),
            "--outfile" => argv.push("--outfile=snapshot.zip".to_string()),
            other => panic!("missing supported compatibility argv for {other}"),
        }
        if command == "php" {
            argv.push("script.php".to_string());
        }
        argv
    }

    fn compatibility_unsupported_argv(command: &str, option: &str) -> Vec<String> {
        let option = match option {
            "--experimental-unsafe-ide-integration" => {
                "--experimental-unsafe-ide-integration=vscode"
            }
            "--experimental-multi-worker" => "--experimental-multi-worker=2",
            "--php-extension" => "--php-extension=ext.json",
            "--mode" => "--mode=apply-to-existing-site",
            other => other,
        };
        vec![command.to_string(), option.to_string()]
    }

    #[test]
    fn parses_server_options() {
        let cwd = temp_dir("server-options");
        let plugin = cwd.join("plugin");
        fs::create_dir_all(&plugin).unwrap();

        let options = parse_cli_args_from(
            vec![
                "server".to_string(),
                "--php=8.4".to_string(),
                "--wp".to_string(),
                "6.9".to_string(),
                "--port".to_string(),
                "9999".to_string(),
                "--site-url=http://127.0.0.1:9999".to_string(),
                "--mount-dir".to_string(),
                "plugin".to_string(),
                "/wordpress/wp-content/plugins/plugin".to_string(),
                "--workers=auto".to_string(),
                "--verbosity=debug".to_string(),
                "--follow-symlinks".to_string(),
            ],
            &cwd,
        )
        .unwrap();

        assert_eq!(options.command, CommandName::Server);
        assert_eq!(options.php, "8.4");
        assert_eq!(options.wp, "6.9");
        assert_eq!(options.port, Some(9999));
        assert_eq!(options.mounts[0].host_path, plugin);
        assert_eq!(options.workers, Some(WorkerCount::Auto));
        assert_eq!(options.verbosity, Verbosity::Debug);
        assert_eq!(options.opcache, OpcacheMode::Middle);
        assert!(options.debug);
        assert!(options.follow_symlinks);
    }

    #[test]
    fn parses_opcache_modes() {
        let cwd = temp_dir("opcache-modes");

        let validate = parse_cli_args_from(args(&["server", "--opcache=validate"]), &cwd).unwrap();
        let revalidate =
            parse_cli_args_from(args(&["server", "--opcache=revalidate"]), &cwd).unwrap();
        let immutable =
            parse_cli_args_from(args(&["server", "--opcache=immutable"]), &cwd).unwrap();
        let middle = parse_cli_args_from(args(&["server", "--opcache=middle"]), &cwd).unwrap();
        let low_memory =
            parse_cli_args_from(args(&["server", "--opcache=low-memory"]), &cwd).unwrap();
        let off = parse_cli_args_from(args(&["server", "--opcache=off"]), &cwd).unwrap();
        let invalid = parse_cli_args_from(args(&["server", "--opcache=fast"]), &cwd).unwrap_err();

        assert_eq!(validate.opcache, OpcacheMode::Validate);
        assert_eq!(revalidate.opcache, OpcacheMode::Revalidate);
        assert_eq!(immutable.opcache, OpcacheMode::Immutable);
        assert_eq!(middle.opcache, OpcacheMode::Middle);
        assert_eq!(low_memory.opcache, OpcacheMode::LowMemory);
        assert_eq!(off.opcache, OpcacheMode::Off);
        assert!(invalid.message().contains("Invalid --opcache value"));
    }

    #[test]
    fn compatibility_supported_start_server_and_php_invocations_parse() {
        let cwd = temp_dir("compat-supported");
        let mount = cwd.join("mount");
        let before = cwd.join("before");
        fs::create_dir_all(&mount).unwrap();
        fs::create_dir_all(&before).unwrap();

        let start = parse_cli_args_from(
            args(&[
                "start",
                "--path=.",
                "--wp=6.9",
                "--php=8.3",
                "--port=9444",
                "--site-url=http://127.0.0.1:9444",
                "--mount-dir",
                "mount",
                "/wordpress/wp-content/plugins/mount",
                "--mount-dir-before-install",
                "before",
                "/wordpress",
                "--auto-mount",
                ".",
                "--reset",
                "--login",
                "--skip-browser",
                "--blueprint=blueprint.json",
                "--blueprint-may-read-adjacent-files",
                "--wordpress-install-mode=download-and-install",
                "--workers=1",
                "--verbosity=debug",
                "--debug",
                "--follow-symlinks",
                "--intl",
                "--opcache=immutable",
                "--define",
                "MY_STRING",
                "value",
                "--define-bool",
                "MY_BOOL",
                "true",
                "--define-number",
                "MY_NUMBER",
                "42",
            ]),
            &cwd,
        )
        .unwrap();
        assert_eq!(start.command, CommandName::Start);
        assert_eq!(start.port, Some(9444));
        assert!(start.login);
        assert!(start.skip_browser);
        assert!(start.intl);
        assert_eq!(start.opcache, OpcacheMode::Immutable);
        assert_eq!(start.mounts.len(), 1);
        assert_eq!(start.mounts_before_install.len(), 1);

        let server = parse_cli_args_from(
            args(&[
                "server",
                "--wp=6.9",
                "--php=8.4",
                "--port=9555",
                "--site-url=http://127.0.0.1:9555",
                "--mount",
                ".:/tmp",
                "--mount-before-install",
                ".:/wordpress",
                "--no-auto-mount",
                "--no-login",
                "--skip-wordpress-install",
                "--skip-sqlite-setup",
                "--workers=auto",
                "--opcache=revalidate",
                "--quiet",
            ]),
            &cwd,
        )
        .unwrap();
        assert_eq!(server.command, CommandName::Server);
        assert_eq!(server.workers, Some(WorkerCount::Auto));
        assert_eq!(server.opcache, OpcacheMode::Revalidate);
        assert_eq!(server.verbosity, Verbosity::Quiet);
        assert!(!server.login);

        let php = parse_cli_args_from(
            args(&[
                "php",
                "--php=8.3",
                "--wp=6.9",
                "--site-url=http://127.0.0.1:9400",
                "--mount-dir-before-install",
                "before",
                "/tools",
                "--skip-wordpress-install",
                "--skip-sqlite-setup",
                "--define",
                "CLI_CONST",
                "ok",
                "script.php",
                "--script-arg",
            ]),
            &cwd,
        )
        .unwrap();
        assert_eq!(php.command, CommandName::Php);
        assert_eq!(php.script, Some(cwd.join("script.php")));
        assert_eq!(php.php_args, vec!["script.php", "--script-arg"]);

        let run_blueprint = parse_cli_args_from(
            args(&[
                "run-blueprint",
                "--wp=6.9",
                "--php=8.3",
                "--site-url=http://127.0.0.1:9400",
                "--mount-dir-before-install",
                "before",
                "/wordpress",
                "--blueprint=blueprint.json",
                "--blueprint-may-read-adjacent-files",
                "--verbosity=debug",
                "--debug",
                "--follow-symlinks",
                "--define-bool",
                "RUN_BLUEPRINT_CONST",
                "true",
            ]),
            &cwd,
        )
        .unwrap();
        assert_eq!(run_blueprint.command, CommandName::RunBlueprint);
        assert_eq!(
            run_blueprint.blueprint,
            Some(cwd.join("blueprint.json").to_string_lossy().to_string())
        );
        assert_eq!(run_blueprint.verbosity, Verbosity::Debug);
        assert_eq!(run_blueprint.mounts_before_install.len(), 1);

        let build_snapshot = parse_cli_args_from(
            args(&[
                "build-snapshot",
                "--wp=6.9",
                "--php=8.3",
                "--site-url=http://127.0.0.1:9400",
                "--mount-dir-before-install",
                "before",
                "/wordpress",
                "--blueprint=blueprint.json",
                "--blueprint-may-read-adjacent-files",
                "--outfile=snapshot.zip",
                "--quiet",
            ]),
            &cwd,
        )
        .unwrap();
        assert_eq!(build_snapshot.command, CommandName::BuildSnapshot);
        assert_eq!(
            build_snapshot.blueprint,
            Some(cwd.join("blueprint.json").to_string_lossy().to_string())
        );
        assert_eq!(build_snapshot.outfile, Some(cwd.join("snapshot.zip")));
        assert_eq!(build_snapshot.mounts_before_install.len(), 1);

        let _ = fs::remove_dir_all(cwd);
    }

    #[test]
    fn debug_verbosity_enables_debug_runtime_paths_and_legacy_debug_wins_over_quiet() {
        let cwd = temp_dir("debug-verbosity");

        let verbosity_debug =
            parse_cli_args_from(args(&["server", "--verbosity=debug"]), &cwd).unwrap();
        assert_eq!(verbosity_debug.verbosity, Verbosity::Debug);
        assert!(verbosity_debug.debug);

        let debug_quiet =
            parse_cli_args_from(args(&["server", "--debug", "--quiet"]), &cwd).unwrap();
        assert_eq!(debug_quiet.verbosity, Verbosity::Debug);
        assert!(debug_quiet.debug);

        let quiet_debug =
            parse_cli_args_from(args(&["server", "--quiet", "--debug"]), &cwd).unwrap();
        assert_eq!(quiet_debug.verbosity, Verbosity::Debug);
        assert!(quiet_debug.debug);

        let quiet = parse_cli_args_from(args(&["server", "--quiet"]), &cwd).unwrap();
        assert_eq!(quiet.verbosity, Verbosity::Quiet);
        assert!(!quiet.debug);

        let _ = fs::remove_dir_all(cwd);
    }

    #[test]
    fn rejects_supported_options_outside_native_command_scope() {
        let cwd = temp_dir("option-scope");
        for (tokens, expected) in [
            (&["server", "--path=."][..], "the start command"),
            (&["server", "--skip-browser"], "the start command"),
            (&["php", "--auto-mount=."], "run-blueprint"),
            (&["run-blueprint", "--workers=1"], "start and server"),
            (&["build-snapshot", "--login"], "start and server"),
            (&["server", "--outfile=snapshot.zip"], "build-snapshot"),
        ] {
            let error = parse_cli_args_from(args(tokens), &cwd).unwrap_err();
            assert!(
                error.message().contains(expected),
                "{tokens:?}: {}",
                error.message()
            );
        }

        let _ = fs::remove_dir_all(cwd);
    }

    #[test]
    fn unknown_commands_have_stable_errors() {
        let cwd = temp_dir("compat-unsupported-commands");
        let error = parse_cli_args_from(args(&["snapshot"]), &cwd).unwrap_err();
        assert!(
            error.message().contains("Unknown command"),
            "snapshot: {}",
            error.message()
        );
        assert!(
            error.message().contains("Did you mean `build-snapshot`?"),
            "{}",
            error.message()
        );

        let error = parse_cli_args_from(args(&["serve"]), &cwd).unwrap_err();
        assert!(
            error.message().contains("Did you mean `server`?"),
            "{}",
            error.message()
        );

        let _ = fs::remove_dir_all(cwd);
    }

    #[test]
    fn command_line_typos_have_actionable_errors() {
        let cwd = temp_dir("cli-typos");

        let error = parse_cli_args_from(args(&["server", "--pot=9400"]), &cwd).unwrap_err();
        assert!(error.message().contains("Unknown option `--pot`"));
        assert!(error.message().contains("Did you mean `--port`?"));
        assert!(error
            .message()
            .contains("wp-playground-native server --help"));

        let error = parse_cli_args_from(args(&["server", "--wp-version=6.9"]), &cwd).unwrap_err();
        assert!(error.message().contains("Did you mean `--wp`?"));

        let error = parse_cli_args_from(args(&["server", "-p", "9400"]), &cwd).unwrap_err();
        assert!(error.message().contains("Unknown short option `-p`"));
        assert!(error.message().contains("long options"));

        let error = parse_cli_args_from(args(&["server", "--php", "--wp=6.9"]), &cwd).unwrap_err();
        assert!(error.message().contains("--php expects a value"));
        assert!(error.message().contains("got option `--wp=6.9`"));

        let _ = fs::remove_dir_all(cwd);
    }

    #[test]
    fn php_command_supports_option_terminator_for_passthrough() {
        let cwd = temp_dir("php-option-terminator");
        let options =
            parse_cli_args_from(args(&["php", "--php=8.5", "--", "--help"]), &cwd).unwrap();

        assert_eq!(options.command, CommandName::Php);
        assert_eq!(options.php, "8.5");
        assert_eq!(options.php_args, vec!["--help".to_string()]);

        let error = parse_cli_args_from(args(&["server", "--"]), &cwd).unwrap_err();
        assert!(error.message().contains("Unexpected `--`"));

        let _ = fs::remove_dir_all(cwd);
    }

    #[test]
    fn parses_run_blueprint_positional_source_and_normalizes_runtime() {
        let cwd = temp_dir("run-blueprint");
        fs::create_dir_all(cwd.join("plugin")).unwrap();
        fs::write(
            cwd.join("plugin/demo.php"),
            "<?php\n/*\nPlugin Name: Native Demo\n*/\n",
        )
        .unwrap();
        let options = parse_cli_args_from(
            args(&[
                "run-blueprint",
                "blueprint.json",
                "--auto-mount",
                "plugin",
                "--quiet",
            ]),
            &cwd,
        )
        .unwrap();
        assert_eq!(options.command, CommandName::RunBlueprint);
        assert_eq!(
            options.blueprint,
            Some(cwd.join("blueprint.json").to_string_lossy().to_string())
        );

        let home = temp_dir("run-blueprint-home");
        let runtime = normalize_for_runtime(options, &cwd, &home).unwrap();

        assert_eq!(runtime.command, RuntimeCommand::RunBlueprint);
        assert_eq!(runtime.original_command, CommandName::RunBlueprint);
        assert!(runtime.site_storage.is_none());
        assert!(runtime.server_url.is_none());
        assert!(runtime
            .options
            .mounts
            .iter()
            .any(|mount| mount.vfs_path == "/wordpress/wp-content/plugins/plugin"));

        let _ = fs::remove_dir_all(cwd);
        let _ = fs::remove_dir_all(home);
    }

    #[test]
    fn build_snapshot_defaults_outfile_and_normalizes_runtime() {
        let cwd = temp_dir("build-snapshot");
        fs::create_dir_all(cwd.join("plugin")).unwrap();
        fs::write(
            cwd.join("plugin/demo.php"),
            "<?php\n/*\nPlugin Name: Native Demo\n*/\n",
        )
        .unwrap();
        let options = parse_cli_args_from(
            args(&["build-snapshot", "--auto-mount", "plugin", "--quiet"]),
            &cwd,
        )
        .unwrap();
        assert_eq!(options.command, CommandName::BuildSnapshot);
        assert_eq!(options.outfile, Some(cwd.join("wordpress.zip")));

        let home = temp_dir("build-snapshot-home");
        let runtime = normalize_for_runtime(options, &cwd, &home).unwrap();

        assert_eq!(runtime.command, RuntimeCommand::BuildSnapshot);
        assert_eq!(runtime.original_command, CommandName::BuildSnapshot);
        assert!(runtime.site_storage.is_none());
        assert!(runtime.server_url.is_none());
        assert!(runtime
            .options
            .mounts
            .iter()
            .any(|mount| mount.vfs_path == "/wordpress/wp-content/plugins/plugin"));

        let _ = fs::remove_dir_all(cwd);
        let _ = fs::remove_dir_all(home);
    }

    #[test]
    fn compatibility_intentionally_unsupported_options_have_stable_errors() {
        let cwd = temp_dir("compat-unsupported-options");
        for (flag, expected) in [
            ("--phpmyadmin", "phpMyAdmin installation"),
            ("--xdebug", "Xdebug bridge"),
            (
                "--experimental-unsafe-ide-integration=vscode",
                "unsafe IDE integration",
            ),
            ("--experimental-devtools", "browser devtools bridge"),
            (
                "--experimental-blueprints-v2-runner",
                "Blueprints v2 runner",
            ),
            (
                "--experimental-multi-worker=2",
                "deprecated Node worker option",
            ),
            ("--experimental-trace", "Node CLI trace output"),
            ("--internal-cookie-store", "Node cookie-store mediation"),
            ("--php-extension=ext.json", "custom PHP extension loading"),
            ("--no-intl", "disabling bundled Intl"),
            (
                "--mode=apply-to-existing-site",
                "Blueprints v2 mode selection",
            ),
            ("--redis", "Redis integration"),
            ("--memcached", "Memcached integration"),
        ] {
            let error = parse_cli_args_from(args(&["server", flag]), &cwd).unwrap_err();
            assert!(
                error.message().contains(expected),
                "{flag}: {}",
                error.message()
            );
            assert!(
                error.message().contains("Use the Node CLI"),
                "{flag}: {}",
                error.message()
            );
        }

        let error = parse_cli_args_from(args(&["php", "--xdebug", "-v"]), &cwd).unwrap_err();
        assert!(error.message().contains("Xdebug bridge"));

        let error =
            parse_cli_args_from(args(&["server", "--outfile=snapshot.zip"]), &cwd).unwrap_err();
        assert!(error
            .message()
            .contains("--outfile is only supported by the build-snapshot command"));

        let _ = fs::remove_dir_all(cwd);
    }

    #[test]
    fn parses_define_flags_and_default_debug_constants() {
        let cwd = temp_dir("define-flags");
        let options = parse_cli_args_from(
            vec![
                "server".to_string(),
                "--define".to_string(),
                "MY_STRING".to_string(),
                "value".to_string(),
                "--define-bool".to_string(),
                "MY_BOOL".to_string(),
                "1".to_string(),
                "--define-number".to_string(),
                "MY_NUMBER".to_string(),
                "42.5".to_string(),
            ],
            &cwd,
        )
        .unwrap();

        assert!(options.defined_constants.iter().any(|constant| {
            constant.name == "MY_STRING"
                && constant.kind == DefinedConstantKind::String
                && constant.value == PhpConstantValue::string("value")
        }));
        assert!(options.defined_constants.iter().any(|constant| {
            constant.name == "MY_BOOL"
                && constant.kind == DefinedConstantKind::Bool
                && constant.value == PhpConstantValue::bool(true)
        }));
        assert!(options.defined_constants.iter().any(|constant| {
            constant.name == "MY_NUMBER"
                && constant.kind == DefinedConstantKind::Number
                && constant.value == PhpConstantValue::number("42.5")
        }));
        assert!(options.defined_constants.iter().any(|constant| {
            constant.name == "WP_DEBUG" && constant.value == PhpConstantValue::bool(true)
        }));
        assert!(options.defined_constants.iter().any(|constant| {
            constant.name == "WP_DEBUG_LOG" && constant.value == PhpConstantValue::bool(true)
        }));
        assert!(options.defined_constants.iter().any(|constant| {
            constant.name == "WP_DEBUG_DISPLAY" && constant.value == PhpConstantValue::bool(false)
        }));

        let _ = fs::remove_dir_all(cwd);
    }

    #[test]
    fn define_flags_reject_invalid_values_and_cross_type_duplicates() {
        let cwd = temp_dir("define-errors");
        assert!(parse_cli_args_from(
            vec![
                "server".to_string(),
                "--define-bool".to_string(),
                "FEATURE".to_string(),
                "yes".to_string(),
            ],
            &cwd,
        )
        .unwrap_err()
        .message()
        .contains("Invalid boolean value"));
        assert!(parse_cli_args_from(
            vec![
                "server".to_string(),
                "--define-number".to_string(),
                "LIMIT".to_string(),
                "nan".to_string(),
            ],
            &cwd,
        )
        .unwrap_err()
        .message()
        .contains("Invalid number value"));
        assert!(parse_cli_args_from(
            vec![
                "server".to_string(),
                "--define".to_string(),
                "DUPLICATE".to_string(),
                "value".to_string(),
                "--define-bool".to_string(),
                "DUPLICATE".to_string(),
                "true".to_string(),
            ],
            &cwd,
        )
        .unwrap_err()
        .message()
        .contains("defined multiple times"));

        let _ = fs::remove_dir_all(cwd);
    }

    #[test]
    fn rejects_php_versions_below_native_support_floor() {
        let cwd = temp_dir("php-support-floor");
        let error = parse_cli_args_from(vec!["server".to_string(), "--php=5.2".to_string()], &cwd)
            .unwrap_err()
            .to_string();

        assert!(error.contains("Unsupported PHP version \"5.2\""), "{error}");
        assert!(
            error.contains("Supported versions: 7.4, 8.0, 8.1, 8.2, 8.3, 8.4, 8.5"),
            "{error}"
        );

        let _ = fs::remove_dir_all(cwd);
    }

    #[test]
    fn parses_start_no_auto_mount() {
        let cwd = temp_dir("start-no-auto");
        let options = parse_cli_args_from(
            vec![
                "start".to_string(),
                "--path=plugin".to_string(),
                "--no-auto-mount".to_string(),
                "--skip-browser".to_string(),
            ],
            &cwd,
        )
        .unwrap();

        assert_eq!(options.command, CommandName::Start);
        assert_eq!(options.auto_mount, AutoMountSetting::Disabled);
        assert!(options.skip_browser);
    }

    #[test]
    fn normalizes_start_to_server_with_managed_storage() {
        let cwd = temp_dir("managed-storage-cwd");
        let home = temp_dir("managed-storage-home");
        let options = parse_cli_args_from(
            vec!["start".to_string(), "--skip-browser".to_string()],
            &cwd,
        )
        .unwrap();
        let runtime = normalize_for_runtime(options, &cwd, &home).unwrap();

        assert_eq!(runtime.command, RuntimeCommand::Server);
        assert_eq!(runtime.options.command, CommandName::Server);
        assert!(matches!(
            &runtime.site_storage,
            Some(SiteStorage::Managed(_))
        ));
        let managed = match runtime.site_storage.as_ref().unwrap() {
            SiteStorage::Managed(path) => path.clone(),
            SiteStorage::ExplicitMount(_) => unreachable!(),
        };
        assert!(managed.starts_with(home.join(".wordpress-playground").join("sites")));
        assert_eq!(
            runtime
                .options
                .mounts_before_install
                .last()
                .unwrap()
                .vfs_path,
            "/wordpress"
        );
        assert_eq!(
            runtime.options.wordpress_install_mode,
            WordPressInstallMode::DownloadAndInstall
        );
    }

    #[test]
    fn normalizes_reset_start_with_managed_storage_to_fresh_install() {
        let cwd = temp_dir("managed-reset-cwd");
        let home = temp_dir("managed-reset-home");
        let managed = persistent_site_path(&home, &cwd);
        fs::create_dir_all(&managed).unwrap();
        fs::write(managed.join("stale-file.txt"), "stale").unwrap();

        let options = parse_cli_args_from(
            vec![
                "start".to_string(),
                "--skip-browser".to_string(),
                "--reset".to_string(),
            ],
            &cwd,
        )
        .unwrap();
        let runtime = normalize_for_runtime(options, &cwd, &home).unwrap();

        assert_eq!(
            runtime.options.wordpress_install_mode,
            WordPressInstallMode::DownloadAndInstall
        );
        let _ = fs::remove_dir_all(cwd);
        let _ = fs::remove_dir_all(home);
    }

    #[test]
    fn normalizes_start_with_plugin_auto_mount() {
        let cwd = temp_dir("plugin-cwd");
        let home = temp_dir("plugin-home");
        let plugin = cwd.join("sample-plugin");
        fs::create_dir_all(&plugin).unwrap();
        fs::write(
            plugin.join("sample-plugin.php"),
            "<?php\n/*\nPlugin Name: Sample Plugin\n*/\n",
        )
        .unwrap();

        let options = parse_cli_args_from(
            vec![
                "start".to_string(),
                format!("--path={}", plugin.display()),
                "--skip-browser".to_string(),
            ],
            &cwd,
        )
        .unwrap();
        let runtime = normalize_for_runtime(options, &cwd, &home).unwrap();
        assert!(runtime
            .options
            .mounts
            .iter()
            .any(|mount| mount.vfs_path == "/wordpress/wp-content/plugins/sample-plugin"));
    }

    #[test]
    fn normalizes_start_with_full_wordpress_auto_mount() {
        let cwd = temp_dir("wordpress-cwd");
        let home = temp_dir("wordpress-home");
        let wordpress = cwd.join("wordpress");
        fs::create_dir_all(wordpress.join("wp-admin")).unwrap();
        fs::create_dir_all(wordpress.join("wp-includes")).unwrap();
        fs::create_dir_all(wordpress.join("wp-content")).unwrap();

        let options = parse_cli_args_from(
            vec![
                "start".to_string(),
                format!("--path={}", wordpress.display()),
                "--skip-browser".to_string(),
            ],
            &cwd,
        )
        .unwrap();
        let runtime = normalize_for_runtime(options, &cwd, &home).unwrap();

        assert!(matches!(
            &runtime.site_storage,
            Some(SiteStorage::ExplicitMount(path)) if path == &wordpress
        ));
        assert_eq!(
            runtime.options.wordpress_install_mode,
            WordPressInstallMode::InstallFromExistingFilesIfNeeded
        );
    }

    #[test]
    fn parses_php_script() {
        let cwd = temp_dir("php");
        let options = parse_cli_args_from(
            vec![
                "php".to_string(),
                "--php=8.3".to_string(),
                "script.php".to_string(),
            ],
            &cwd,
        )
        .unwrap();
        assert_eq!(options.command, CommandName::Php);
        assert_eq!(options.script, Some(cwd.join("script.php")));
        assert_eq!(options.php_args, vec!["script.php".to_string()]);
    }

    #[test]
    fn parses_php_cli_flags_as_php_args() {
        let cwd = temp_dir("php-cli-flags");
        let options = parse_cli_args_from(
            vec!["php".to_string(), "--php=8.3".to_string(), "-v".to_string()],
            &cwd,
        )
        .unwrap();
        assert_eq!(options.command, CommandName::Php);
        assert_eq!(options.script, None);
        assert_eq!(options.php_args, vec!["-v".to_string()]);
    }

    #[test]
    fn parses_php_option_value_without_treating_value_as_script() {
        let cwd = temp_dir("php-r");
        let options = parse_cli_args_from(
            vec![
                "php".to_string(),
                "-r".to_string(),
                "echo 'ok';".to_string(),
            ],
            &cwd,
        )
        .unwrap();
        assert_eq!(options.script, None);
        assert_eq!(
            options.php_args,
            vec!["-r".to_string(), "echo 'ok';".to_string()]
        );
    }

    #[test]
    fn passes_unknown_php_long_options_through_as_php_args() {
        let cwd = temp_dir("php-long-option");
        let options =
            parse_cli_args_from(vec!["php".to_string(), "--version".to_string()], &cwd).unwrap();
        assert_eq!(options.script, None);
        assert_eq!(options.php_args, vec!["--version".to_string()]);
    }

    #[test]
    fn parses_php_script_arguments_after_script_path() {
        let cwd = temp_dir("php-script-args");
        let options = parse_cli_args_from(
            vec![
                "php".to_string(),
                "/tools/wp-cli.phar".to_string(),
                "--version".to_string(),
                "--allow-root".to_string(),
            ],
            &cwd,
        )
        .unwrap();
        assert_eq!(
            options.script,
            Some(resolve_path(&cwd, "/tools/wp-cli.phar"))
        );
        assert_eq!(
            options.php_args,
            vec![
                "/tools/wp-cli.phar".to_string(),
                "--version".to_string(),
                "--allow-root".to_string()
            ]
        );
    }
}
