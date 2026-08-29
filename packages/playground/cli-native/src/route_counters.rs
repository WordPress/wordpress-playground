use std::{
    sync::atomic::{AtomicU64, AtomicU8, Ordering},
    time::Duration,
};

pub const ROUTE_COUNTERS_ENV_VAR: &str = "WP_PLAYGROUND_NATIVE_ROUTE_COUNTERS";

const ENABLED_UNKNOWN: u8 = 0;
const ENABLED_FALSE: u8 = 1;
const ENABLED_TRUE: u8 = 2;

static ENABLED_STATE: AtomicU8 = AtomicU8::new(ENABLED_UNKNOWN);
static NEXT_REQUEST_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RequestId(u64);

impl RequestId {
    pub fn get(self) -> u64 {
        self.0
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Field {
    key: &'static str,
    value: String,
}

impl Field {
    pub fn new(key: &'static str, value: impl ToString) -> Self {
        Self {
            key,
            value: value.to_string(),
        }
    }
}

pub fn enabled() -> bool {
    match ENABLED_STATE.load(Ordering::Relaxed) {
        ENABLED_FALSE => false,
        ENABLED_TRUE => true,
        _ => initialize_enabled(),
    }
}

fn initialize_enabled() -> bool {
    let enabled = read_enabled_env();
    let initialized_state = if enabled { ENABLED_TRUE } else { ENABLED_FALSE };
    match ENABLED_STATE.compare_exchange(
        ENABLED_UNKNOWN,
        initialized_state,
        Ordering::Relaxed,
        Ordering::Relaxed,
    ) {
        Ok(_) => enabled,
        Err(ENABLED_FALSE) => false,
        Err(ENABLED_TRUE) => true,
        Err(_) => enabled,
    }
}

fn read_enabled_env() -> bool {
    std::env::var(ROUTE_COUNTERS_ENV_VAR)
        .map(|value| {
            matches!(
                value.to_ascii_lowercase().as_str(),
                "1" | "true" | "yes" | "on"
            )
        })
        .unwrap_or(false)
}

#[cfg(test)]
fn reset_enabled_cache_for_test() {
    ENABLED_STATE.store(ENABLED_UNKNOWN, Ordering::Relaxed);
}

pub fn next_request_id() -> Option<RequestId> {
    enabled().then(|| RequestId(NEXT_REQUEST_ID.fetch_add(1, Ordering::Relaxed)))
}

#[cfg(test)]
pub(crate) fn request_id_for_test(value: u64) -> RequestId {
    RequestId(value)
}

pub fn request_fields(request_id: RequestId, method: &str, target: &str) -> Vec<Field> {
    vec![
        Field::new("request_id", request_id.get()),
        Field::new("method", method),
        Field::new("target", target),
        Field::new("route_label", route_label(target)),
    ]
}

pub fn route_label(target: &str) -> &'static str {
    match target {
        "/" => "home",
        "/?s=hello" => "search",
        "/?p=1" => "post",
        "/wp-admin/post-new.php" => "editor",
        _ => "other",
    }
}

pub fn emit(row: &str, fields: &[Field]) {
    if enabled() {
        eprintln!("{}", format_row(row, fields));
    }
}

pub fn format_row(row: &str, fields: &[Field]) -> String {
    let mut output = "route-counter".to_string();
    output.push('\t');
    output.push_str("row=");
    output.push_str(&escape_value(row));
    for field in fields {
        output.push('\t');
        output.push_str(field.key);
        output.push('=');
        output.push_str(&escape_value(&field.value));
    }
    output
}

pub fn elapsed_us(duration: Duration) -> u128 {
    duration.as_micros()
}

fn escape_value(value: &str) -> String {
    let mut output = String::with_capacity(value.len());
    for character in value.chars() {
        match character {
            '\\' => output.push_str("\\\\"),
            '\t' => output.push_str("\\t"),
            '\r' => output.push_str("\\r"),
            '\n' => output.push_str("\\n"),
            _ => output.push(character),
        }
    }
    output
}

#[cfg(test)]
mod tests {
    use std::{ffi::OsString, sync::Mutex, time::Duration};

    use super::{
        enabled, format_row, next_request_id, request_fields, route_label, Field,
        ROUTE_COUNTERS_ENV_VAR,
    };

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    struct EnvVarGuard {
        name: &'static str,
        previous: Option<OsString>,
    }

