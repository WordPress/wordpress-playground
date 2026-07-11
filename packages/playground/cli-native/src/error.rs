use std::{
    fmt::{Display, Formatter},
    io,
};

pub type Result<T> = std::result::Result<T, CliError>;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CliError {
    message: String,
    io_kind: Option<io::ErrorKind>,
}

impl CliError {
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            io_kind: None,
        }
    }

    pub fn from_io_context(message: impl Into<String>, error: io::Error) -> Self {
        Self {
            message: format!("{}: {error}", message.into()),
            io_kind: Some(error.kind()),
        }
    }

    pub fn message(&self) -> &str {
        &self.message
    }

    pub fn io_kind(&self) -> Option<io::ErrorKind> {
        self.io_kind
    }
}

impl Display for CliError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl std::error::Error for CliError {}

impl From<std::io::Error> for CliError {
    fn from(error: std::io::Error) -> Self {
        Self {
            message: error.to_string(),
            io_kind: Some(error.kind()),
        }
    }
}
