---
title: Compilar PHP
slug: /developers/architecture/wasm-php-compiling
---

<!--
# Compiling PHP
-->

# Compilar PHP

<!--
The build pipeline lives in a [`Dockerfile`](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/php/Dockerfile). It was originally forked from [seanmorris/php-wasm](https://github.com/seanmorris/php-wasm)
-->

El proceso de compilación se encuentra en un [`Dockerfile`](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/php/Dockerfile). Originalmente se derivó de [seanmorris/php-wasm](https://github.com/seanmorris/php-wasm).

<!--
In broad strokes, that `Dockerfile`:
-->

A grandes rasgos, ese `Dockerfile`:

<!--
- Installs all the necessary linux packages (like `build-essential`)
- Downloads PHP and the required libraries, e.g. `sqlite3`.
- Applies a few patches.
- Compiles everything using [Emscripten](https://emscripten.org/), a drop-in replacement for the C compiler.
- Compiles `php_wasm.c` – a convenient API for JavaScript.
- Outputs a `php.wasm` file and one or more JavaScript loaders, depending on the configuration.
- Transforms the Emscripten's default `php.js` output into an ESM module with additional features.
-->

- Instala todos los paquetes de Linux necesarios (como `build-essential`).
- Descarga PHP y las bibliotecas necesarias, como `sqlite3`.
- Aplica algunos parches.
- Compila todo con [Emscripten](https://emscripten.org/), un sustituto directo del compilador de C.
- Compila `php_wasm.c`, una API práctica para JavaScript.
- Genera un archivo `php.wasm` y uno o varios cargadores JavaScript, según la configuración.
- Transforma la salida predeterminada `php.js` de Emscripten en un módulo ESM con funciones adicionales.

<!--
To find out more about each step, refer directly to the [Dockerfile](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/php/Dockerfile).
-->

Para obtener más información sobre cada paso, consulta directamente el [Dockerfile](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/php/Dockerfile).

<!--
### Building
-->

### Compilación

<!--
With Docker running and the repository dependencies installed, run these commands from the repository root:
-->

Con Docker en ejecución y las dependencias del repositorio instaladas, ejecuta estos comandos desde la raíz del repositorio:

<!--
```sh
# Build all supported PHP versions for the web, in both JSPI and Asyncify modes.
npx nx recompile-php:all php-wasm-web

# Build only PHP 8.4 for the web, in JSPI mode.
npx nx recompile-php:jspi php-wasm-web -- --PHP_VERSION=8.4
```
-->

```sh
# Compila todas las versiones compatibles de PHP para la web, en los modos JSPI y Asyncify.
npx nx recompile-php:all php-wasm-web

# Compila solo PHP 8.4 para la web, en modo JSPI.
npx nx recompile-php:jspi php-wasm-web -- --PHP_VERSION=8.4
```

<!--
Replace `php-wasm-web` with `php-wasm-node` to build for Node.js, or `recompile-php:jspi` with `recompile-php:asyncify` to build the Asyncify variant. The output goes to `packages/php-wasm/web-builds/<major>-<minor>/<mode>/` or `packages/php-wasm/node-builds/<major>-<minor>/<mode>/`.
-->

Sustituye `php-wasm-web` por `php-wasm-node` para compilar para Node.js, o `recompile-php:jspi` por `recompile-php:asyncify` para compilar la variante Asyncify. Los archivos se generan en `packages/php-wasm/web-builds/<major>-<minor>/<mode>/` o `packages/php-wasm/node-builds/<major>-<minor>/<mode>/`.

<!--
### Debug builds
-->

### Compilaciones para depuración {#debug-builds}

<!--
Use `--WITH_DEBUG=yes` to build PHP.wasm with readable JavaScript output and DWARF debug information for stepping through C code in a WebAssembly debugger:
-->

Usa `--WITH_DEBUG=yes` para compilar PHP.wasm con una salida JavaScript legible e información de depuración DWARF que permita recorrer el código C paso a paso en un depurador WebAssembly:

<!--
```sh
# Build PHP 8.4 for debugging in the browser.
npx nx recompile-php:jspi php-wasm-web -- --PHP_VERSION=8.4 --WITH_DEBUG=yes

# Build PHP 8.4 for debugging in Node.js.
npx nx recompile-php:jspi php-wasm-node -- --PHP_VERSION=8.4 --WITH_DEBUG=yes
```
-->

```sh
# Compila PHP 8.4 para depurarlo en el navegador.
npx nx recompile-php:jspi php-wasm-web -- --PHP_VERSION=8.4 --WITH_DEBUG=yes

# Compila PHP 8.4 para depurarlo en Node.js.
npx nx recompile-php:jspi php-wasm-node -- --PHP_VERSION=8.4 --WITH_DEBUG=yes
```

<!--
The same option works with `recompile-php:asyncify`. Debug builds produce larger files and run more slowly than optimized builds. They replace the selected version's artifacts in the output directory described above. Rebuild with `--WITH_DEBUG=no --WITH_SOURCEMAPS=no` to restore an optimized build.
-->

La misma opción funciona con `recompile-php:asyncify`. Las compilaciones para depuración generan archivos más grandes y se ejecutan más lentamente que las compilaciones optimizadas. Sustituyen los artefactos de la versión seleccionada en el directorio de salida descrito anteriormente. Vuelve a compilar con `--WITH_DEBUG=no --WITH_SOURCEMAPS=no` para restaurar una compilación optimizada.

<!--
For WebAssembly source maps, use `--WITH_SOURCEMAPS=yes`:
-->

Para generar mapas de código fuente de WebAssembly, usa `--WITH_SOURCEMAPS=yes`:

<!--
```sh
npx nx recompile-php:jspi php-wasm-web -- --PHP_VERSION=8.4 --WITH_SOURCEMAPS=yes
```
-->

```sh
npx nx recompile-php:jspi php-wasm-web -- --PHP_VERSION=8.4 --WITH_SOURCEMAPS=yes
```

<!--
This generates a `php.wasm.map` file and copies the source files needed for debugging into the build output. For web builds, the source map URL points to the local development server at `http://127.0.0.1:5400`; run `npm run dev` to serve it.
-->

Esto genera un archivo `php.wasm.map` y copia los archivos de código fuente necesarios para la depuración en el directorio de salida de la compilación. En las compilaciones para la web, la URL del mapa de código fuente apunta al servidor de desarrollo local en `http://127.0.0.1:5400`; ejecuta `npm run dev` para servirlo.

<!--
#### Emscripten options
-->

#### Opciones de Emscripten

<!--
The build script translates these options into compiler flags in the [PHP Dockerfile](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/php/Dockerfile):
-->

El script de compilación convierte estas opciones en indicadores del compilador en el [Dockerfile de PHP](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/php/Dockerfile):

<!--
| Flag           | Purpose                                                                                                | When Playground uses it                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `-O0`          | Disables optimization of the final WebAssembly and JavaScript output.                                  | `WITH_DEBUG=yes` or `WITH_SOURCEMAPS=yes`, replacing the default `-O3`. |
| `-g2`          | Keeps function names and readable JavaScript, without retaining DWARF information in the final module. | Node.js builds when neither debug option is enabled.                    |
| `-g3`          | Retains DWARF information for source-level debugging.                                                  | `WITH_DEBUG=yes` or `WITH_SOURCEMAPS=yes`.                              |
| `-gsource-map` | Generates a WebAssembly source map from compiler debug information.                                    | `WITH_SOURCEMAPS=yes`.                                                  |
-->

| Indicador      | Finalidad                                                                                                        | Cuándo lo usa Playground                                                               |
| -------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `-O0`          | Desactiva la optimización de la salida final de WebAssembly y JavaScript.                                        | `WITH_DEBUG=yes` o `WITH_SOURCEMAPS=yes`, en lugar del valor predeterminado `-O3`.     |
| `-g2`          | Conserva los nombres de las funciones y el JavaScript legible, sin retener información DWARF en el módulo final. | Compilaciones para Node.js cuando ninguna de las opciones de depuración está activada. |
| `-g3`          | Conserva la información DWARF para depurar a nivel de código fuente.                                             | `WITH_DEBUG=yes` o `WITH_SOURCEMAPS=yes`.                                              |
| `-gsource-map` | Genera un mapa de código fuente de WebAssembly a partir de la información de depuración del compilador.          | `WITH_SOURCEMAPS=yes`.                                                                 |

<!--
See the [Emscripten compiler reference](https://emscripten.org/docs/tools_reference/emcc.html) for details on these flags.
-->

Consulta la [referencia del compilador Emscripten](https://emscripten.org/docs/tools_reference/emcc.html) para obtener más información sobre estos indicadores.

<!--
#### Runtime assertions
-->

#### Aserciones en tiempo de ejecución

<!--
Debug information and runtime assertions are separate settings. Playground explicitly passes `-s ASSERTIONS=0`, including in debug builds, so `--WITH_DEBUG=yes` does not enable extra runtime checks.
-->

La información de depuración y las aserciones en tiempo de ejecución son ajustes independientes. Playground pasa explícitamente `-s ASSERTIONS=0`, incluso en las compilaciones para depuración, por lo que `--WITH_DEBUG=yes` no activa comprobaciones adicionales en tiempo de ejecución.

<!--
To investigate a runtime failure with assertions, change that setting in the PHP Dockerfile's final `emcc` command and rebuild. Emscripten documents `-s ASSERTIONS=1` for runtime checks and `-s ASSERTIONS=2` for additional, slower checks. There is no `WITH_ASSERTIONS` build option. See the [Emscripten assertions reference](https://emscripten.org/docs/tools_reference/settings_reference.html#assertions).
-->

Para investigar un fallo en tiempo de ejecución con aserciones, cambia ese ajuste en el comando `emcc` final del Dockerfile de PHP y vuelve a compilar. Emscripten documenta `-s ASSERTIONS=1` para comprobaciones en tiempo de ejecución y `-s ASSERTIONS=2` para comprobaciones adicionales, más lentas. No existe una opción de compilación `WITH_ASSERTIONS`. Consulta la [referencia de aserciones de Emscripten](https://emscripten.org/docs/tools_reference/settings_reference.html#assertions).

<!--
Assertions can also report an environment mismatch between `web` and `worker`. Check the build's `ENVIRONMENT` setting and the JavaScript loader's execution context when investigating those errors; see the [discussion in issue #176](https://github.com/WordPress/wordpress-playground/issues/176#issuecomment-1483754022).
-->

Las aserciones también pueden indicar una incompatibilidad de entorno entre `web` y `worker`. Comprueba el ajuste `ENVIRONMENT` de la compilación y el contexto de ejecución del cargador JavaScript al investigar estos errores; consulta la [discusión en la incidencia #176](https://github.com/WordPress/wordpress-playground/issues/176#issuecomment-1483754022).

<!--
### PHP next builds
-->

### Compilaciones de PHP next

<!--
Playground can also run the next PHP version from the php-src development branch in the web runtime. These builds are published separately from the main repository because the generated WebAssembly files are large and change often.
-->

Playground también puede ejecutar la próxima versión de PHP desde la rama de desarrollo de php-src en el entorno web. Estas compilaciones se publican por separado del repositorio principal porque los archivos WebAssembly generados son grandes y cambian con frecuencia.

<!--
The nightly refresh workflow builds the php-src development branch, writes the web artifacts to the gitignored `packages/playground/website/public/php-next/` directory, and publishes the result to the `php-next-builds` branch. Website deploys and the local dev server sync that branch before serving `?php=next`.
-->

El flujo de actualización nocturno compila la rama de desarrollo de php-src, escribe los artefactos para la web en el directorio `packages/playground/website/public/php-next/`, ignorado por Git, y publica el resultado en la rama `php-next-builds`. Los despliegues del sitio web y el servidor de desarrollo local sincronizan esa rama antes de servir `?php=next`.

<!--
To refresh the local copy manually, run:
-->

Para actualizar la copia local manualmente, ejecuta:

<!--
```sh
npm run sync:php-next
```
-->

```sh
npm run sync:php-next
```

<!--
To rebuild the web artifacts locally from the php-src development branch, run:
-->

Para recompilar localmente los artefactos para la web desde la rama de desarrollo de php-src, ejecuta:

<!--
```sh
npm run recompile:php:web:next
```
-->

```sh
npm run recompile:php:web:next
```

<!--
`php=next` currently ships web main modules only. Matching extension side modules and Playground CLI support are separate follow-up work.
-->

Actualmente, `php=next` solo distribuye módulos principales para la web. Los módulos auxiliares de extensiones correspondientes y la compatibilidad con la CLI de Playground se abordarán en trabajos posteriores independientes.

<!--
### PHP extensions
-->

### Extensiones de PHP

<!--
PHP is built with several extensions listed in the [`Dockerfile`](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/php/Dockerfile).
-->

PHP se compila con varias extensiones que se enumeran en el [`Dockerfile`](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/php/Dockerfile).

<!--
Some extensions, like `zip`, can be turned on or off during the build. Others, like `sqlite3`, are hardcoded.
-->

Algunas extensiones, como `zip`, pueden activarse o desactivarse durante la compilación. Otras, como `sqlite3`, están definidas directamente en el código.

<!--
If you need to turn off one of the hardcoded extensions, feel free to open an issue in this repo. Better yet, this project needs contributors. You are more than welcome to open a PR and author the change you need.
-->

Si necesitas desactivar una de las extensiones definidas directamente en el código, puedes abrir una incidencia en este repositorio. Mejor aún: este proyecto necesita colaboradores. Puedes abrir una PR e implementar el cambio que necesitas.

<!--
PHP.wasm can also load dynamic `.so` extensions before PHP starts. Built-in
dynamic extensions such as `intl`, `xdebug`, `redis`, and `memcached` are
distributed with the Node package, and external extensions can be supplied with
a manifest that selects the artifact matching the active PHP version and async
mode. See [Loading PHP extensions](/developers/apis/javascript-api/php-extensions)
for the runtime API.
-->

PHP.wasm también puede cargar extensiones dinámicas `.so` antes de iniciar PHP. Las extensiones dinámicas integradas, como `intl`, `xdebug`, `redis` y `memcached`, se distribuyen con el paquete de Node, y las extensiones externas pueden proporcionarse con un manifiesto que seleccione el artefacto correspondiente a la versión de PHP y al modo asíncrono activos. Consulta [Cargar extensiones de PHP](/developers/apis/javascript-api/php-extensions) para conocer la API de ejecución.

<!--
### C API exposed to JavaScript
-->

### API de C expuesta a JavaScript

<!--
The C API exposed to JavaScript lives in the [`php_wasm.c`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/build-assets/php_wasm.c) file. The most important functions are:
-->

La API de C expuesta a JavaScript se encuentra en el archivo [`php_wasm.c`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/build-assets/php_wasm.c). Las funciones más importantes son:

<!--
- `void phpwasm_init()` – It creates a new PHP context and must be called before running any PHP code.
- `int phpwasm_run(char *code)` – Runs a PHP script and writes the output to /tmp/stdout and /tmp/stderr. Returns the exit code.
- `void phpwasm_refresh()` – Destroy the current PHP context and starts a new one. Call it after running one PHP script and before running another.
-->

- `void phpwasm_init()` – Crea un nuevo contexto de PHP y debe llamarse antes de ejecutar cualquier código PHP.
- `int phpwasm_run(char *code)` – Ejecuta un script PHP y escribe la salida en /tmp/stdout y /tmp/stderr. Devuelve el código de salida.
- `void phpwasm_refresh()` – Destruye el contexto de PHP actual e inicia uno nuevo. Llámala después de ejecutar un script PHP y antes de ejecutar otro.

<!--
Refer to the inline documentation in [`php_wasm.c`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/build-assets/php_wasm.c) to learn more.
-->

Consulta la documentación incluida en [`php_wasm.c`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/build-assets/php_wasm.c) para obtener más información.

<!--
### Build configuration
-->

### Configuración de la compilación

<!--
The build is configurable via the [Docker `--build-arg` feature](https://docs.docker.com/engine/reference/commandline/build/#set-build-time-variables---build-arg). You can set them up through the `build.js` script, just run this command to get the usage message:
-->

La compilación se puede configurar mediante la [opción `--build-arg` de Docker](https://docs.docker.com/engine/reference/commandline/build/#set-build-time-variables---build-arg). Puedes definir los ajustes mediante el script `build.js`; ejecuta este comando para ver las instrucciones de uso:

<!--
```sh
npx nx recompile-php:jspi php-wasm-web -- --help
```
-->

```sh
npx nx recompile-php:jspi php-wasm-web -- --help
```

<!--
**Supported build options:**
-->

**Opciones de compilación disponibles:**

<!--
- `WITH_DEBUG` – `yes` or `no`. Build with DWARF debug information and disable final optimization. See [Debug builds](#debug-builds).
- `WITH_SOURCEMAPS` – `yes` or `no`. Generate WebAssembly source maps and disable final optimization. See [Debug builds](#debug-builds).
- `PHP_VERSION` – The PHP version to build, default: `8.0.24`. This value must point to an existing branch of the https://github.com/php/php-src.git repository when prefixed with `PHP-`. For example, `7.4.0` is valid because the branch `PHP-7.4.0` exists, but just `7` is invalid because there's no branch `PHP-7`. The PHP versions that are known to work are `7.4.*` and `8.0.*`. Others likely work as well but they haven't been tried.
- `EMSCRIPTEN_ENVIRONMENT` – `web` or `node`, default: `web`. The platform to build for. When building for `web`, two JavaScript loaders will be created: `php-web.js` and `php-webworker.js`. When building for Node.js, only one loader called `php-node.js` will be created.
- `WITH_LIBXML` – `yes` or `no`, default: `no`. Whether to build with `libxml2` and the `dom`, `xml`, and `simplexml` PHP extensions (`DOMDocument`, `SimpleXML`, ..).
- `WITH_LIBZIP` – `yes` or `no`, default: `yes`. Whether to build with `zlib`, `libzip`, and the `zip` PHP extension (`ZipArchive`).
- `WITH_NODEFS` – `yes` or `no`, default: `no`. Whether to include [the Emscripten's NODEFS JavaScript library](https://emscripten.org/docs/api_reference/Filesystem-API.html#filesystem-api-nodefs). It's useful for loading files and mounting directories from the local filesystem when running php.wasm from Node.js.
-->

- `WITH_DEBUG` – `yes` o `no`. Compila con información de depuración DWARF y desactiva la optimización final. Consulta [Compilaciones para depuración](#debug-builds).
- `WITH_SOURCEMAPS` – `yes` o `no`. Genera mapas de código fuente de WebAssembly y desactiva la optimización final. Consulta [Compilaciones para depuración](#debug-builds).
- `PHP_VERSION` – La versión de PHP que se compilará, predeterminada: `8.0.24`. Este valor debe corresponder a una rama existente del repositorio https://github.com/php/php-src.git al añadirle el prefijo `PHP-`. Por ejemplo, `7.4.0` es válido porque existe la rama `PHP-7.4.0`, pero solo `7` no es válido porque no existe la rama `PHP-7`. Las versiones de PHP que se sabe que funcionan son `7.4.*` y `8.0.*`. Es probable que otras también funcionen, pero no se han probado.
- `EMSCRIPTEN_ENVIRONMENT` – `web` o `node`, predeterminado: `web`. La plataforma de destino de la compilación. Al compilar para `web`, se crean dos cargadores JavaScript: `php-web.js` y `php-webworker.js`. Al compilar para Node.js, solo se crea un cargador llamado `php-node.js`.
- `WITH_LIBXML` – `yes` o `no`, predeterminado: `no`. Indica si se incluye `libxml2` y las extensiones de PHP `dom`, `xml` y `simplexml` (`DOMDocument`, `SimpleXML`, ...).
- `WITH_LIBZIP` – `yes` o `no`, predeterminado: `yes`. Indica si se incluye `zlib`, `libzip` y la extensión de PHP `zip` (`ZipArchive`).
- `WITH_NODEFS` – `yes` o `no`, predeterminado: `no`. Indica si se incluye [la biblioteca JavaScript NODEFS de Emscripten](https://emscripten.org/docs/api_reference/Filesystem-API.html#filesystem-api-nodefs). Permite cargar archivos y montar directorios del sistema de archivos local al ejecutar php.wasm desde Node.js.
