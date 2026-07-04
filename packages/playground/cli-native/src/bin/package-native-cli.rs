use std::{
    env, fs,
    path::{Path, PathBuf},
    process::ExitCode,
    time::{SystemTime, UNIX_EPOCH},
};

use wp_playground_native::{
    args::{DEFAULT_WP_VERSION, SUPPORTED_PHP_VERSIONS},
    packaging::{
        default_package_name, default_release_binary_path, package_native_cli,
        run_packaged_build_snapshot_smoke, run_packaged_php_smoke,
        run_packaged_run_blueprint_smoke, run_packaged_wordpress_server_smoke, PackageOptions,
        PackageSummary,
    },
    runtime::asset_root_from_manifest_dir,
    CliError, Result,
};

const WORDPRESS_BUILDS_DIR: &str = "packages/playground/wordpress-builds/src/wordpress";
const PACKAGE_OPTION_NAMES: &[&str] = &[
    "--binary",
    "--asset-root",
    "--out-dir",
    "--name",
    "--php-version",
    "--include-wordpress-assets",
    "--skip-wordpress-assets",
    "--skip-archive",
    "--precompile-wasmtime",
    "--no-precompile-wasmtime",
    "--smoke-php-version",
    "--smoke-wordpress-server",
    "--smoke-run-blueprint",
    "--smoke-build-snapshot",
    "--smoke-wordpress-version",
    "--help",
];

fn main() -> ExitCode {
    match run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("error: {error}");
            ExitCode::from(1)
        }
    }
}

fn run() -> Result<()> {
    let parsed = parse_args(std::env::args().skip(1).collect())?;
    if parsed.help {
        print_help();
        return Ok(());
    }

    let summary = package_native_cli(&parsed.options)?;
    println!("package: {}", summary.package_root.display());
    println!("binary: {}", summary.binary_path.display());
    println!("asset-root: {}", summary.asset_root.display());
    println!(
        "package-manifest: {}",
        summary.package_manifest_path.display()
    );
    if let Some(archive_path) = &summary.archive_path {
        println!("archive: {}", archive_path.display());
    }
    if let Some(checksum_path) = &summary.archive_checksum_path {
        println!("archive-sha256: {}", checksum_path.display());
    }
    if let Some(manifest_path) = &summary.archive_manifest_path {
        println!("archive-manifest: {}", manifest_path.display());
    }
    let has_wordpress_smokes = parsed.smoke_wordpress_server.is_some()
        || parsed.smoke_run_blueprint.is_some()
        || parsed.smoke_build_snapshot.is_some();
    let wordpress_smoke_summary =
        if has_wordpress_smokes && !parsed.options.include_wordpress_assets {
            Some(package_wordpress_smoke_assets(&parsed.options)?)
        } else {
            None
        };
    let smoke_result = (|| -> Result<()> {
        let wordpress_smoke_summary = wordpress_smoke_summary.as_ref().unwrap_or(&summary);

        for version in parsed.smoke_php_versions {
            run_packaged_php_smoke(&summary, &version)?;
            println!("smoke: php {version} ok");
        }
        if let Some(smoke) = parsed.smoke_wordpress_server {
            let wordpress_version = resolve_smoke_wordpress_version(
                &wordpress_smoke_summary.asset_root,
                &smoke.wordpress_version,
            )?;
            run_packaged_wordpress_server_smoke(
                wordpress_smoke_summary,
                &smoke.php_version,
                &wordpress_version,
            )?;
            println!(
                "smoke: wordpress server php {} wp {} ok",
                smoke.php_version, wordpress_version
            );
        }
        if let Some(smoke) = parsed.smoke_run_blueprint {
            let wordpress_version = resolve_smoke_wordpress_version(
                &wordpress_smoke_summary.asset_root,
                &smoke.wordpress_version,
            )?;
            run_packaged_run_blueprint_smoke(
                wordpress_smoke_summary,
                &smoke.php_version,
                &wordpress_version,
            )?;
            println!(
                "smoke: run-blueprint php {} wp {} ok",
                smoke.php_version, wordpress_version
            );
        }
        if let Some(smoke) = parsed.smoke_build_snapshot {
            let wordpress_version = resolve_smoke_wordpress_version(
                &wordpress_smoke_summary.asset_root,
                &smoke.wordpress_version,
            )?;
            run_packaged_build_snapshot_smoke(
                wordpress_smoke_summary,
                &smoke.php_version,
                &wordpress_version,
            )?;
            println!(
                "smoke: build-snapshot php {} wp {} ok",
                smoke.php_version, wordpress_version
            );
        }
        Ok(())
    })();

    if let Some(summary) = &wordpress_smoke_summary {
        if let Err(error) = cleanup_wordpress_smoke_assets(summary) {
            eprintln!("warning: failed to clean up temporary WordPress smoke package: {error}");
        }
    }

    smoke_result
}

