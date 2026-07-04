use std::{env, path::PathBuf};

use crate::{
    args::{normalize_for_runtime, CliOptions, RuntimeCommand, Verbosity, DEFAULT_PORT},
    host::{HostMount, HostOptions, PhpConstantValue},
    mount::Mount,
    paths::WordPressInstallMode,
    runtime::{NativeRuntime, WasmEngineProfile},
    server::{
        ensure_tmp_mount, maybe_boot_wordpress_site, run_native_server, run_startup_steps,
        startup_steps_from_options, write_wordpress_snapshot_zip_with_symlink_policy,
        SymlinkPolicy,
    },
    wordpress::{
        defined_constants_for_host, ensure_wordpress_mount, prepare_wordpress, wordpress_mount_path,
    },
    CliError, Result,
};

pub fn run(options: CliOptions) -> Result<u8> {
    let cwd = env::current_dir()?;
    let home = home_dir().ok_or_else(|| CliError::new("Could not determine home directory"))?;
    let config = normalize_for_runtime(options, &cwd, &home)?;
    let engine_profile = match config.command {
        RuntimeCommand::Server => WasmEngineProfile::Optimized,
        RuntimeCommand::Php if env_flag("WP_PLAYGROUND_NATIVE_PHP_AOT") => {
            WasmEngineProfile::Optimized
        }
        RuntimeCommand::RunBlueprint | RuntimeCommand::BuildSnapshot | RuntimeCommand::Php => {
            WasmEngineProfile::FastStartup
        }
    };
    if !matches!(config.command, RuntimeCommand::Php) {
        progress(
            &config.options,
            format!(
                "Using PHP {} with WordPress {}",
                config.options.php, config.options.wp
            ),
        );
        progress(&config.options, "Loading native runtime assets");
    }
    let runtime = NativeRuntime::from_default_asset_root_with_engine_profile(engine_profile)?;
    runtime.verify_php_asset(&config.options.php)?;
    if !matches!(config.command, RuntimeCommand::Php) {
        progress(
            &config.options,
            format!("Verified packaged PHP {} wasm asset", config.options.php),
        );
    }

    match config.command {
        RuntimeCommand::Server => run_native_server(&runtime, &config),
        RuntimeCommand::RunBlueprint => run_blueprint_command(&runtime, &config.options),
        RuntimeCommand::BuildSnapshot => run_build_snapshot_command(&runtime, &config.options),
        RuntimeCommand::Php => {
            if config.options.php_args.is_empty() {
                return Err(CliError::new("The php command requires PHP arguments"));
            }
            run_php_command(&runtime, &config.options)
        }
    }
}

fn progress(options: &CliOptions, message: impl AsRef<str>) {
    if !matches!(options.verbosity, Verbosity::Quiet) {
        eprintln!("{}", message.as_ref());
    }
}

fn env_flag(name: &str) -> bool {
    env::var(name)
        .map(|value| {
            matches!(
                value.to_ascii_lowercase().as_str(),
                "1" | "true" | "yes" | "on"
            )
        })
        .unwrap_or(false)
}

fn run_blueprint_command(runtime: &NativeRuntime, options: &CliOptions) -> Result<u8> {
    let mounts = php_mounts(options)?;
    progress(options, "Preparing WordPress files");
    let prepared = prepare_wordpress(runtime.repo_root(), options, &mounts)?;
    if !prepared.installed_files_available {
        return Err(CliError::new(format!(
            "WordPress files are not available in {}",
            prepared.document_root.display()
        )));
    }
    progress(
        options,
        format!(
            "WordPress files ready at {}",
            prepared.document_root.display()
        ),
    );

    let site_url = php_site_url(options);
    let port = options.port.unwrap_or(DEFAULT_PORT);
    let mut host_options = php_host_options_for_mounts(options, &mounts, &site_url);
    host_options.echo_output = false;
    if options.debug {
        host_options.max_import_calls = Some(100_000);
    }

    let startup_steps = startup_steps_from_options(options)?;
    progress(options, format!("Loading PHP {} runtime", options.php));
    let mut php = runtime.instantiate_php_with_host_options(&options.php, host_options.clone())?;
    if should_boot_wordpress_for_php(options) {
        progress(options, "Preparing WordPress database");
        maybe_boot_wordpress_site(&mounts, &mut php, port, options)?;
        progress(options, "WordPress database ready");
    }
    if !startup_steps.is_empty() {
        progress(
            options,
            format!("Running {} Blueprint startup step(s)", startup_steps.len()),
        );
    }
    run_startup_steps(&startup_steps, &mounts, &mut php, port, &mut host_options)?;
    if !matches!(options.verbosity, Verbosity::Quiet) {
        println!("Done");
    }
    Ok(0)
}

