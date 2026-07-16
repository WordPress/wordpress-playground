use std::{env, path::PathBuf};

use crate::{
    args::{
        normalize_for_runtime, CliOptions, RuntimeCommand, Verbosity, DEFAULT_PORT,
        SUPPORTED_PHP_VERSIONS,
    },
    control::ControlOptions,
    mount::Mount,
    paths::WordPressInstallMode,
    php_config::PhpWorkerOptions,
    php_runtime_files::PhpConstantValue,
    runtime::{NativeRuntime, WasmEngineProfile},
    server::{
        ensure_tmp_mount, maybe_boot_wordpress_site, run_native_server_with_control,
        run_startup_steps, startup_steps_from_options,
        write_wordpress_snapshot_zip_with_symlink_policy, SymlinkPolicy,
    },
    terminal::TerminalStyle,
    wordpress::{
        defined_constants_for_host, ensure_wordpress_mount, prepare_wordpress, wordpress_mount_path,
    },
    CliError, Result,
};

pub fn run(options: CliOptions) -> Result<u8> {
    run_with_control(options, None)
}

pub fn run_with_control(options: CliOptions, handshake_path: Option<PathBuf>) -> Result<u8> {
    let cwd = env::current_dir()?;
    let home = home_dir().ok_or_else(|| CliError::new("Could not determine home directory"))?;
    let config = normalize_for_runtime(options, &cwd, &home)?;
    let engine_profile = match config.command {
        RuntimeCommand::Server => WasmEngineProfile::Optimized,
        RuntimeCommand::RunBlueprint | RuntimeCommand::BuildSnapshot => {
            WasmEngineProfile::FastStartup
        }
    };
    let control = handshake_path
        .map(ControlOptions::from_handshake_path)
        .transpose()?;
    if control.is_some() && !matches!(config.command, RuntimeCommand::Server) {
        return Err(CliError::new(
            "--experimental-control-handshake is only supported by start and server",
        ));
    }
    progress(
        &config.options,
        format!(
            "Using PHP {} with WordPress {}",
            config.options.php, config.options.wp
        ),
    );
    progress(&config.options, "Loading native runtime assets");
    let runtime = NativeRuntime::from_default_asset_root_with_engine_profile(engine_profile)?;
    runtime.verify_php_asset(&config.options.php)?;
    progress(
        &config.options,
        format!("Verified packaged PHP {} wasm asset", config.options.php),
    );

    match config.command {
        RuntimeCommand::Server => run_native_server_with_control(&runtime, &config, control),
        RuntimeCommand::RunBlueprint => run_blueprint_command(&runtime, &config.options),
        RuntimeCommand::BuildSnapshot => run_build_snapshot_command(&runtime, &config.options),
    }
}

pub fn prepare_native_runtime() -> Result<()> {
    for profile in [WasmEngineProfile::FastStartup, WasmEngineProfile::Optimized] {
        let runtime = NativeRuntime::from_default_asset_root_with_engine_profile(profile)?;
        for php_version in SUPPORTED_PHP_VERSIONS {
            runtime.php_artifact(php_version)?;
        }
    }
    Ok(())
}

fn progress(options: &CliOptions, message: impl AsRef<str>) {
    if !matches!(options.verbosity, Verbosity::Quiet) {
        eprintln!("{}", TerminalStyle::stderr().dim(message.as_ref()));
    }
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
    let mut worker_options = php_worker_options_for_mounts(options, &mounts, &site_url);

    let startup_steps = startup_steps_from_options(options)?;
    progress(options, format!("Loading PHP {} runtime", options.php));
    let mut php =
        runtime.instantiate_php_worker_with_options(&options.php, worker_options.clone())?;
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
    run_startup_steps(
        &startup_steps,
        &mounts,
        &mut php,
        port,
        &mut worker_options,
        symlink_policy(options),
    )?;
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
    let mut worker_options = php_worker_options_for_mounts(options, &mounts, &site_url);

    let startup_steps = startup_steps_from_options(options)?;
    progress(options, format!("Loading PHP {} runtime", options.php));
    let mut php =
        runtime.instantiate_php_worker_with_options(&options.php, worker_options.clone())?;
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
    let symlink_policy = symlink_policy(options);
    run_startup_steps(
        &startup_steps,
        &mounts,
        &mut php,
        port,
        &mut worker_options,
        symlink_policy,
    )?;
    write_wordpress_snapshot_zip_with_symlink_policy(&mounts, outfile, symlink_policy)?;
    if !matches!(options.verbosity, Verbosity::Quiet) {
        println!("Exported to {}", outfile.display());
    }
    Ok(0)
}

fn php_mounts(options: &CliOptions) -> Result<Vec<Mount>> {
    let mut mounts = Vec::new();
    mounts.extend(options.mounts_before_install.clone());
    mounts.extend(options.mounts.clone());
    ensure_wordpress_mount(&mut mounts)?;
    ensure_tmp_mount(&mut mounts)?;
    Ok(mounts)
}

fn php_worker_options_for_mounts(
    options: &CliOptions,
    mounts: &[Mount],
    site_url: &str,
) -> PhpWorkerOptions {
    let mut constants = vec![
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
    constants.extend(defined_constants_for_host(
        &options.defined_constants,
        wordpress_root.as_deref(),
    ));

    PhpWorkerOptions {
        mounts: mounts.to_vec(),
        constants,
        ..PhpWorkerOptions::default()
    }
}

fn php_site_url(options: &CliOptions) -> String {
    options
        .site_url
        .clone()
        .unwrap_or_else(|| format!("http://127.0.0.1:{}", options.port.unwrap_or(DEFAULT_PORT)))
}

fn should_boot_wordpress_for_php(options: &CliOptions) -> bool {
    !matches!(
        options.wordpress_install_mode,
        WordPressInstallMode::DoNotAttemptInstalling
    ) && !options.skip_sqlite_setup
}

fn symlink_policy(options: &CliOptions) -> SymlinkPolicy {
    if options.follow_symlinks {
        SymlinkPolicy::Follow
    } else {
        SymlinkPolicy::BlockEscapes
    }
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
        commands::{run_blueprint_command, run_build_snapshot_command},
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
}