fn package_wordpress_smoke_assets(options: &PackageOptions) -> Result<PackageSummary> {
    let mut smoke_options = options.clone();
    smoke_options.out_dir = unique_temp_dir("wordpress-smoke-package")?;
    smoke_options.package_name = format!("{}-wordpress-smoke-assets", options.package_name);
    smoke_options.include_wordpress_assets = true;
    smoke_options.precompile_wasmtime = false;
    package_native_cli(&smoke_options)
}

fn unique_temp_dir(name: &str) -> Result<PathBuf> {
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| CliError::new(format!("System clock is before UNIX_EPOCH: {error}")))?
        .as_nanos();
    let dir = env::temp_dir().join(format!("wp-playground-native-{name}-{unique}"));
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

fn cleanup_wordpress_smoke_assets(summary: &PackageSummary) -> Result<()> {
    let out_dir = summary.package_root.parent().ok_or_else(|| {
        CliError::new(format!(
            "Temporary WordPress smoke package has no parent directory: {}",
            summary.package_root.display()
        ))
    })?;
    if out_dir.exists() {
        fs::remove_dir_all(out_dir).map_err(|error| {
            CliError::new(format!(
                "Failed to remove temporary WordPress smoke package directory {}: {error}",
                out_dir.display()
            ))
        })?;
    }
    Ok(())
}