fn run_build_snapshot_command(runtime: &NativeRuntime, options: &CliOptions) -> Result<u8> {
    let outfile = options
        .outfile
        .as_ref()
        .ok_or_else(|| CliError::new("The build-snapshot command requires --outfile"))?;
    let mounts = php_mounts(options)?;
    progress(options, "Preparing WordPress files");
    let prepared = prepare_wordpress(runtime.repo_root(), options, &mounts)?;
    if !prepared.installed_files_available {
        return Err(CliError::new(format!(
            "WordPress files are not available in {}",
            prepared.document_root.display()
        )));
    }
    progress(
        options,
        format!(
            "WordPress files ready at {}",
            prepared.document_root.display()
        ),
    );

    let site_url = php_site_url(options);
    let port = options.port.unwrap_or(DEFAULT_PORT);
    let mut host_options = php_host_options_for_mounts(options, &mounts, &site_url);
    host_options.echo_output = false;
    if options.debug {
        host_options.max_import_calls = Some(100_000);
    }

    let startup_steps = startup_steps_from_options(options)?;
    progress(options, format!("Loading PHP {} runtime", options.php));
    let mut php = runtime.instantiate_php_with_host_options(&options.php, host_options.clone())?;
    if should_boot_wordpress_for_php(options) {
        progress(options, "Preparing WordPress database");
        maybe_boot_wordpress_site(&mounts, &mut php, port, options)?;
        progress(options, "WordPress database ready");
    }
    if !startup_steps.is_empty() {
        progress(
            options,
            format!("Running {} Blueprint startup step(s)", startup_steps.len()),
        );
    }
    run_startup_steps(&startup_steps, &mounts, &mut php, port, &mut host_options)?;
    let symlink_policy = if options.follow_symlinks {
        SymlinkPolicy::Follow
    } else {
        SymlinkPolicy::BlockEscapes
    };
    write_wordpress_snapshot_zip_with_symlink_policy(&mounts, outfile, symlink_policy)?;
    if !matches!(options.verbosity, Verbosity::Quiet) {
        println!("Exported to {}", outfile.display());
    }
    Ok(0)
}

#[cfg(test)]
fn php_host_options(options: &CliOptions) -> Result<HostOptions> {
    let mounts = php_mounts(options)?;
    Ok(php_host_options_for_mounts(
        options,
        &mounts,
        &php_site_url(options),
    ))
}

fn run_php_command(runtime: &NativeRuntime, options: &CliOptions) -> Result<u8> {
    let mounts = php_mounts(options)?;
    let prepare_wordpress_files = should_prepare_wordpress_for_php(options);
    if prepare_wordpress_files {
        let prepared = prepare_wordpress(runtime.repo_root(), options, &mounts)?;
        if !prepared.installed_files_available {
            return Err(CliError::new(format!(
                "WordPress files are not available in {}",
                prepared.document_root.display()
            )));
        }
    }

    let site_url = php_site_url(options);
    let port = options.port.unwrap_or(DEFAULT_PORT);
    let mut host_options = php_host_options_for_mounts(options, &mounts, &site_url);
    let argv = php_argv(options);
    add_cli_allowed_host_paths(&mut host_options, &argv);
    if options.debug {
        host_options.max_import_calls = Some(1_000);
    }

    let startup_steps = startup_steps_from_options(options)?;
    if should_boot_wordpress_for_php(options) || !startup_steps.is_empty() {
        let mut setup_host_options = host_options.clone();
        setup_host_options.echo_output = false;
        let mut setup_php =
            runtime.instantiate_php_with_host_options(&options.php, setup_host_options)?;
        if should_boot_wordpress_for_php(options) {
            maybe_boot_wordpress_site(&mounts, &mut setup_php, port, options)?;
        }
        run_startup_steps(
            &startup_steps,
            &mounts,
            &mut setup_php,
            port,
            &mut host_options,
        )?;
    }

    let mut php = runtime.instantiate_php_with_host_options(&options.php, host_options)?;
    let exit_code = php.run_cli_session_with_trace(&argv, options.debug)?;
    Ok(normalize_exit_code(exit_code))
}

