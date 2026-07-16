//! Platform-neutral files staged under `/internal/shared` for PHP runtimes.

use std::{
    collections::BTreeMap,
    sync::{Arc, OnceLock},
};

pub const PHP_INTERNAL_VFS_DIR: &str = "/internal";
pub const PHP_SHARED_VFS_DIR: &str = "/internal/shared";
pub const PHP_PRELOAD_VFS_DIR: &str = "/internal/shared/preload";
pub const PHP_MU_PLUGINS_VFS_DIR: &str = "/internal/shared/mu-plugins";
pub const PHP_RUNTIME_VFS_DIRECTORIES: &[&str] = &[
    PHP_INTERNAL_VFS_DIR,
    PHP_SHARED_VFS_DIR,
    PHP_PRELOAD_VFS_DIR,
    PHP_MU_PLUGINS_VFS_DIR,
];
pub const PHP_INI_VFS_PATH: &str = "/internal/shared/php.ini";
pub const PHP_CONSTANTS_VFS_PATH: &str = "/internal/shared/consts.json";
pub const PHP_AUTO_PREPEND_VFS_PATH: &str = "/internal/shared/auto_prepend_file.php";
pub const PHP_PRELOAD_ENV_VFS_PATH: &str = "/internal/shared/preload/env.php";
pub const PHP_PLAYGROUND_MU_PLUGIN_VFS_PATH: &str = "/internal/shared/mu-plugins/0-playground.php";
pub const PHP_AUTO_LOGIN_MU_PLUGIN_VFS_PATH: &str = "/internal/shared/mu-plugins/1-auto-login.php";

pub(crate) const EXPERIMENTAL_PHP_INI_APPEND_ENV_VAR: &str =
    "WP_PLAYGROUND_NATIVE_EXPERIMENTAL_PHP_INI_APPEND";
const DEFAULT_PHP_INI_BASE: &str = concat!(
    "memory_limit=256M\n",
    "error_reporting=E_ALL\n",
    "display_errors=1\n",
    "log_errors=1\n",
    "implicit_flush=1\n",
    "output_buffering=0\n",
    "max_execution_time=0\n",
    "max_input_time=-1\n",
    "opcache.enable=1\n",
    "opcache.memory_consumption=32\n",
    "opcache.interned_strings_buffer=4\n",
    "opcache.max_accelerated_files=8192\n",
    "opcache.validate_timestamps=1\n",
    "opcache.revalidate_freq=0\n",
    "auto_prepend_file=/internal/shared/auto_prepend_file.php\n",
);
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PhpConstantValue {
    String(String),
    Bool(bool),
    Number(String),
    Null,
}

impl PhpConstantValue {
    pub fn string(value: impl Into<String>) -> Self {
        Self::String(value.into())
    }

    pub fn bool(value: bool) -> Self {
        Self::Bool(value)
    }

    pub fn number(value: impl Into<String>) -> Self {
        Self::Number(value.into())
    }

    pub fn null() -> Self {
        Self::Null
    }
}

#[derive(Debug, Clone, Copy, Default)]
pub struct PhpIniOptions<'a> {
    pub entries: &'a [String],
}

/// Builds the default php.ini bytes shared by every native backend.
pub fn default_php_ini(options: PhpIniOptions<'_>) -> Vec<u8> {
    let mut ini = String::from(DEFAULT_PHP_INI_BASE);
    for entry in options.entries {
        ini.push_str(entry);
        if !entry.ends_with('\n') {
            ini.push('\n');
        }
    }
    append_experimental_php_ini(&mut ini);
    ini.into_bytes()
}

/// Encodes PHP constants for the shared auto-prepend script.
pub fn constants_json(constants: &[(String, PhpConstantValue)]) -> Vec<u8> {
    let mut json = serde_json::Map::new();
    for (key, value) in constants {
        let value = match value {
            PhpConstantValue::String(value) => serde_json::Value::String(value.clone()),
            PhpConstantValue::Bool(value) => serde_json::Value::Bool(*value),
            PhpConstantValue::Number(value) => value
                .parse::<f64>()
                .ok()
                .and_then(serde_json::Number::from_f64)
                .map(serde_json::Value::Number)
                .unwrap_or(serde_json::Value::Null),
            PhpConstantValue::Null => serde_json::Value::Null,
        };
        json.insert(key.clone(), value);
    }
    serde_json::to_vec(&json).unwrap_or_else(|_| b"{}".to_vec())
}

/// Returns immutable shared files with cheap `Arc` cloning across workers.
pub fn shared_php_runtime_files() -> &'static BTreeMap<String, Arc<[u8]>> {
    static SHARED_FILES: OnceLock<BTreeMap<String, Arc<[u8]>>> = OnceLock::new();
    SHARED_FILES.get_or_init(|| {
        BTreeMap::from([
            (
                PHP_AUTO_PREPEND_VFS_PATH.to_string(),
                Arc::from(AUTO_PREPEND_FILE),
            ),
            (
                PHP_PRELOAD_ENV_VFS_PATH.to_string(),
                Arc::from(PRELOAD_ENV_FILE),
            ),
            (
                PHP_PLAYGROUND_MU_PLUGIN_VFS_PATH.to_string(),
                Arc::from(PLAYGROUND_MU_PLUGIN),
            ),
            (
                PHP_AUTO_LOGIN_MU_PLUGIN_VFS_PATH.to_string(),
                Arc::from(AUTO_LOGIN_MU_PLUGIN),
            ),
        ])
    })
}