#[derive(Debug)]
struct ParsedArgs {
    options: PackageOptions,
    smoke_php_versions: Vec<String>,
    smoke_wordpress_server: Option<WordPressServerSmoke>,
    smoke_run_blueprint: Option<WordPressServerSmoke>,
    smoke_build_snapshot: Option<WordPressServerSmoke>,
    help: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct WordPressServerSmoke {
    php_version: String,
    wordpress_version: String,
}

fn parse_args(args: Vec<String>) -> Result<ParsedArgs> {
    let mut options = PackageOptions {
        package_name: default_package_name(),
        binary_path: default_release_binary_path(),
        asset_root: asset_root_from_manifest_dir(),
        precompile_wasmtime: true,
        ..PackageOptions::default()
    };
    let mut smoke_php_versions = Vec::new();
    let mut smoke_wordpress_server = None;
    let mut smoke_run_blueprint = None;
    let mut smoke_build_snapshot = None;
    let mut smoke_wordpress_version = DEFAULT_WP_VERSION.to_string();
    let mut index = 0;
    while index < args.len() {
        let arg = &args[index];
        match arg.as_str() {
            "--help" | "-h" => {
                return Ok(ParsedArgs {
                    options,
                    smoke_php_versions,
                    smoke_wordpress_server,
                    smoke_run_blueprint,
                    smoke_build_snapshot,
                    help: true,
                });
            }
            "--binary" => options.binary_path = value(&args, &mut index, "--binary")?.into(),
            "--asset-root" => options.asset_root = value(&args, &mut index, "--asset-root")?.into(),
            "--out-dir" => options.out_dir = value(&args, &mut index, "--out-dir")?.into(),
            "--name" => options.package_name = value(&args, &mut index, "--name")?,
            "--php-version" => {
                options
                    .php_versions
                    .push(php_version_value(&args, &mut index, "--php-version")?)
            }
            "--include-wordpress-assets" => options.include_wordpress_assets = true,
            "--skip-wordpress-assets" => options.include_wordpress_assets = false,
            "--skip-archive" => options.create_archive = false,
            "--precompile-wasmtime" => options.precompile_wasmtime = true,
            "--no-precompile-wasmtime" => options.precompile_wasmtime = false,
            "--smoke-php-version" => {
                smoke_php_versions.push(php_version_value(
                    &args,
                    &mut index,
                    "--smoke-php-version",
                )?);
            }
            "--smoke-wordpress-server" => {
                smoke_wordpress_server = Some(WordPressServerSmoke {
                    php_version: php_version_value(&args, &mut index, "--smoke-wordpress-server")?,
                    wordpress_version: smoke_wordpress_version.clone(),
                });
            }
            "--smoke-run-blueprint" => {
                smoke_run_blueprint = Some(WordPressServerSmoke {
                    php_version: php_version_value(&args, &mut index, "--smoke-run-blueprint")?,
                    wordpress_version: smoke_wordpress_version.clone(),
                });
            }
            "--smoke-build-snapshot" => {
                smoke_build_snapshot = Some(WordPressServerSmoke {
                    php_version: php_version_value(&args, &mut index, "--smoke-build-snapshot")?,
                    wordpress_version: smoke_wordpress_version.clone(),
                });
            }
            "--smoke-wordpress-version" => {
                smoke_wordpress_version = value(&args, &mut index, "--smoke-wordpress-version")?;
                if let Some(smoke) = &mut smoke_wordpress_server {
                    smoke.wordpress_version = smoke_wordpress_version.clone();
                }
                if let Some(smoke) = &mut smoke_run_blueprint {
                    smoke.wordpress_version = smoke_wordpress_version.clone();
                }
                if let Some(smoke) = &mut smoke_build_snapshot {
                    smoke.wordpress_version = smoke_wordpress_version.clone();
                }
            }
            _ if arg.starts_with("--binary=") => {
                options.binary_path = value_after_equals(arg, "--binary=").into();
            }
            _ if arg.starts_with("--asset-root=") => {
                options.asset_root = value_after_equals(arg, "--asset-root=").into();
            }
            _ if arg.starts_with("--out-dir=") => {
                options.out_dir = value_after_equals(arg, "--out-dir=").into();
            }
            _ if arg.starts_with("--name=") => {
                options.package_name = value_after_equals(arg, "--name=");
            }
            _ if arg.starts_with("--php-version=") => {
                options.php_versions.push(php_version_after_equals(
                    arg,
                    "--php-version=",
                    "--php-version",
                )?);
            }
            _ if arg.starts_with("--smoke-php-version=") => {
                smoke_php_versions.push(php_version_after_equals(
                    arg,
                    "--smoke-php-version=",
                    "--smoke-php-version",
                )?);
            }
            _ if arg.starts_with("--smoke-wordpress-server=") => {
                smoke_wordpress_server = Some(WordPressServerSmoke {
                    php_version: php_version_after_equals(
                        arg,
                        "--smoke-wordpress-server=",
                        "--smoke-wordpress-server",
                    )?,
                    wordpress_version: smoke_wordpress_version.clone(),
                });
            }
            _ if arg.starts_with("--smoke-run-blueprint=") => {
                smoke_run_blueprint = Some(WordPressServerSmoke {
                    php_version: php_version_after_equals(
                        arg,
                        "--smoke-run-blueprint=",
                        "--smoke-run-blueprint",
                    )?,
                    wordpress_version: smoke_wordpress_version.clone(),
                });
            }
            _ if arg.starts_with("--smoke-build-snapshot=") => {
                smoke_build_snapshot = Some(WordPressServerSmoke {
                    php_version: php_version_after_equals(
                        arg,
                        "--smoke-build-snapshot=",
                        "--smoke-build-snapshot",
                    )?,
                    wordpress_version: smoke_wordpress_version.clone(),
                });
            }
            _ if arg.starts_with("--smoke-wordpress-version=") => {
                smoke_wordpress_version = value_after_equals(arg, "--smoke-wordpress-version=");
                if let Some(smoke) = &mut smoke_wordpress_server {
                    smoke.wordpress_version = smoke_wordpress_version.clone();
                }
                if let Some(smoke) = &mut smoke_run_blueprint {
                    smoke.wordpress_version = smoke_wordpress_version.clone();
                }
                if let Some(smoke) = &mut smoke_build_snapshot {
                    smoke.wordpress_version = smoke_wordpress_version.clone();
                }
            }
            _ => {
                return Err(unknown_package_option_error(arg));
            }
        }
        index += 1;
    }

    if options.package_name.is_empty() {
        return Err(CliError::new("--name must not be empty"));
    }
    if options.out_dir == PathBuf::new() {
        return Err(CliError::new("--out-dir must not be empty"));
    }
    Ok(ParsedArgs {
        options,
        smoke_php_versions,
        smoke_wordpress_server,
        smoke_run_blueprint,
        smoke_build_snapshot,
        help: false,
    })
}

fn php_version_value(args: &[String], index: &mut usize, flag: &str) -> Result<String> {
    let version = value(args, index, flag)?;
    validate_supported_php_version(&version, flag)?;
    Ok(version)
}

fn php_version_after_equals(arg: &str, prefix: &str, flag: &str) -> Result<String> {
    let version = value_after_equals(arg, prefix);
    validate_supported_php_version(&version, flag)?;
    Ok(version)
}

fn validate_supported_php_version(version: &str, flag: &str) -> Result<()> {
    if SUPPORTED_PHP_VERSIONS.contains(&version) {
        Ok(())
    } else {
        Err(CliError::new(format!(
            "{flag} received unsupported PHP version `{version}`. Supported versions: {}",
            SUPPORTED_PHP_VERSIONS.join(", ")
        )))
    }
}

fn value(args: &[String], index: &mut usize, flag: &str) -> Result<String> {
    *index += 1;
    let value = args.get(*index).cloned().ok_or_else(|| {
        CliError::new(format!(
            "{flag} requires a value. Use `{flag}=<value>` or `{flag} <value>`."
        ))
    })?;
    if value.starts_with("--") {
        return Err(CliError::new(format!(
            "{flag} requires a value, but got option `{value}`. Use `{flag}=<value>` or `{flag} <value>`."
        )));
    }
    Ok(value)
}

fn value_after_equals(arg: &str, prefix: &str) -> String {
    arg.strip_prefix(prefix).unwrap_or_default().to_string()
}

fn print_help() {
    println!(
        concat!(
            "Usage: package-native-cli [options]\n\n",
            "Builds a redistributable wp-playground-native package. By default it includes every supported PHP version, precompiles Wasmtime modules where the target supports it, and omits bundled WordPress release ZIPs.\n\n",
            "Options:\n",
            "  --binary <path>              Release wp-playground-native binary to package\n",
            "  --asset-root <path>          Source asset root, defaults to repository root\n",
            "  --out-dir <path>             Output directory, defaults to target/package\n",
            "  --name <name>                Package directory/archive name\n",
            "  --php-version <version>      Include only this PHP version; repeatable\n",
            "                               Omit to package all supported PHP versions.\n",
            "                               Runtime variants come from the packaged manifest.\n",
            "  --precompile-wasmtime        Generate target-specific Wasmtime .cwasm assets\n",
            "  --no-precompile-wasmtime     Copy wasm assets without target-specific precompile\n",
            "  --include-wordpress-assets   Copy bundled WordPress release ZIPs for offline startup\n",
            "  --skip-wordpress-assets      Do not copy bundled WordPress release ZIPs (default)\n",
            "  --skip-archive               Create package directory only\n",
            "  --smoke-php-version <ver>    Run packaged `php -v` smoke for a version\n",
            "  --smoke-wordpress-server <php>\n",
            "                               Boot packaged WordPress+SQLite server smoke\n",
            "  --smoke-run-blueprint <php>\n",
            "                               Run packaged WordPress+SQLite Blueprint smoke\n",
            "  --smoke-build-snapshot <php>\n",
            "                               Run packaged WordPress+SQLite snapshot smoke\n",
            "  --smoke-wordpress-version <wp>\n",
            "                               WordPress version for WordPress smokes, defaults to latest\n",
            "  -h, --help                   Show this help\n\n",
            "Examples:\n",
            "  package-native-cli --binary target/release/wp-playground-native --out-dir /tmp --name wp-playground-native-local\n",
            "  package-native-cli --php-version=8.5 --no-precompile-wasmtime --smoke-php-version=8.5"
        )
    );
}

fn unknown_package_option_error(arg: &str) -> CliError {
    let option = arg.split_once('=').map(|(option, _)| option).unwrap_or(arg);
    let mut message = format!("Unknown package-native-cli option `{arg}`.");
    if let Some(suggestion) = suggest_package_option(option) {
        message.push_str(&format!(" Did you mean `{suggestion}`?"));
    }
    message.push_str(" Run `package-native-cli --help` for supported options.");
    CliError::new(message)
}

fn suggest_package_option(option: &str) -> Option<&'static str> {
    match option {
        "--php-verison" | "--php" => return Some("--php-version"),
        "--wp-assets" | "--wordpress-assets" => return Some("--include-wordpress-assets"),
        "--no-wordpress-assets" => return Some("--skip-wordpress-assets"),
        "--smoke-wp-version" => return Some("--smoke-wordpress-version"),
        _ => {}
    }
    suggest_name(option, PACKAGE_OPTION_NAMES)
}