fn php_mounts(options: &CliOptions) -> Result<Vec<Mount>> {
    let mut mounts = Vec::new();
    mounts.extend(options.mounts_before_install.clone());
    mounts.extend(options.mounts.clone());
    ensure_wordpress_mount(&mut mounts)?;
    ensure_tmp_mount(&mut mounts)?;
    Ok(mounts)
}

fn php_host_options_for_mounts(
    options: &CliOptions,
    mounts: &[Mount],
    site_url: &str,
) -> HostOptions {
    let mut string_constants = vec![
        (
            "WP_HOME".to_string(),
            PhpConstantValue::string(site_url.to_string()),
        ),
        (
            "WP_SITEURL".to_string(),
            PhpConstantValue::string(site_url.to_string()),
        ),
    ];
    let wordpress_root = wordpress_mount_path(mounts);
    string_constants.extend(defined_constants_for_host(
        &options.defined_constants,
        wordpress_root.as_deref(),
    ));

    HostOptions {
        follow_symlinks: options.follow_symlinks,
        mounts: host_mounts(mounts),
        string_constants,
        opcache_mode: options.opcache,
        host_cache: options.opcache.enables_host_cache(),
        ..HostOptions::default()
    }
}

fn php_site_url(options: &CliOptions) -> String {
    options
        .site_url
        .clone()
        .unwrap_or_else(|| format!("http://127.0.0.1:{}", options.port.unwrap_or(DEFAULT_PORT)))
}

fn should_prepare_wordpress_for_php(options: &CliOptions) -> bool {
    !matches!(
        options.wordpress_install_mode,
        WordPressInstallMode::DoNotAttemptInstalling
    )
}

fn should_boot_wordpress_for_php(options: &CliOptions) -> bool {
    should_prepare_wordpress_for_php(options) && !options.skip_sqlite_setup
}

fn php_argv(options: &CliOptions) -> Vec<String> {
    let mut args = options.php_args.clone();
    if let Some(script) = &options.script {
        if let Some(index) = args.iter().position(|arg| !arg.starts_with('-')) {
            args[index] = script.to_string_lossy().to_string();
        }
    }

    let mut argv = vec!["php".to_string()];
    argv.extend(args);
    argv
}

fn add_cli_allowed_host_paths(host_options: &mut HostOptions, argv: &[String]) {
    for arg in argv.iter().skip(1) {
        let path = PathBuf::from(arg);
        if path.exists() {
            host_options.allowed_host_paths.push(path.clone());
            if let Some(parent) = path.parent() {
                host_options.allowed_host_paths.push(parent.to_path_buf());
            }
        }
    }
}

fn host_mounts(mounts: &[Mount]) -> Vec<HostMount> {
    mounts
        .iter()
        .map(|mount| HostMount {
            host_path: mount.host_path.clone(),
            vfs_path: mount.vfs_path.clone(),
        })
        .collect()
}

fn normalize_exit_code(exit_code: i32) -> u8 {
    u8::try_from(exit_code).unwrap_or(1)
}

fn home_dir() -> Option<PathBuf> {
    if cfg!(windows) {
        env::var_os("USERPROFILE").map(PathBuf::from).or_else(|| {
            let drive = env::var_os("HOMEDRIVE")?;
            let path = env::var_os("HOMEPATH")?;
            let mut home = PathBuf::from(drive);
            home.push(path);
            Some(home)
        })
    } else {
        env::var_os("HOME").map(PathBuf::from)
    }
}