/// Looks up one immutable runtime file by its absolute VFS path.
pub fn shared_php_runtime_file(path: &str) -> Option<&'static [u8]> {
    shared_php_runtime_files().get(path).map(AsRef::as_ref)
}

/// Builds a deterministic file map ready to stage at the listed absolute paths.
pub fn materialize_php_runtime_files(
    ini_options: PhpIniOptions<'_>,
    constants: &[(String, PhpConstantValue)],
) -> BTreeMap<String, Arc<[u8]>> {
    let mut files = shared_php_runtime_files().clone();
    files.insert(
        PHP_INI_VFS_PATH.to_string(),
        default_php_ini(ini_options).into(),
    );
    files.insert(
        PHP_CONSTANTS_VFS_PATH.to_string(),
        constants_json(constants).into(),
    );
    files
}

fn append_experimental_php_ini(ini: &mut String) {
    let Ok(extra_ini) = std::env::var(EXPERIMENTAL_PHP_INI_APPEND_ENV_VAR) else {
        return;
    };
    let extra_ini = extra_ini.trim();
    if extra_ini.is_empty() {
        return;
    }
    if !ini.ends_with('\n') {
        ini.push('\n');
    }
    ini.push_str(extra_ini);
    if !ini.ends_with('\n') {
        ini.push('\n');
    }
}

const AUTO_PREPEND_FILE: &[u8] = br#"<?php
if (file_exists('/internal/shared/consts.json')) {
    $consts = json_decode(file_get_contents('/internal/shared/consts.json'), true);
    if (is_array($consts)) {
        foreach ($consts as $const => $value) {
            if (!defined($const) && is_scalar($value)) {
                define($const, $value);
            }
        }
    }
}
if (!defined('DISABLE_WP_CRON')) {
    define('DISABLE_WP_CRON', true);
}
if (!defined('AUTOMATIC_UPDATER_DISABLED')) {
    define('AUTOMATIC_UPDATER_DISABLED', true);
}
if (!defined('WP_AUTO_UPDATE_CORE')) {
    define('WP_AUTO_UPDATE_CORE', false);
}
if (file_exists('/internal/shared/preload/env.php')) {
    require_once '/internal/shared/preload/env.php';
}
ob_start();
"#;

const PRELOAD_ENV_FILE: &[u8] = br#"<?php
function playground_add_filter($tag, $function_to_add, $priority = 10, $accepted_args = 1) {
    global $wp_filter;
    $wp_filter[$tag][$priority][$function_to_add] = array('function' => $function_to_add, 'accepted_args' => $accepted_args);
}
function playground_add_action($tag, $function_to_add, $priority = 10, $accepted_args = 1) {
    playground_add_filter($tag, $function_to_add, $priority, $accepted_args);
}
playground_add_action('muplugins_loaded', 'playground_load_mu_plugins', 0);
function playground_load_mu_plugins() {
    $mu_plugins_dir = '/internal/shared/mu-plugins';
    if (!is_dir($mu_plugins_dir)) {
        return;
    }
    $mu_plugins = glob($mu_plugins_dir . '/*.php');
    if (!is_array($mu_plugins)) {
        return;
    }
    sort($mu_plugins);
    foreach ($mu_plugins as $mu_plugin) {
        require_once $mu_plugin;
    }
}
"#;

const AUTO_LOGIN_MU_PLUGIN: &[u8] = br#"<?php
function playground_get_username_for_auto_login() {
    if (defined('PLAYGROUND_AUTO_LOGIN_AS_USER') && !isset($_COOKIE['playground_auto_login_already_happened'])) {
        return PLAYGROUND_AUTO_LOGIN_AS_USER;
    }
    if (defined('PLAYGROUND_FORCE_AUTO_LOGIN_ENABLED') && isset($_GET['playground_force_auto_login_as_user'])) {
        return $_GET['playground_force_auto_login_as_user'];
    }
    return false;
}

function playground_auto_login() {
    if (empty($_SERVER['REQUEST_URI'])) {
        return;
    }
    $user_name = playground_get_username_for_auto_login();
    if (false === $user_name) {
        return;
    }
    if (wp_doing_ajax() || defined('REST_REQUEST') || is_user_logged_in()) {
        return;
    }
    $user = get_user_by('login', $user_name);
    if (!$user || headers_sent()) {
        return;
    }
    wp_set_current_user($user->ID, $user->user_login);
    wp_set_auth_cookie($user->ID);
    do_action('wp_login', $user->user_login, $user);
    setcookie('playground_auto_login_already_happened', '1');
    if (headers_sent()) {
        return;
    }
    header('Location: ' . $_SERVER['REQUEST_URI'], true, 302);
    exit;
}
add_action('init', 'playground_auto_login', 1);

