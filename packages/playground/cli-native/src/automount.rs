use std::{
    fs,
    path::{Path, PathBuf},
};

use crate::{mount::Mount, paths::WordPressInstallMode, CliError, Result};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BlueprintStep {
    ActivatePlugin { plugin_path: String },
    ActivateTheme { theme_folder_name: String },
    ActivateThemeV2 { theme_directory_name: String },
    ActivateFirstTheme,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AutoMountInput {
    pub path: PathBuf,
    pub mounts: Vec<Mount>,
    pub mounts_before_install: Vec<Mount>,
    pub additional_blueprint_steps: Vec<BlueprintStep>,
    pub experimental_blueprints_v2_runner: bool,
    pub wordpress_install_mode: Option<WordPressInstallMode>,
}

impl AutoMountInput {
    pub fn new(path: impl Into<PathBuf>) -> Self {
        Self {
            path: path.into(),
            mounts: Vec::new(),
            mounts_before_install: Vec::new(),
            additional_blueprint_steps: Vec::new(),
            experimental_blueprints_v2_runner: false,
            wordpress_install_mode: None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AutoMountOutput {
    pub mounts: Vec<Mount>,
    pub mounts_before_install: Vec<Mount>,
    pub additional_blueprint_steps: Vec<BlueprintStep>,
    pub mode: Option<String>,
    pub wordpress_install_mode: Option<WordPressInstallMode>,
}

pub fn expand_auto_mounts(input: AutoMountInput) -> Result<AutoMountOutput> {
    let path = input.path;
    if !path.is_dir() {
        return Err(CliError::new(format!(
            "The specified auto-mount path is not a directory: '{}'.",
            path.display()
        )));
    }

    let mut mounts = input.mounts;
    let mut mounts_before_install = input.mounts_before_install;
    let mut additional_blueprint_steps = input.additional_blueprint_steps;
    let mut mode = None;
    let mut wordpress_install_mode = input.wordpress_install_mode;

    if is_plugin_directory(&path)? {
        let plugin_name = file_name(&path)?;
        mounts.push(Mount::auto(
            path.clone(),
            format!("/wordpress/wp-content/plugins/{plugin_name}"),
        )?);
        additional_blueprint_steps.push(BlueprintStep::ActivatePlugin {
            plugin_path: format!("/wordpress/wp-content/plugins/{plugin_name}"),
        });
    } else if is_theme_directory(&path)? {
        let theme_name = file_name(&path)?;
        mounts.push(Mount::auto(
            path.clone(),
            format!("/wordpress/wp-content/themes/{theme_name}"),
        )?);
        if input.experimental_blueprints_v2_runner {
            additional_blueprint_steps.push(BlueprintStep::ActivateThemeV2 {
                theme_directory_name: theme_name,
            });
        } else {
            additional_blueprint_steps.push(BlueprintStep::ActivateTheme {
                theme_folder_name: theme_name,
            });
        }
    } else if contains_wp_content_directories(&path)? {
        let mut entries = fs::read_dir(&path)?
            .map(|entry| entry.map(|entry| entry.path()))
            .collect::<std::io::Result<Vec<_>>>()?;
        entries.sort();
        for entry in entries {
            let name = file_name(&entry)?;
            if name == "index.php" {
                continue;
            }
            mounts.push(Mount::auto(
                entry.clone(),
                format!("/wordpress/wp-content/{name}"),
            )?);
        }
        additional_blueprint_steps.push(BlueprintStep::ActivateFirstTheme);
    } else if contains_full_wordpress_installation(&path)? {
        mounts_before_install.push(Mount::auto(path.clone(), "/wordpress")?);
        mode = Some("apply-to-existing-site".to_string());
        additional_blueprint_steps.push(BlueprintStep::ActivateFirstTheme);
        if wordpress_install_mode.is_none() {
            wordpress_install_mode = Some(WordPressInstallMode::InstallFromExistingFilesIfNeeded);
        }
    }

    Ok(AutoMountOutput {
        mounts,
        mounts_before_install,
        additional_blueprint_steps,
        mode,
        wordpress_install_mode,
    })
}

pub fn contains_full_wordpress_installation(path: &Path) -> Result<bool> {
    let files = directory_file_names(path)?;
    Ok(files.iter().any(|name| name == "wp-admin")
        && files.iter().any(|name| name == "wp-includes")
        && files.iter().any(|name| name == "wp-content"))
}

pub fn contains_wp_content_directories(path: &Path) -> Result<bool> {
    let files = directory_file_names(path)?;
    Ok(["themes", "plugins", "mu-plugins", "uploads"]
        .iter()
        .any(|expected| files.iter().any(|name| name == expected)))
}

pub fn is_theme_directory(path: &Path) -> Result<bool> {
    let style_css = path.join("style.css");
    if !style_css.is_file() {
        return Ok(false);
    }
    let content = fs::read_to_string(style_css)?;
    Ok(has_header(&content, "Theme Name:"))
}

pub fn is_plugin_directory(path: &Path) -> Result<bool> {
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().and_then(|extension| extension.to_str()) != Some("php") {
            continue;
        }
        if has_header(&fs::read_to_string(path)?, "Plugin Name:") {
            return Ok(true);
        }
    }
    Ok(false)
}

fn directory_file_names(path: &Path) -> Result<Vec<String>> {
    Ok(fs::read_dir(path)?
        .map(|entry| entry.map(|entry| entry.file_name().to_string_lossy().into_owned()))
        .collect::<std::io::Result<Vec<_>>>()?)
}

fn file_name(path: &Path) -> Result<String> {
    path.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .ok_or_else(|| CliError::new(format!("Path has no file name: {}", path.display())))
}

fn has_header(content: &str, header: &str) -> bool {
    let expected = header.to_ascii_lowercase();
    for line in content.lines() {
        let mut candidate = line.trim_start();
        if let Some(rest) = candidate.strip_prefix("<?php") {
            candidate = rest.trim_start();
        }
        candidate = candidate.trim_start_matches([' ', '\t', '/', '*', '#', '@']);
        if candidate.to_ascii_lowercase().starts_with(&expected) {
            return true;
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use std::{
        env, fs,
        path::{Path, PathBuf},
        time::{SystemTime, UNIX_EPOCH},
    };

    use crate::{
        automount::{
            expand_auto_mounts, is_plugin_directory, is_theme_directory, AutoMountInput,
            BlueprintStep,
        },
        paths::WordPressInstallMode,
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

    fn write(path: &Path, content: &str) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, content).unwrap();
    }

    #[test]
    fn detects_plugin_directory() {
        let dir = temp_dir("plugin");
        write(
            &dir.join("sample-plugin.php"),
            "<?php\n/*\nPlugin Name: Sample Plugin\n*/\n",
        );
        assert!(is_plugin_directory(&dir).unwrap());

        let output = expand_auto_mounts(AutoMountInput::new(&dir)).unwrap();
        let plugin_name = dir.file_name().unwrap().to_string_lossy();
        assert_eq!(
            output.mounts[0].vfs_path,
            format!("/wordpress/wp-content/plugins/{plugin_name}")
        );
        assert_eq!(
            output.additional_blueprint_steps,
            vec![BlueprintStep::ActivatePlugin {
                plugin_path: format!("/wordpress/wp-content/plugins/{plugin_name}")
            }]
        );
    }

    #[test]
    fn detects_theme_directory() {
        let dir = temp_dir("theme");
        write(&dir.join("style.css"), "/*\nTheme Name: Sample Theme\n*/");
        assert!(is_theme_directory(&dir).unwrap());

        let output = expand_auto_mounts(AutoMountInput::new(&dir)).unwrap();
        let theme_name = dir.file_name().unwrap().to_string_lossy();
        assert_eq!(
            output.mounts[0].vfs_path,
            format!("/wordpress/wp-content/themes/{theme_name}")
        );
        assert_eq!(
            output.additional_blueprint_steps,
            vec![BlueprintStep::ActivateTheme {
                theme_folder_name: theme_name.to_string()
            }]
        );
    }

    #[test]
    fn detects_wp_content_directory() {
        let dir = temp_dir("wp-content");
        fs::create_dir_all(dir.join("plugins")).unwrap();
        fs::create_dir_all(dir.join("themes")).unwrap();
        write(&dir.join("index.php"), "<?php");

        let output = expand_auto_mounts(AutoMountInput::new(&dir)).unwrap();
        let vfs_paths = output
            .mounts
            .iter()
            .map(|mount| mount.vfs_path.as_str())
            .collect::<Vec<_>>();
        assert_eq!(
            vfs_paths,
            vec![
                "/wordpress/wp-content/plugins",
                "/wordpress/wp-content/themes"
            ]
        );
        assert_eq!(
            output.additional_blueprint_steps,
            vec![BlueprintStep::ActivateFirstTheme]
        );
    }

    #[test]
    fn detects_full_wordpress_directory() {
        let dir = temp_dir("wordpress");
        fs::create_dir_all(dir.join("wp-admin")).unwrap();
        fs::create_dir_all(dir.join("wp-includes")).unwrap();
        fs::create_dir_all(dir.join("wp-content")).unwrap();

        let output = expand_auto_mounts(AutoMountInput::new(&dir)).unwrap();
        assert_eq!(output.mounts_before_install[0].vfs_path, "/wordpress");
        assert_eq!(output.mode.as_deref(), Some("apply-to-existing-site"));
        assert_eq!(
            output.wordpress_install_mode,
            Some(WordPressInstallMode::InstallFromExistingFilesIfNeeded)
        );
    }

    #[test]
    fn leaves_unrecognized_directory_unmounted() {
        let dir = temp_dir("static-html");
        write(&dir.join("index.html"), "<h1>Hello</h1>");

        let output = expand_auto_mounts(AutoMountInput::new(&dir)).unwrap();
        assert!(output.mounts.is_empty());
        assert!(output.mounts_before_install.is_empty());
        assert!(output.additional_blueprint_steps.is_empty());
    }
}