#[cfg(test)]
mod tests {
    use std::{
        env, fs,
        io::{Cursor, Read},
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    use crate::{
        args::parse_cli_args_from,
        commands::{
            add_cli_allowed_host_paths, php_argv, php_host_options, run_blueprint_command,
            run_build_snapshot_command, run_php_command,
        },
        runtime::{repo_root_from_manifest_dir, NativeRuntime},
    };

    fn temp_dir(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = env::temp_dir().join(format!("wp-playground-native-command-{name}-{unique}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn php_host_options_include_manual_mounts_tmp_and_symlink_policy() {
        let cwd = temp_dir("php-host-options");
        let tools = cwd.join("tools");
        fs::create_dir_all(&tools).unwrap();
        let options = parse_cli_args_from(
            vec![
                "php".to_string(),
                "--mount-dir-before-install".to_string(),
                "tools".to_string(),
                "/tools".to_string(),
                "--follow-symlinks".to_string(),
                "/tools/tool.php".to_string(),
            ],
            &cwd,
        )
        .unwrap();

        let host_options = php_host_options(&options).unwrap();

        assert!(host_options.follow_symlinks);
        assert!(host_options
            .mounts
            .iter()
            .any(|mount| mount.host_path == tools && mount.vfs_path == "/tools"));
        assert!(host_options
            .mounts
            .iter()
            .any(|mount| mount.vfs_path == "/wordpress"));
        assert!(host_options
            .mounts
            .iter()
            .any(|mount| mount.vfs_path == "/tmp"));

        let _ = fs::remove_dir_all(cwd);
    }

    #[test]
    fn php_argv_uses_resolved_relative_script_path() {
        let cwd = temp_dir("php-relative-argv");
        let options = parse_cli_args_from(
            vec![
                "php".to_string(),
                "--skip-wordpress-install".to_string(),
                "--skip-sqlite-setup".to_string(),
                "script.php".to_string(),
                "arg".to_string(),
            ],
            &cwd,
        )
        .unwrap();

        assert_eq!(
            php_argv(&options),
            vec![
                "php".to_string(),
                cwd.join("script.php").to_string_lossy().to_string(),
                "arg".to_string(),
            ]
        );

        let _ = fs::remove_dir_all(cwd);
    }

    #[test]
    #[ignore = "Full WordPress + PHP wasm CLI execution is an explicit smoke test."]
    fn real_php_command_prepares_and_boots_wordpress_before_cli_execution() {
        let runtime = NativeRuntime::from_repo_root(repo_root_from_manifest_dir()).unwrap();
        let cwd = temp_dir("php-wp-cwd");
        let wordpress = cwd.join("wordpress");
        let tmp = cwd.join("tmp");
        fs::create_dir_all(&wordpress).unwrap();
        fs::create_dir_all(&tmp).unwrap();
        fs::write(
            tmp.join("check-site.php"),
            "<?php require '/wordpress/wp-load.php'; file_put_contents('/tmp/siteurl.txt', home_url());",
        )
        .unwrap();
        let options = parse_cli_args_from(
            vec![
                "php".to_string(),
                "--wp=6.9".to_string(),
                "--site-url=http://native-cli.test".to_string(),
                "--mount-dir-before-install".to_string(),
                wordpress.to_string_lossy().to_string(),
                "/wordpress".to_string(),
                "--mount-dir-before-install".to_string(),
                tmp.to_string_lossy().to_string(),
                "/tmp".to_string(),
                "/tmp/check-site.php".to_string(),
            ],
            &cwd,
        )
        .unwrap();

        let exit_code = run_php_command(&runtime, &options).unwrap();

        assert_eq!(exit_code, 0);
        assert_eq!(
            fs::read_to_string(tmp.join("siteurl.txt")).unwrap(),
            "http://native-cli.test"
        );

        let _ = fs::remove_dir_all(cwd);
    }

    #[test]
    #[ignore = "Full WordPress + PHP wasm Blueprint execution is an explicit smoke test."]
    fn real_run_blueprint_command_boots_wordpress_and_applies_blueprint() {
        let runtime = NativeRuntime::from_repo_root(repo_root_from_manifest_dir()).unwrap();
        let cwd = temp_dir("run-blueprint-wp-cwd");
        let wordpress = cwd.join("wordpress");
        let tmp = cwd.join("tmp");
        fs::create_dir_all(&wordpress).unwrap();
        fs::create_dir_all(&tmp).unwrap();
        let blueprint = cwd.join("blueprint.json");
        fs::write(
            &blueprint,
            r#"{
                "steps": [
                    {
                        "step": "runPHP",
                        "code": "<?php require_once '/wordpress/wp-load.php'; update_option('native_run_blueprint', 'ok'); file_put_contents('/tmp/run-blueprint-result.txt', get_option('native_run_blueprint'));"
                    }
                ]
            }"#,
        )
        .unwrap();
        let options = parse_cli_args_from(
            vec![
                "run-blueprint".to_string(),
                "--wp=6.9".to_string(),
                "--site-url=http://native-blueprint.test".to_string(),
                "--blueprint".to_string(),
                blueprint.to_string_lossy().to_string(),
                "--mount-dir-before-install".to_string(),
                wordpress.to_string_lossy().to_string(),
                "/wordpress".to_string(),
                "--mount-dir-before-install".to_string(),
                tmp.to_string_lossy().to_string(),
                "/tmp".to_string(),
                "--quiet".to_string(),
            ],
            &cwd,
        )
        .unwrap();

        let exit_code = run_blueprint_command(&runtime, &options).unwrap();

        assert_eq!(exit_code, 0);
        assert_eq!(
            fs::read_to_string(tmp.join("run-blueprint-result.txt")).unwrap(),
            "ok"
        );

        let _ = fs::remove_dir_all(cwd);
    }

    #[test]
    #[ignore = "Full WordPress + PHP wasm snapshot execution is an explicit smoke test."]
    fn real_build_snapshot_command_exports_booted_wordpress_after_blueprint() {
        let runtime = NativeRuntime::from_repo_root(repo_root_from_manifest_dir()).unwrap();
        let cwd = temp_dir("build-snapshot-wp-cwd");
        let wordpress = cwd.join("wordpress");
        fs::create_dir_all(&wordpress).unwrap();
        let blueprint = cwd.join("blueprint.json");
        fs::write(
            &blueprint,
            r#"{
                "steps": [
                    {
                        "step": "runPHP",
                        "code": "<?php file_put_contents('/wordpress/snapshot-marker.txt', 'snapshot-ok');"
                    }
                ]
            }"#,
        )
        .unwrap();
        let outfile = cwd.join("snapshot.zip");
        let options = parse_cli_args_from(
            vec![
                "build-snapshot".to_string(),
                "--wp=6.9".to_string(),
                "--site-url=http://native-snapshot.test".to_string(),
                "--blueprint".to_string(),
                blueprint.to_string_lossy().to_string(),
                "--mount-dir-before-install".to_string(),
                wordpress.to_string_lossy().to_string(),
                "/wordpress".to_string(),
                "--outfile".to_string(),
                outfile.to_string_lossy().to_string(),
                "--quiet".to_string(),
            ],
            &cwd,
        )
        .unwrap();

        let exit_code = run_build_snapshot_command(&runtime, &options).unwrap();

        assert_eq!(exit_code, 0);
        let bytes = fs::read(&outfile).unwrap();
        let mut zip = zip::ZipArchive::new(Cursor::new(bytes)).unwrap();
        let mut marker = String::new();
        zip.by_name("/wordpress/snapshot-marker.txt")
            .unwrap()
            .read_to_string(&mut marker)
            .unwrap();
        assert_eq!(marker, "snapshot-ok");
        assert!(zip.by_name("playground-export.json").is_err());

        let _ = fs::remove_dir_all(cwd);
    }

    #[test]
    #[ignore = "Full PHP wasm CLI execution is an explicit smoke test."]
    fn real_php_cli_executes_relative_script_from_cwd() {
        let runtime = NativeRuntime::from_repo_root(repo_root_from_manifest_dir()).unwrap();
        let cwd = temp_dir("php-relative-script");
        let tmp = cwd.join("tmp");
        fs::create_dir_all(&tmp).unwrap();
        fs::write(
            cwd.join("script.php"),
            "<?php file_put_contents('/tmp/relative-result.txt', 'relative-ok');",
        )
        .unwrap();
        let options = parse_cli_args_from(
            vec![
                "php".to_string(),
                "--skip-wordpress-install".to_string(),
                "--skip-sqlite-setup".to_string(),
                "--mount-dir-before-install".to_string(),
                tmp.to_string_lossy().to_string(),
                "/tmp".to_string(),
                "script.php".to_string(),
            ],
            &cwd,
        )
        .unwrap();
        let mut host_options = php_host_options(&options).unwrap();
        host_options.echo_output = false;
        let argv = php_argv(&options);
        add_cli_allowed_host_paths(&mut host_options, &argv);
        let mut php = runtime
            .instantiate_php_with_host_options(&options.php, host_options)
            .unwrap();

        let exit_code = php.run_cli_session(&argv).unwrap();

        assert_eq!(exit_code, 0);
        assert_eq!(
            fs::read_to_string(tmp.join("relative-result.txt")).unwrap(),
            "relative-ok"
        );

        let _ = fs::remove_dir_all(cwd);
    }

    #[test]
    #[ignore = "Full PHP wasm CLI execution is an explicit smoke test."]
    fn real_php_cli_chdir_updates_relative_vfs_resolution() {
        let runtime = NativeRuntime::from_repo_root(repo_root_from_manifest_dir()).unwrap();
        let cwd = temp_dir("php-chdir-relative");
        let wordpress = cwd.join("wordpress");
        let plugin_dir = wordpress.join("wp-content/plugins/demo");
        let tmp = cwd.join("tmp");
        fs::create_dir_all(&plugin_dir).unwrap();
        fs::create_dir_all(&tmp).unwrap();
        fs::write(plugin_dir.join("relative.txt"), "relative-ok").unwrap();
        fs::write(
            cwd.join("script.php"),
            r#"<?php
if (!chdir('/wordpress/wp-content/plugins/demo')) {
    exit(2);
}
file_put_contents('/tmp/chdir-result.txt', getcwd() . '|' . file_get_contents('relative.txt'));
"#,
        )
        .unwrap();
        let options = parse_cli_args_from(
            vec![
                "php".to_string(),
                "--skip-wordpress-install".to_string(),
                "--skip-sqlite-setup".to_string(),
                "--mount-dir-before-install".to_string(),
                wordpress.to_string_lossy().to_string(),
                "/wordpress".to_string(),
                "--mount-dir-before-install".to_string(),
                tmp.to_string_lossy().to_string(),
                "/tmp".to_string(),
                "script.php".to_string(),
            ],
            &cwd,
        )
        .unwrap();
        let mut host_options = php_host_options(&options).unwrap();
        host_options.echo_output = false;
        let argv = php_argv(&options);
        add_cli_allowed_host_paths(&mut host_options, &argv);
        let mut php = runtime
            .instantiate_php_with_host_options(&options.php, host_options)
            .unwrap();

        let exit_code = php.run_cli_session(&argv).unwrap();

        assert_eq!(exit_code, 0);
        assert_eq!(
            fs::read_to_string(tmp.join("chdir-result.txt")).unwrap(),
            "/wordpress/wp-content/plugins/demo|relative-ok"
        );

        let _ = fs::remove_dir_all(cwd);
    }

    #[cfg(unix)]
    #[test]
    #[ignore = "Full PHP wasm CLI execution is an explicit smoke test."]
    fn real_php_cli_metadata_syscalls_update_host_mount() {
        let runtime = NativeRuntime::from_repo_root(repo_root_from_manifest_dir()).unwrap();
        let cwd = temp_dir("php-metadata-syscalls");
        let wordpress = cwd.join("wordpress");
        let tmp = cwd.join("tmp");
        fs::create_dir_all(&wordpress).unwrap();
        fs::create_dir_all(&tmp).unwrap();
        fs::write(wordpress.join("file.txt"), "metadata-ok").unwrap();
        fs::write(
            cwd.join("script.php"),
            r#"<?php
if (!chmod('/wordpress/file.txt', 0600)) {
    exit(2);
}
if (!touch('/wordpress/file.txt', 2, 1)) {
    exit(3);
}
if (!symlink('file.txt', '/wordpress/link.txt')) {
    exit(4);
}
file_put_contents('/wordpress/readonly.txt', 'read-only');
if (!chmod('/wordpress/readonly.txt', 0400)) {
    exit(5);
}
clearstatcache(true, '/wordpress/file.txt');
clearstatcache(true, '/wordpress/link.txt');
clearstatcache(true, '/wordpress/readonly.txt');
file_put_contents('/tmp/metadata-result.json', json_encode([
    'mode' => fileperms('/wordpress/file.txt') & 0777,
    'mtime' => filemtime('/wordpress/file.txt'),
    'link_is_link' => is_link('/wordpress/link.txt'),
    'link_lstat_type' => lstat('/wordpress/link.txt')['mode'] & 0170000,
    'link_stat_type' => stat('/wordpress/link.txt')['mode'] & 0170000,
    'readonly_readable' => is_readable('/wordpress/readonly.txt'),
    'readonly_writable' => is_writable('/wordpress/readonly.txt'),
    'readonly_executable' => is_executable('/wordpress/readonly.txt'),
]));
"#,
        )
        .unwrap();
        let options = parse_cli_args_from(
            vec![
                "php".to_string(),
                "--skip-wordpress-install".to_string(),
                "--skip-sqlite-setup".to_string(),
                "--mount-dir-before-install".to_string(),
                wordpress.to_string_lossy().to_string(),
                "/wordpress".to_string(),
                "--mount-dir-before-install".to_string(),
                tmp.to_string_lossy().to_string(),
                "/tmp".to_string(),
                "script.php".to_string(),
            ],
            &cwd,
        )
        .unwrap();
        let mut host_options = php_host_options(&options).unwrap();
        host_options.echo_output = false;
        let argv = php_argv(&options);
        add_cli_allowed_host_paths(&mut host_options, &argv);
        let mut php = runtime
            .instantiate_php_with_host_options(&options.php, host_options)
            .unwrap();

        let exit_code = php.run_cli_session(&argv).unwrap();

        assert_eq!(
            exit_code,
            0,
            "stderr={}",
            String::from_utf8_lossy(&php.take_captured_stderr())
        );
        let result: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(tmp.join("metadata-result.json")).unwrap())
                .unwrap();
        let imports = php.recent_host_imports(120);
        let host_mtime = fs::metadata(wordpress.join("file.txt"))
            .unwrap()
            .modified()
            .unwrap()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        assert_eq!(result["mode"], 0o600);
        assert_eq!(
            result["mtime"], 2,
            "host_mtime={host_mtime}; imports={imports}"
        );
        assert_eq!(
            fs::read_link(wordpress.join("link.txt"))
                .unwrap()
                .file_name()
                .unwrap(),
            "file.txt"
        );
        assert_eq!(result["link_is_link"], true);
        assert_eq!(result["link_lstat_type"], 0o120000);
        assert_eq!(result["link_stat_type"], 0o100000);
        assert_eq!(result["readonly_readable"], true);
        assert_eq!(result["readonly_writable"], false);
        assert_eq!(result["readonly_executable"], false);

        let _ = fs::remove_dir_all(cwd);
    }