fn suggest_name<'a>(input: &str, candidates: &'a [&str]) -> Option<&'a str> {
    let mut best = None;
    let mut best_distance = usize::MAX;
    for candidate in candidates {
        if *candidate == input {
            continue;
        }
        if candidate.starts_with(input) || input.starts_with(*candidate) {
            return Some(candidate);
        }
        let distance = edit_distance(input, candidate);
        if distance < best_distance {
            best = Some(*candidate);
            best_distance = distance;
        }
    }

    let threshold = (input.chars().count() / 3).max(2);
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

fn resolve_smoke_wordpress_version(asset_root: &Path, requested: &str) -> Result<String> {
    if requested != DEFAULT_WP_VERSION {
        return Ok(requested.to_string());
    }

    let dir = asset_root.join(WORDPRESS_BUILDS_DIR);
    let Ok(entries) = fs::read_dir(&dir) else {
        return Ok(requested.to_string());
    };
    let mut versions = entries
        .filter_map(|entry| entry.ok().map(|entry| entry.path()))
        .filter_map(|path| {
            let name = path.file_name()?.to_str()?;
            let version = name.strip_prefix("wp-")?.strip_suffix(".zip")?;
            (version != "beta").then(|| version.to_string())
        })
        .collect::<Vec<_>>();
    versions.sort_by_key(|version| version_sort_key(version));
    Ok(versions.pop().unwrap_or_else(|| requested.to_string()))
}

