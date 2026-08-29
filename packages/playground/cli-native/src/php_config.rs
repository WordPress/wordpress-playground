use std::sync::Arc;

use crate::{assets::PhpComponentVariant, mount::Mount, php_runtime_files::PhpConstantValue};

/// Host-only selector consumed while the PHP component registers its bundled
/// optional extensions. Caller-provided request and CLI environments may not
/// set this key.
pub(crate) const PHP_EXTENSIONS_ENV_NAME: &str = "WP_PLAYGROUND_PHP_EXTENSIONS";
const XDEBUG_PHP_INI_DEFAULTS: &[&str] = &[
    "xdebug.mode=debug,develop",
    "xdebug.start_with_request=yes",
    "xdebug.idekey=PHPWASMCLI",
    "xdebug.client_host=127.0.0.1",
    "xdebug.client_port=9003",
];

/// Optional PHP modules selected for a worker.
///
/// These switches are deliberately explicit and default to disabled. The
/// component backend decides how a selected module is activated; callers do
/// not pass module paths or other dynamic loading instructions across this
/// boundary.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct PhpExtensionSelection {
    pub redis: bool,
    pub memcached: bool,
    pub xdebug: bool,
}

impl PhpExtensionSelection {
    pub(crate) fn component_variant(self) -> PhpComponentVariant {
        if self.redis || self.memcached || self.xdebug {
            PhpComponentVariant::Extended
        } else {
            PhpComponentVariant::Base
        }
    }

    pub(crate) fn append_php_ini_defaults(self, entries: &mut Vec<String>) {
        if self.xdebug {
            entries.extend(
                XDEBUG_PHP_INI_DEFAULTS
                    .iter()
                    .map(|entry| (*entry).to_string()),
            );
        }
    }

    /// Canonical value injected into the component's initial WASI environment.
    ///
    /// A fixed match keeps the representation deterministic and ensures only
    /// known extension names can cross this host-controlled boundary.
    pub(crate) fn as_host_environment_value(self) -> &'static str {
        match (self.redis, self.memcached, self.xdebug) {
            (false, false, false) => "",
            (true, false, false) => "redis",
            (false, true, false) => "memcached",
            (false, false, true) => "xdebug",
            (true, true, false) => "redis,memcached",
            (true, false, true) => "redis,xdebug",
            (false, true, true) => "memcached,xdebug",
            (true, true, true) => "redis,memcached,xdebug",
        }
    }
}

/// Configuration shared by every PHP component worker.
///
/// This deliberately contains only settings the component backend consumes.
/// Server routing, symlink policy, diagnostics, subprocesses, dynamic
/// extensions, and legacy runtime glue belong outside the worker boundary.
#[derive(Debug, Clone, Default)]
pub struct PhpWorkerOptions {
    pub mounts: Vec<Mount>,
    pub constants: Vec<(String, PhpConstantValue)>,
    pub php_ini_entries: Vec<String>,
    pub env_entries: Vec<(String, String)>,
    pub internal_files: Vec<(String, Arc<[u8]>)>,
    pub extensions: PhpExtensionSelection,
}

#[cfg(test)]
mod tests {
    use super::{PhpExtensionSelection, PhpWorkerOptions};
    use crate::assets::PhpComponentVariant;

    #[test]
    fn extension_environment_value_is_canonical_and_defaults_empty() {
        let cases = [
            (PhpExtensionSelection::default(), ""),
            (
                PhpExtensionSelection {
                    redis: true,
                    ..Default::default()
                },
                "redis",
            ),
            (
                PhpExtensionSelection {
                    memcached: true,
                    ..Default::default()
                },
                "memcached",
            ),
            (
                PhpExtensionSelection {
                    xdebug: true,
                    ..Default::default()
                },
                "xdebug",
            ),
            (
                PhpExtensionSelection {
                    redis: true,
                    memcached: true,
                    xdebug: true,
                },
                "redis,memcached,xdebug",
            ),
        ];

        for (selection, expected) in cases {
            assert_eq!(selection.as_host_environment_value(), expected);
        }
    }

    #[test]
    fn worker_option_clone_and_selection_copy_preserve_extensions() {
        let mut options = PhpWorkerOptions {
            extensions: PhpExtensionSelection {
                redis: true,
                memcached: false,
                xdebug: true,
            },
            ..Default::default()
        };
        options
            .extensions
            .append_php_ini_defaults(&mut options.php_ini_entries);
        let copied = options.extensions;
        let cloned = options.clone();

        assert_eq!(copied, options.extensions);
        assert_eq!(cloned.extensions, options.extensions);
        assert_eq!(cloned.php_ini_entries, options.php_ini_entries);
        assert_eq!(cloned.php_ini_entries.len(), 5);
        assert_eq!(copied.as_host_environment_value(), "redis,xdebug");
    }

    #[test]
    fn every_enabled_extension_selects_the_extended_component() {
        let cases = [
            (PhpExtensionSelection::default(), PhpComponentVariant::Base),
            (
                PhpExtensionSelection {
                    redis: true,
                    ..Default::default()
                },
                PhpComponentVariant::Extended,
            ),
            (
                PhpExtensionSelection {
                    memcached: true,
                    ..Default::default()
                },
                PhpComponentVariant::Extended,
            ),
            (
                PhpExtensionSelection {
                    xdebug: true,
                    ..Default::default()
                },
                PhpComponentVariant::Extended,
            ),
            (
                PhpExtensionSelection {
                    redis: true,
                    memcached: true,
                    xdebug: true,
                },
                PhpComponentVariant::Extended,
            ),
        ];

        for (selection, expected) in cases {
            assert_eq!(selection.component_variant(), expected);
        }
    }

    #[test]
    fn xdebug_php_ini_defaults_are_appended_only_when_selected() {
        let mut disabled = vec!["memory_limit=256M".to_string()];
        PhpExtensionSelection::default().append_php_ini_defaults(&mut disabled);
        assert_eq!(disabled, vec!["memory_limit=256M"]);

        let mut enabled = vec!["memory_limit=256M".to_string()];
        PhpExtensionSelection {
            xdebug: true,
            ..Default::default()
        }
        .append_php_ini_defaults(&mut enabled);
        assert_eq!(
            enabled,
            vec![
                "memory_limit=256M",
                "xdebug.mode=debug,develop",
                "xdebug.start_with_request=yes",
                "xdebug.idekey=PHPWASMCLI",
                "xdebug.client_host=127.0.0.1",
                "xdebug.client_port=9003",
            ]
        );
    }
}