    #[test]
    #[ignore = "Full PHP wasm CLI execution is an explicit smoke test."]
    fn real_php_cli_defines_typed_constants() {
        let runtime = NativeRuntime::from_repo_root(repo_root_from_manifest_dir()).unwrap();
        let cwd = temp_dir("php-defined-constants");
        let tmp = cwd.join("tmp");
        fs::create_dir_all(&tmp).unwrap();
        fs::write(
            cwd.join("constants.php"),
            r#"<?php
file_put_contents('/tmp/constants.json', json_encode([
    'string' => MY_STRING_CONSTANT,
    'bool' => MY_BOOL_CONSTANT,
    'false_bool' => MY_FALSE_CONSTANT,
    'number' => MY_NUMBER_CONSTANT,
    'wp_debug' => WP_DEBUG,
    'wp_debug_log' => WP_DEBUG_LOG,
    'wp_debug_display' => WP_DEBUG_DISPLAY,
]));
"#,
        )
        .unwrap();
        let options = parse_cli_args_from(
            vec![
                "php".to_string(),
                "--skip-wordpress-install".to_string(),
                "--skip-sqlite-setup".to_string(),
                "--define".to_string(),
                "MY_STRING_CONSTANT".to_string(),
                "test-value".to_string(),
                "--define-bool".to_string(),
                "MY_BOOL_CONSTANT".to_string(),
                "true".to_string(),
                "--define-bool".to_string(),
                "MY_FALSE_CONSTANT".to_string(),
                "0".to_string(),
                "--define-number".to_string(),
                "MY_NUMBER_CONSTANT".to_string(),
                "42".to_string(),
                "--mount-dir-before-install".to_string(),
                tmp.to_string_lossy().to_string(),
                "/tmp".to_string(),
                "constants.php".to_string(),
            ],
            &cwd,
        )
        .unwrap();
        let mut host_options = php_host_options(&options).unwrap();
        host_options.echo_output = false;
        let argv = php_argv(&options);
        add_cli_allowed_host_paths(&mut host_options, &argv);
        let mut php = runtime
            .instantiate_php_with_host_options(&options.php, host_options)
            .unwrap();

        let exit_code = php.run_cli_session(&argv).unwrap();

        assert_eq!(exit_code, 0);
        let constants: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(tmp.join("constants.json")).unwrap()).unwrap();
        assert_eq!(constants["string"], "test-value");
        assert_eq!(constants["bool"], true);
        assert_eq!(constants["false_bool"], false);
        assert_eq!(constants["number"], 42);
        assert_eq!(constants["wp_debug"], true);
        assert_eq!(constants["wp_debug_log"], true);
        assert_eq!(constants["wp_debug_display"], false);

