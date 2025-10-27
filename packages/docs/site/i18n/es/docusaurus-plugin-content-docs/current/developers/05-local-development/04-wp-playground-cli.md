---
title: Playground CLI
slug: /developers/local-development/wp-playground-cli
---

# Playground CLI

[@wp-playground/cli](https://www.npmjs.com/package/@wp-playground/cli) es una herramienta de línea de comandos que simplifica el flujo de desarrollo y pruebas de WordPress.
Playground CLI soporta el montaje automático de un directorio con un plugin, tema o instalación de WordPress. Pero si necesitas flexibilidad, el CLI soporta comandos de montaje para personalizar tu entorno local.

**Características principales:**

-   **Configuración Rápida**: Configura un entorno WordPress local en segundos.
-   **Flexibilidad**: Permite la configuración para adaptarse a diferentes escenarios.
-   **Entorno Simple**: Sin configuración extra, solo una versión compatible de Node, y estás listo para usarlo.

## Requisitos

El Playground CLI requiere Node.js 20.18 o superior, que es la versión recomendada de Soporte a Largo Plazo (LTS). Puedes descargarlo desde el [sitio web de Node.js](https://nodejs.org/en/download).

## Inicio Rápido

Para ejecutar el Playground CLI, abre una línea de comandos y usa el siguiente comando:

```bash
npx @wp-playground/cli@latest server
```

![Playground CLI en Acción](@site/static/img/developers/npx-wp-playground-server.gif)

Con el comando anterior, solo obtienes una instancia fresca de WordPress para probar. La mayoría de los desarrolladores querrán probar su propio trabajo. Para probar un plugin o un tema, navega a la carpeta de tu proyecto y ejecuta el CLI con la bandera `--auto-mount`:

```bash
cd my-plugin-or-theme-directory
npx @wp-playground/cli@latest server --auto-mount
```

### Elegir una Versión de WordPress y PHP

Por defecto, el CLI carga la última versión estable de WordPress y PHP 8.3 debido a su rendimiento mejorado. Para especificar tus versiones preferidas, puedes usar las banderas `--wp=<version>` y `--php=<version>`:

```bash
npx @wp-playground/cli@latest server --wp=6.8 --php=8.3
```

### Cargar Blueprints

Una forma de llevar tu experiencia de desarrollo con Playground CLI al siguiente nivel es integrar con [Blueprints](/blueprints/getting-started/). Para aquellos que no estén familiarizados con esta tecnología, permite a los desarrolladores configurar el estado inicial para sus instancias de WordPress Playground.

Usando la bandera `--blueprint=<blueprint-address>`, los desarrolladores pueden ejecutar un Playground con un estado inicial personalizado. Usaremos el ejemplo a continuación para hacer esto.

**(my-blueprint.json)**

```bash
{
  "landingPage": "/wp-admin/options-general.php?page=akismet-key-config",
  "login": true,
  "plugins": [
    "hello-dolly",
    "https://raw.githubusercontent.com/adamziel/blueprints/trunk/docs/assets/hello-from-the-dashboard.zip"
  ]
}
```

Comando CLI cargando un blueprint:

```bash
npx @wp-playground/cli@latest server --blueprint=my-blueprint.json
```

### Montar carpetas manualmente

Algunos proyectos tienen una estructura específica que requiere una configuración personalizada; por ejemplo, tu repositorio contiene todos los archivos en la carpeta `/wp-content/`. Entonces en este escenario, puedes especificar al Playground CLI que montará tu proyecto desde esa carpeta usando la bandera `--mount`.

```bash
npx @wp-playground/cli@latest server --mount=.:/wordpress/wp-content/plugins/MY-PLUGIN-DIRECTORY
```

### Montar antes de la instalación de WordPress

Considera montar tus archivos de proyecto de WordPress antes de que comience la instalación de WordPress. Este enfoque es beneficioso si quieres sobrescribir el proceso de arranque de Playground, ya que puede ayudar a conectar Playground con `WP-CLI`. La bandera `--mount-before-install` soporta este proceso.

```bash
npx @wp-playground/cli@latest server --mount-before-install=.:/wordpress/
```

:::info
En Windows, el formato de ruta `/host/path:/vfs/path` puede causar problemas. Para resolver esto, usa las banderas `--mount-dir` y `--mount-dir-before-install`. Estas banderas te permiten especificar rutas del host y del sistema de archivos virtual en un formato alternativo `"/host/path"` `"/vfs/path"`.
:::

### Entender la Persistencia de Datos y Ubicación de SQLite

Por defecto, Playground CLI almacena archivos de WordPress y la base de datos SQLite en **directorios temporales en tu sistema operativo**:

```
<OS-TEMP-DIR>/playground-<random-id>/
├── wordpress/          # Instalación WordPress
├── internal/          # Configuración del runtime de Playground
└── tmp/              # Archivos temporales PHP
```

**Encontrar tu Directorio Temporal:**

La ubicación real depende de tu SO (estos son ejemplos o posibilidades comunes):

-   **macOS/Linux**: Puede estar bajo `/tmp/` o `/private/var/folders/` (varía según el sistema)
-   **Windows**: `C:\Users\<username>\AppData\Local\Temp\`

Para ver la ruta exacta del directorio temporal que se está usando, ejecuta el CLI con la bandera `--verbosity=debug`:

```bash
npx @wp-playground/cli@latest server --verbosity=debug
```

Esto mostrará algo como:

```
Native temp dir for VFS root:
/private/var/folders/c8/mwz12ycx4s509056kby3hk180000gn/T/node-playground-cli-site-62926--62926-yQNOdvJVIgYC
Mount before WP install: /home ->
/private/var/folders/c8/mwz12ycx4s509056kby3hk180000gn/T/node-playground-cli-site-62926--62926-yQNOdvJVIgYC/home
Mount before WP install: /tmp ->
/private/var/folders/c8/mwz12ycx4s509056kby3hk180000gn/T/node-playground-cli-site-62926--62926-yQNOdvJVIgYC/tmp
Mount before WP install: /wordpress ->
/private/var/folders/c8/mwz12ycx4s509056kby3hk180000gn/T/node-playground-cli-site-62926--62926-yQNOdvJVIgYC/wordpress
```

**¿Dónde se Almacena la Base de Datos SQLite?**

La ubicación de la base de datos depende de lo que montes:

-   **Montaje automático de wp-content o WordPress completo**:

    -   Base de datos: `<tu-proyecto-local>/wp-content/database/.ht.sqlite`
    -   ✅ **Persistido localmente** en la carpeta de tu proyecto

-   **Montaje automático solo de plugin/tema**:

    -   Base de datos: `<OS-TEMP-DIR>/playground-<id>/wordpress/wp-content/database/.ht.sqlite`
    -   ⚠️ **Perdido cuando el servidor se detiene** (los directorios temporales se limpian)

-   **Montajes personalizados**: La ubicación de la base de datos sigue tu configuración de montaje

**Limpieza Automática:**
Playground CLI elimina automáticamente los directorios temporales que son:

-   Más antiguos de 2 días
-   Ya no están asociados con un proceso en ejecución

**Recomendación:** Para persistir tanto tu código como la base de datos al desarrollar plugins o temas, monta el directorio `wp-content` completo en lugar de solo la carpeta del plugin/tema.

**Ejemplo: Montar wp-content para persistencia**

```bash
# Monta tu directorio wp-content completo
cd my-wordpress-project
npx @wp-playground/cli@latest server --mount=./wp-content:/wordpress/wp-content
```

## Comandos y Argumentos

Playground CLI es simple, configurable y sin opiniones. Puedes configurarlo de acuerdo
a tu configuración única de WordPress. Con el Playground CLI, puedes usar los siguientes comandos de nivel superior:

-   **`server`**: (Por defecto) Inicia un servidor WordPress local.
-   **`run-blueprint`**: Ejecuta un archivo Blueprint sin iniciar un servidor web.
-   **`build-snapshot`**: Construye una instantánea ZIP de un sitio WordPress basado en un Blueprint.

El comando `server` soporta los siguientes argumentos opcionales:

-   `--port=<port>`: El número de puerto para que el servidor escuche. Por defecto es 9400.
-   `--outfile`: Al construir, escribir en este archivo de salida.
-   `--wp=<version>`: La versión de WordPress a usar. Por defecto es la última.
-   `--auto-mount`: Montar automáticamente el directorio actual (plugin, tema, wp-content, etc.).
-   `--mount=<mapping>`: Montar manualmente un directorio (puede usarse múltiples veces). Formato: `"/host/path:/vfs/path"`.
-   `--mount-before-install`: Montar un directorio al runtime PHP antes de la instalación de WordPress (puede usarse múltiples veces). Formato: `"/host/path:/vfs/path"`.
-   `--mount-dir`: Montar un directorio al runtime PHP (puede usarse múltiples veces). Formato: `"/host/path"` `"/vfs/path"`.
-   `--mount-dir-before-install`: Montar un directorio antes de la instalación de WordPress (puede usarse múltiples veces). Formato: `"/host/path"` `"/vfs/path"`
-   `--blueprint=<path>`: La ruta a un archivo JSON Blueprint para ejecutar.
-   `--blueprint-may-read-adjacent-files`: Bandera de consentimiento: Permitir que recursos "empaquetados" en un blueprint local lean archivos en el mismo directorio que el archivo blueprint.
-   `--login`: Iniciar sesión automáticamente del usuario como administrador.
-   `--skip-wordpress-setup`: No descargar ni instalar WordPress. Útil si estás montando un directorio WordPress completo.
-   `--skip-sqlite-setup`: No configurar la integración de base de datos SQLite.
-   `--verbosity`: Salida de logs y mensajes de progreso. Las opciones son "quiet", "normal" o "debug". Por defecto es "normal".
-   `--debug`: Imprimir el log de errores de PHP si ocurre un error durante el arranque.

## ¿Necesitas ayuda con el CLI?

Con el Playground CLI, puedes usar la bandera `--help` para obtener la lista completa de comandos y argumentos disponibles.

```bash
npx @wp-playground/cli@latest --help
```

## Uso Programático con JavaScript

El Playground CLI también puede ser controlado programáticamente desde tu código JavaScript/TypeScript usando la función `runCLI`. Esto te da acceso directo a todas las funcionalidades del CLI dentro de tu código, lo cual es útil para automatizar pruebas end-to-end. Cubramos los conceptos básicos del uso de `runCLI`.

### Ejecutar una instancia de WordPress con una versión específica

Usando la función `runCLI`, puedes especificar opciones como las versiones de PHP y WordPress. En el ejemplo a continuación, solicitamos PHP 8.3, la última versión de WordPress, y iniciar sesión automáticamente. Todos los argumentos soportados están definidos en el tipo `RunCLIArgs`.

```TypeScript
import { runCLI, RunCLIArgs, RunCLIServer } from "@wp-playground/cli";

let cliServer: RunCLIServer;

cliServer = await runCLI({
    command: 'server',
    php: '8.3',
    wp: 'latest',
    login: true
} as RunCLIArgs);
```

Para ejecutar el código anterior, el desarrollador puede establecer su método preferido. Una forma simple de ejecutar este código es guardarlo como un archivo `.ts` y ejecutarlo con una herramienta como `tsx`. Por ejemplo: `tsx my-script.ts`

### Configurar un Blueprint

Puedes proporcionar un blueprint de dos maneras: ya sea como un objeto literal pasado directamente a la propiedad `blueprint`, o como una cadena que contiene la ruta a un archivo `.json` externo.

```TypeScript
import { runCLI, RunCLIServer } from "@wp-playground/cli";

let cliServer: RunCLIServer;

cliServer = await runCLI({
  command: 'server',
  wp: 'latest',
  blueprint: {
    steps: [
        {
          "step": "setSiteOptions",
          "options": {
              "blogname": "Blueprint Title",
              "blogdescription": "A great blog description"
          }
        }
    ],
  },
});
```

Para una seguridad de tipos completa al definir tu objeto blueprint, puedes importar y usar el tipo `BlueprintDeclaration` del paquete `@wp-playground/blueprints`:

```TypeScript
import type { BlueprintDeclaration } from '@wp-playground/blueprints';

const myBlueprint: BlueprintDeclaration = {
  landingPage: "/wp-admin/",
  steps: [
    {
      "step": "installTheme",
      "themeData": {
        "resource": "wordpress.org/themes",
        "slug": "twentytwentyone"
      },
      "options": {
        "activate": true
      }
    }
  ]
};
```

### Montar un plugin programáticamente

Es posible montar directorios locales programáticamente usando `runCLI`. Las opciones `mount` y `mount-before-install` están disponibles. La propiedad `hostPath` espera una ruta a un directorio en tu máquina local. Esta ruta debe ser relativa a donde se está ejecutando tu script.

```TypeScript
	cliServer = await runCLI({
      command: 'server',
      login: true,
      'mount-before-install': [
        {
          hostPath: './[my-plugin-local-path]',
          vfsPath: '/wordpress/wp-content/plugins/my-plugin',
        },
      ],
    });
```

Con esas opciones podemos combinar el montaje de partes del proyecto con blueprints, por ejemplo:

```TypeScript

import { runCLI, RunCLIArgs, RunCLIServer } from "@wp-playground/cli";

let cliServer: RunCLIServer;

cliServer = await runCLI({
    command: 'server',
    php: '8.3',
    wp: 'latest',
    login: true,
    mount: [
        {
            "hostPath": "./plugin/",
            "vfsPath": "/wordpress/wp-content/plugins/playwright-test"
        }
    ],
    blueprint: {
        steps: [
            {
                "step": "activatePlugin",
                "pluginPath": "/wordpress/wp-content/plugins/playwright-test/plugin-playwright.php"
            }
        ]
    }
} as RunCLIArgs);
```
