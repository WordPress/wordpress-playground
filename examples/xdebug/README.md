## About

Use PHP.wasm with Xdebug

<br>

## Appendix

There are multiple ways to run PHP.wasm :

#### 1. Directly from the [WordPress Playground](https://github.com/WordPress/wordpress-playground) repository

```bash
cd wordpress-playground
```

```
// PHP.wasm CLI
node \
--no-warnings=ExperimentalWarning \
--experimental-strip-types \
--experimental-transform-types \
--import ./packages/meta/src/node-es-module-loader/register.mts \
./packages/php-wasm/cli/src/main.ts --xdebug
```

```
// Playground CLI
node \
--no-warnings=ExperimentalWarning \
--experimental-strip-types \
--experimental-transform-types \
--import ./packages/meta/src/node-es-module-loader/register.mts \
./packages/playground/cli/src/cli.ts server --xdebug
```

<br>

#### 2. Running the `local-package-repository` script in the [WordPress Playground](https://github.com/WordPress/wordpress-playground) repository

```bash
cd wordpress-playground

npm run local-package-repository

...
http://127.0.0.1:9724/7840495c41d5c5ae535da114/v3.0.12/@php-wasm-universal-3.0.12.tar.gz
http://127.0.0.1:9724/7840495c41d5c5ae535da114/v3.0.12/@php-wasm-node-3.0.12.tar.gz
http://127.0.0.1:9724/7840495c41d5c5ae535da114/v3.0.12/@php-wasm-cli-3.0.12.tar.gz
http://127.0.0.1:9724/7840495c41d5c5ae535da114/v3.0.12/@wp-playground-cli-3.0.12.tar.gz
...
```

The requested lines must be added in your separate project's `package.json` file :

```json
{
	"type": "module",
	"dependencies": {
		"@php-wasm/node": "http://127.0.0.1:9724/7840495c41d5c5ae535da114/v3.0.12/@php-wasm-node-3.0.12.tar.gz",
		"@php-wasm/cli": "http://127.0.0.1:9724/7840495c41d5c5ae535da114/v3.0.12/@php-wasm-cli-3.0.12.tar.gz",
		"@wp-playground/cli": "http://127.0.0.1:9724/7840495c41d5c5ae535da114/v3.0.12/@wp-playground-cli-3.0.12.tar.gz"
	}
}
```

```bash
npm install
```

<br>

#### 3. Installing the necessary packages from NPM

```bash
npm install @php-wasm/node @php-wasm/cli @wp-playground/cli
```

<br>

#### 4. Running packages directly from NPX [PHP.wasm CLI and WP-Playground/CLI only]

```bash
npx @php-wasm/cli --xdebug

npx @wp-playground/cli server --xdebug
```

<br>
<br>

## How to start

#### 1. Choose the environment you want to use Xdebug in

- chrome-devtools
- ide

#### 2. Follow the dedicated README file instructions