    impl EnvVarGuard {
        fn set(name: &'static str, value: &str) -> Self {
            let previous = std::env::var_os(name);
            std::env::set_var(name, value);
            super::reset_enabled_cache_for_test();
            Self { name, previous }
        }

        fn unset(name: &'static str) -> Self {
            let previous = std::env::var_os(name);
            std::env::remove_var(name);
            super::reset_enabled_cache_for_test();
            Self { name, previous }
        }
    }

    impl Drop for EnvVarGuard {
        fn drop(&mut self) {
            if let Some(value) = self.previous.take() {
                std::env::set_var(self.name, value);
            } else {
                std::env::remove_var(self.name);
            }
            super::reset_enabled_cache_for_test();
        }
    }

    #[test]
    fn route_counters_are_disabled_by_default() {
        let _lock = ENV_LOCK.lock().unwrap();
        let _guard = EnvVarGuard::unset(ROUTE_COUNTERS_ENV_VAR);

        assert!(!enabled());
    }

    #[test]
    fn route_counters_accept_truthy_env_values() {
        let _lock = ENV_LOCK.lock().unwrap();
        for value in ["1", "true", "TRUE", "yes", "YES", "on", "ON"] {
            let _guard = EnvVarGuard::set(ROUTE_COUNTERS_ENV_VAR, value);
            assert!(enabled());
        }
    }

    #[test]
    fn route_counters_reject_falsy_env_values() {
        let _lock = ENV_LOCK.lock().unwrap();
        for value in ["", "0", "false", "FALSE", "no", "NO", "off", "OFF"] {
            let _guard = EnvVarGuard::set(ROUTE_COUNTERS_ENV_VAR, value);
            assert!(!enabled());
        }
    }

    #[test]
    fn route_counter_enabled_state_is_cached_until_reset() {
        let _lock = ENV_LOCK.lock().unwrap();
        let _guard = EnvVarGuard::unset(ROUTE_COUNTERS_ENV_VAR);

        assert!(!enabled());

        std::env::set_var(ROUTE_COUNTERS_ENV_VAR, "1");
        assert!(!enabled());

        super::reset_enabled_cache_for_test();
        assert!(enabled());
    }

    #[test]
    fn request_ids_are_only_allocated_when_route_counters_are_enabled() {
        let _lock = ENV_LOCK.lock().unwrap();
        {
            let _guard = EnvVarGuard::unset(ROUTE_COUNTERS_ENV_VAR);
            assert_eq!(next_request_id(), None);
        }

        let _guard = EnvVarGuard::set(ROUTE_COUNTERS_ENV_VAR, "1");
        let first = next_request_id().unwrap();
        let second = next_request_id().unwrap();

        assert!(first.get() >= 1);
        assert_eq!(second.get(), first.get() + 1);
    }

    #[test]
    fn route_counter_rows_are_tsv_with_escaped_values() {
        let row = format_row(
            "request.total.boundary",
            &[
                Field::new("request_id", 7),
                Field::new("target", "/wp-admin/post-new.php?a=\t\n\\"),
                Field::new("elapsed_us", super::elapsed_us(Duration::from_micros(42))),
            ],
        );

        assert_eq!(
            row,
            "route-counter\trow=request.total.boundary\trequest_id=7\ttarget=/wp-admin/post-new.php?a=\\t\\n\\\\\telapsed_us=42"
        );
    }

    #[test]
    fn request_fields_have_stable_schema_and_route_label() {
        let fields = request_fields(super::RequestId(11), "HEAD", "/?p=1");

        let entries = fields
            .iter()
            .map(|field| (field.key, field.value.as_str()))
            .collect::<Vec<_>>();

        assert_eq!(
            entries,
            vec![
                ("request_id", "11"),
                ("method", "HEAD"),
                ("target", "/?p=1"),
                ("route_label", "post"),
            ]
        );
        assert_eq!(
            format_row("http.parse_owned", &fields),
            "route-counter\trow=http.parse_owned\trequest_id=11\tmethod=HEAD\ttarget=/?p=1\troute_label=post"
        );
    }

    #[test]
    fn route_labels_match_benchmark_wordpress_routes() {
        assert_eq!(route_label("/"), "home");
        assert_eq!(route_label("/?s=hello"), "search");
        assert_eq!(route_label("/?p=1"), "post");
        assert_eq!(route_label("/wp-admin/post-new.php"), "editor");
        assert_eq!(route_label("/wp-admin/"), "other");
    }
}