fn version_sort_key(version: &str) -> Vec<u16> {
    version
        .split('.')
        .map(|part| part.parse::<u16>().unwrap_or(0))
        .collect()
}

#[cfg(test)]
mod tests {
    use std::{
        fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    use super::{parse_args, resolve_smoke_wordpress_version, WORDPRESS_BUILDS_DIR};

    #[test]
    fn parses_build_snapshot_smoke_and_updates_wordpress_version() {
        let parsed = parse_args(vec![
            "--smoke-build-snapshot=8.3".to_string(),
            "--smoke-wordpress-version=6.8".to_string(),
        ])
        .unwrap();
        let smoke = parsed.smoke_build_snapshot.unwrap();
        assert_eq!(smoke.php_version, "8.3");
        assert_eq!(smoke.wordpress_version, "6.8");

        let parsed = parse_args(vec![
            "--smoke-wordpress-version=6.7".to_string(),
            "--smoke-build-snapshot".to_string(),
            "8.4".to_string(),
        ])
        .unwrap();
        let smoke = parsed.smoke_build_snapshot.unwrap();
        assert_eq!(smoke.php_version, "8.4");
        assert_eq!(smoke.wordpress_version, "6.7");
    }

    #[test]
    fn defaults_wordpress_smokes_to_latest() {
        let parsed = parse_args(vec!["--smoke-wordpress-server=8.3".to_string()]).unwrap();
        let smoke = parsed.smoke_wordpress_server.unwrap();
        assert_eq!(smoke.wordpress_version, "latest");
        assert!(!parsed.options.include_wordpress_assets);
    }

    #[test]
    fn parses_repeatable_php_smokes() {
        let parsed = parse_args(vec![
            "--smoke-php-version=8.3".to_string(),
            "--smoke-php-version".to_string(),
            "8.4".to_string(),
        ])
        .unwrap();

        assert_eq!(
            parsed.smoke_php_versions,
            vec!["8.3".to_string(), "8.4".to_string()]
        );
    }

    #[test]
    fn rejects_unsupported_php_package_and_smoke_versions() {
        for args in [
            vec!["--php-version=5.2"],
            vec!["--smoke-php-version=5.2"],
            vec!["--smoke-wordpress-server=5.2"],
            vec!["--smoke-run-blueprint=5.2"],
            vec!["--smoke-build-snapshot=5.2"],
        ] {
            let error = parse_args(args.iter().map(|arg| arg.to_string()).collect())
                .unwrap_err()
                .to_string();

            assert!(error.contains("unsupported PHP version `5.2`"), "{error}");
            assert!(
                error.contains("Supported versions: 7.4, 8.0, 8.1, 8.2, 8.3, 8.4, 8.5"),
                "{error}"
            );
        }
    }

    #[test]
    fn package_option_typos_have_actionable_errors() {
        let error = parse_args(vec!["--php-verison=8.5".to_string()])
            .unwrap_err()
            .to_string();
        assert!(error.contains("Unknown package-native-cli option"));
        assert!(error.contains("Did you mean `--php-version`?"), "{error}");
        assert!(error.contains("package-native-cli --help"), "{error}");

        let error = parse_args(vec!["--binary".to_string(), "--out-dir=/tmp".to_string()])
            .unwrap_err()
            .to_string();
        assert!(error.contains("--binary requires a value"));
        assert!(error.contains("got option `--out-dir=/tmp`"), "{error}");
    }

    #[test]
    fn precompiles_wasmtime_assets_by_default_and_can_disable_it() {
        let parsed = parse_args(Vec::new()).unwrap();
        assert!(parsed.options.precompile_wasmtime);

        let parsed = parse_args(vec!["--no-precompile-wasmtime".to_string()]).unwrap();
        assert!(!parsed.options.precompile_wasmtime);

        let parsed = parse_args(vec![
            "--no-precompile-wasmtime".to_string(),
            "--precompile-wasmtime".to_string(),
        ])
        .unwrap();
        assert!(parsed.options.precompile_wasmtime);
    }

    #[test]
    fn skips_wordpress_release_assets_by_default_and_can_include_them() {
        let parsed = parse_args(Vec::new()).unwrap();
        assert!(!parsed.options.include_wordpress_assets);

        let parsed = parse_args(vec!["--include-wordpress-assets".to_string()]).unwrap();
        assert!(parsed.options.include_wordpress_assets);

        let parsed = parse_args(vec![
            "--include-wordpress-assets".to_string(),
            "--skip-wordpress-assets".to_string(),
        ])
        .unwrap();
        assert!(!parsed.options.include_wordpress_assets);
    }

    #[test]
    fn keeps_wordpress_smokes_from_forcing_wordpress_release_assets() {
        let parsed = parse_args(vec![
            "--skip-wordpress-assets".to_string(),
            "--smoke-wordpress-server=8.3".to_string(),
        ])
        .unwrap();

        assert!(!parsed.options.include_wordpress_assets);
        assert!(parsed.smoke_wordpress_server.is_some());
    }

    #[test]
    fn resolves_latest_smoke_to_newest_packaged_wordpress_zip() {
        let root = temp_dir("latest-wp");
        let wordpress_dir = root.join(WORDPRESS_BUILDS_DIR);
        fs::create_dir_all(&wordpress_dir).unwrap();
        fs::write(wordpress_dir.join("wp-6.9.zip"), b"").unwrap();
        fs::write(wordpress_dir.join("wp-7.0.zip"), b"").unwrap();
        fs::write(wordpress_dir.join("wp-beta.zip"), b"").unwrap();

        let version = resolve_smoke_wordpress_version(&root, "latest").unwrap();
        assert_eq!(version, "7.0");
    }

    #[test]
    fn leaves_latest_smoke_unresolved_without_packaged_wordpress_zips() {
        let root = temp_dir("missing-latest-wp");
        let version = resolve_smoke_wordpress_version(&root, "latest").unwrap();
        assert_eq!(version, "latest");
    }

    fn temp_dir(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("package-native-cli-{name}-{unique}"));
        fs::create_dir_all(&path).unwrap();
        path
    }
}