function playground_auto_login_redirect_target() {
    if (isset($_SERVER['REQUEST_URI']) && strpos($_SERVER['REQUEST_URI'], '?playground-redirection-handler') !== false) {
        $next = isset($_GET['next']) ? $_GET['next'] : '/';
        header('Location: ' . $next, true, 302);
        exit;
    }
}
add_action('init', 'playground_auto_login_redirect_target', 1);

add_filter('admin_email_check_interval', function($interval) {
    if (false === playground_get_username_for_auto_login()) {
        return 0;
    }
    return $interval;
});
"#;

const PLAYGROUND_MU_PLUGIN: &[u8] = br#"<?php
if (!defined('DISABLE_WP_CRON')) {
    define('DISABLE_WP_CRON', true);
}
if (isset($_SERVER['PHP_SELF']) && substr($_SERVER['PHP_SELF'], -12) === '/wp-cron.php') {
    http_response_code(503);
    header('Content-Type: text/plain');
    echo 'WP Cron is disabled in wp-playground-native.';
    exit;
}
add_filter('automatic_updater_disabled', '__return_true');
add_filter('auto_update_core', '__return_false');
add_filter('auto_update_plugin', '__return_false');
add_filter('auto_update_theme', '__return_false');
"#;

#[cfg(test)]
mod tests {
    use super::{
        constants_json, default_php_ini, materialize_php_runtime_files, shared_php_runtime_file,
        shared_php_runtime_files, PhpConstantValue, PhpIniOptions, PHP_AUTO_PREPEND_VFS_PATH,
        PHP_CONSTANTS_VFS_PATH, PHP_INI_VFS_PATH, PHP_PRELOAD_ENV_VFS_PATH,
        PHP_RUNTIME_VFS_DIRECTORIES, PHP_SHARED_VFS_DIR,
    };

    #[test]
    fn materialized_files_are_ready_for_internal_shared_staging() {
        let constants = vec![
            (
                "WP_HOME".to_string(),
                PhpConstantValue::string("https://example.test"),
            ),
            ("WP_DEBUG".to_string(), PhpConstantValue::bool(true)),
        ];
        let files = materialize_php_runtime_files(PhpIniOptions::default(), &constants);

        assert_eq!(files.len(), 6);
        assert_eq!(
            PHP_RUNTIME_VFS_DIRECTORIES,
            &[
                "/internal",
                "/internal/shared",
                "/internal/shared/preload",
                "/internal/shared/mu-plugins"
            ]
        );
        assert!(files
            .keys()
            .all(|path| path.starts_with(PHP_SHARED_VFS_DIR)));
        assert!(files.contains_key(PHP_INI_VFS_PATH));
        assert!(files.contains_key(PHP_CONSTANTS_VFS_PATH));
        assert!(files.contains_key(PHP_PRELOAD_ENV_VFS_PATH));
        assert!(files[PHP_AUTO_PREPEND_VFS_PATH]
            .windows(b"ob_start();".len())
            .any(|bytes| bytes == b"ob_start();"));

        assert_eq!(
            shared_php_runtime_file(PHP_AUTO_PREPEND_VFS_PATH),
            Some(files[PHP_AUTO_PREPEND_VFS_PATH].as_ref())
        );
        assert_eq!(shared_php_runtime_files().len(), 4);
    }

    #[test]
    fn default_ini_preserves_custom_entries_and_enables_persistent_opcache() {
        let entries = vec!["output_buffering=4096".to_string()];
        let ini = String::from_utf8(default_php_ini(PhpIniOptions { entries: &entries })).unwrap();

        assert!(ini.contains("auto_prepend_file=/internal/shared/auto_prepend_file.php"));
        assert!(ini.contains("opcache.enable=1\n"));
        assert!(ini.contains("opcache.memory_consumption=32\n"));
        assert!(ini.contains("opcache.validate_timestamps=1\n"));
        assert!(!ini.contains("opcache.file_update_protection="));
        assert!(ini.ends_with("output_buffering=4096\n"));
    }

    #[test]
    fn constants_json_keeps_scalars_and_nulls_invalid_numbers() {
        let json = constants_json(&[
            ("TEXT".to_string(), PhpConstantValue::string("value")),
            ("FLAG".to_string(), PhpConstantValue::bool(false)),
            ("COUNT".to_string(), PhpConstantValue::number("42.5")),
            ("INVALID".to_string(), PhpConstantValue::number("nope")),
        ]);
        let json: serde_json::Value = serde_json::from_slice(&json).unwrap();

        assert_eq!(json["TEXT"], "value");
        assert_eq!(json["FLAG"], false);
        assert_eq!(json["COUNT"], 42.5);
        assert!(json["INVALID"].is_null());
    }
}
