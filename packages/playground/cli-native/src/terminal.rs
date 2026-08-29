use std::{
    env,
    io::{self, IsTerminal},
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TerminalStyle {
    color: bool,
}

impl TerminalStyle {
    pub fn stdout() -> Self {
        Self::for_terminal(io::stdout().is_terminal())
    }

    pub fn stderr() -> Self {
        Self::for_terminal(io::stderr().is_terminal())
    }

    pub fn plain() -> Self {
        Self { color: false }
    }

    pub fn color() -> Self {
        Self { color: true }
    }

    pub fn for_terminal(is_terminal: bool) -> Self {
        Self {
            color: should_color(is_terminal),
        }
    }

    pub fn enabled(self) -> bool {
        self.color
    }

    pub fn bold(self, text: impl AsRef<str>) -> String {
        self.wrap("1", text)
    }

    pub fn dim(self, text: impl AsRef<str>) -> String {
        self.wrap("2", text)
    }

    pub fn red(self, text: impl AsRef<str>) -> String {
        self.wrap("31", text)
    }

    pub fn green(self, text: impl AsRef<str>) -> String {
        self.wrap("32", text)
    }

    pub fn yellow(self, text: impl AsRef<str>) -> String {
        self.wrap("33", text)
    }

    pub fn cyan(self, text: impl AsRef<str>) -> String {
        self.wrap("36", text)
    }

    pub fn bold_cyan(self, text: impl AsRef<str>) -> String {
        self.wrap("1;36", text)
    }

    pub fn bold_yellow(self, text: impl AsRef<str>) -> String {
        self.wrap("1;33", text)
    }

    fn wrap(self, code: &str, text: impl AsRef<str>) -> String {
        let text = text.as_ref();
        if self.color {
            format!("\x1b[{code}m{text}\x1b[0m")
        } else {
            text.to_string()
        }
    }
}

fn should_color(is_terminal: bool) -> bool {
    if env::var("FORCE_COLOR").is_ok_and(|value| value != "0" && !value.is_empty()) {
        return true;
    }
    if env::var_os("NO_COLOR").is_some() {
        return false;
    }
    if env::var("TERM").is_ok_and(|term| term == "dumb") {
        return false;
    }
    is_terminal
}

#[cfg(test)]
mod tests {
    use super::TerminalStyle;

    #[test]
    fn color_helpers_apply_ansi_when_enabled() {
        let style = TerminalStyle::color();

        assert_eq!(style.bold("test"), "\x1b[1mtest\x1b[0m");
        assert_eq!(style.dim("test"), "\x1b[2mtest\x1b[0m");
        assert_eq!(style.red("test"), "\x1b[31mtest\x1b[0m");
        assert_eq!(style.green("test"), "\x1b[32mtest\x1b[0m");
        assert_eq!(style.yellow("test"), "\x1b[33mtest\x1b[0m");
        assert_eq!(style.cyan("test"), "\x1b[36mtest\x1b[0m");
    }

    #[test]
    fn color_helpers_return_plain_text_when_disabled() {
        let style = TerminalStyle::plain();

        assert_eq!(style.bold("test"), "test");
        assert_eq!(style.dim("test"), "test");
        assert_eq!(style.red("test"), "test");
        assert_eq!(style.green("test"), "test");
        assert_eq!(style.yellow("test"), "test");
        assert_eq!(style.cyan("test"), "test");
    }
}
