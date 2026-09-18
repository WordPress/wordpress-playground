## About

Use PHP.wasm with Xdebug in Google Chrome Devtools with the Xdebug Bridge

> [!WARNING]
> Debugging with Google Chrome DevTools is still experimental

<br>

## Appendix

> [!IMPORTANT]
> Chrome Devtools retains breakpoints. To reset the Devtools, go to Settings > Preferences > Restore defaults and reload

<br>

There are multiple ways to run the Google Chrome Devtools :

#### 1. Directly from the [WordPress Playground](https://github.com/WordPress/wordpress-playground) repository

```bash
cd wordpress-playground

// PHP.wasm CLI
node \
--no-warnings=ExperimentalWarning \
--experimental-strip-types \
--experimental-transform-types \
--import ./packages/meta/src/node-es-module-loader/register.mts \
./packages/php-wasm/xdebug-bridge/src/cli.ts
```

<br>

#### 2. Running the `local-package-repository` script in the [WordPress Playground](https://github.com/WordPress/wordpress-playground) repository

```bash
cd wordpress-playground

npm run local-package-repository

...
http://127.0.0.1:9724/7840495c41d5c5ae535da114/v3.0.12/@php-wasm-xdebug-bridge-3.0.12.tar.gz
...
```

The requested lines must be added in your separate project's `package.json` file :

```json
{
	"type": "module",
	"dependencies": {
		"@php-wasm/xdebug-bridge": "http://127.0.0.1:9724/7840495c41d5c5ae535da114/v3.0.12/@php-wasm-xdebug-bridge-3.0.12.tar.gz"
	}
}
```

```bash
npm install
```

<br>

#### 3. Installing the necessary packages from NPM

```bash
npm install @php-wasm/xdebug-bridge
```

<br>

#### 4. Running package directly from NPX

```bash
npx @php-wasm/xdebug-bridge
```

<br>
<br>

## How to start

#### 1. Copy the specific directory you would like to try

- php-wasm-node
- php-wasm-cli
- wp-playground-cli

#### 2. Follow the dedicated README file instructions
