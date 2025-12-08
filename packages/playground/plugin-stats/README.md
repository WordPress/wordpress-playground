# WordPress Playground Plugin Compatibility Stats CLI

This is a simple CLI script that evaluates basic WordPress Playground plugin
compatibility with top N plugins from the WordPress.org plugin repository.

Usage:

```bash
npx nx start playground-plugin-stats --top=10
```

At the moment, the script evaluates whether each of the plugins successfully
activates in WordPress Playground without crashing and logging any errors.
