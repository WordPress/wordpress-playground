use crate::{CliError, Result};

pub fn normalize_vfs_path(input: &str) -> Result<String> {
    if input.trim().is_empty() {
        return Err(CliError::new("VFS path cannot be empty"));
    }
    if input.contains('\0') {
        return Err(CliError::new("VFS path cannot contain NUL bytes"));
    }

    let path = input.replace('\\', "/");
    let mut parts = Vec::new();
    for part in path.split('/') {
        match part {
            "" | "." => {}
            ".." => {
                if parts.pop().is_none() {
                    return Err(CliError::new(format!(
                        "VFS path cannot escape root: {input}"
                    )));
                }
            }
            _ => parts.push(part),
        }
    }

    if parts.is_empty() {
        return Ok("/".to_string());
    }
    Ok(format!("/{}", parts.join("/")))
}

#[cfg(test)]
mod tests {
    use super::normalize_vfs_path;

    #[test]
    fn normalizes_common_forms() {
        assert_eq!(
            normalize_vfs_path("wordpress\\wp-content//plugins/./foo").unwrap(),
            "/wordpress/wp-content/plugins/foo"
        );
        assert_eq!(normalize_vfs_path("/wordpress/../tmp").unwrap(), "/tmp");
    }

    #[test]
    fn rejects_escape_above_root() {
        let error = normalize_vfs_path("../etc").unwrap_err();
        assert!(error.message().contains("escape root"));
    }
}
