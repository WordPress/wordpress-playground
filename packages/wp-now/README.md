# WP-NOW

`wp-now` is a Command Line Interface (CLI) tool designed to streamline the process of setting up a local WordPress environment by using only Node.js. This powerful tool is optimized for developers working on WordPress themes and plugins.

## Getting Started

Follow these steps to build and run `wp-now` locally:

### Building

To build the project, use the following commands in your terminal:

```bash
nvm use
yarn install
yarn build
```

### Running

To start the web server and execute your WordPress plugin or theme, use the following command:

```bash
nx preview wp-now start --path=/path/to/wordpress-plugin-or-theme
```

Replace `/path/to/wordpress-plugin-or-theme` with the actual path to your plugin or theme folder.

## Contributing

We welcome contributions from the community! Please refer to the main [README.md](../../README.md) file for instructions on how to contribute to this project.