        let _ = fs::remove_dir_all(cwd);
    }

    #[test]
    #[ignore = "Full PHP wasm PHAR execution is an explicit smoke test."]
    fn real_php_cli_executes_mounted_wp_cli_phar() {
        let (exit_code, stdout, stderr) =
            run_mounted_fixture_phar("/tools/wp-cli.phar", "--version");

        assert_eq!(exit_code, 0, "stderr={stderr}");
        assert!(
            stdout.contains("WP-CLI"),
            "stdout={stdout}; stderr={stderr}"
        );
    }

    #[test]
    #[ignore = "Full PHP wasm PHAR execution is an explicit smoke test."]
    fn real_php_cli_executes_mounted_composer_phar() {
        let (exit_code, stdout, stderr) =
            run_mounted_fixture_phar("/tools/composer.phar", "--version");

        assert_eq!(exit_code, 0, "stderr={stderr}");
        assert!(
            stdout.contains("Composer version"),
            "stdout={stdout}; stderr={stderr}"
        );
    }

    fn run_mounted_fixture_phar(script: &str, arg: &str) -> (i32, String, String) {
        let runtime = NativeRuntime::from_repo_root(repo_root_from_manifest_dir()).unwrap();
        let repo_root = repo_root_from_manifest_dir();
        let fixtures = repo_root.join("packages/playground/cli/tests/fixtures");
        let options = parse_cli_args_from(
            vec![
                "php".to_string(),
                "--skip-wordpress-install".to_string(),
                "--skip-sqlite-setup".to_string(),
                "--mount-dir-before-install".to_string(),
                fixtures.to_string_lossy().to_string(),
                "/tools".to_string(),
                script.to_string(),
                arg.to_string(),
            ],
            &repo_root,
        )
        .unwrap();
        let mut host_options = php_host_options(&options).unwrap();
        host_options.echo_output = false;
        let mut php = runtime
            .instantiate_php_with_host_options(&options.php, host_options)
            .unwrap();
        let mut argv = vec!["php".to_string()];
        argv.extend(options.php_args.clone());

        let exit_code = php.run_cli_session(&argv).unwrap();
        let stdout = String::from_utf8_lossy(&php.take_captured_stdout()).to_string();
        let stderr = String::from_utf8_lossy(&php.take_captured_stderr()).to_string();

        (exit_code, stdout, stderr)
    }
}
