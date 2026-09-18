---
slug: /developers/architecture/host-your-own-playground
---

<!-- # Host your own Playground -->

# Hospeda tu propio Playground

<!-- You can host the Playground on your own domain instead of `playground.wordpress.net`. -->

Puedes hospedar el Playground en tu propio dominio en lugar de `playground.wordpress.net`.

<!-- This is useful for having full control over its content and behavior, as well as removing dependency on a third-party server. It can provide a more customized user experience, for example: a playground with preinstalled plugins and themes, default site settings, or demo content. -->

Esto es útil para tener control total sobre su contenido y comportamiento, así como eliminar la dependencia de un servidor de terceros. Puede proporcionar una experiencia de usuario más personalizada, por ejemplo: un playground con plugins y temas preinstalados, configuraciones predeterminadas del sitio o contenido de demostración.

<!-- ## Before you start -->

## Antes de comenzar

<!-- Self-hosting Playground gives you full control, but requires understanding a few key concepts: -->

Hospedar Playground por tu cuenta te da control total, pero requiere entender algunos conceptos clave:

<!-- ### What to expect -->

### Qué esperar

<!-- - **Initial setup complexity**: Building and deploying Playground involves multiple steps. Allow time for troubleshooting during your first deployment. -->
<!-- - **Static file hosting**: Playground is primarily static files (HTML, JS, WASM) with minimal server-side requirements. -->
<!-- - **Browser-based execution**: All WordPress processing happens in the user's browser via WebAssembly—your server only delivers files. -->

- **Complejidad de configuración inicial**: Construir y desplegar Playground involucra múltiples pasos. Reserva tiempo para solución de problemas durante tu primer despliegue.
- **Alojamiento de archivos estáticos**: Playground es principalmente archivos estáticos (HTML, JS, WASM) con requisitos mínimos del lado del servidor.
- **Ejecución basada en navegador**: Todo el procesamiento de WordPress ocurre en el navegador del usuario vía WebAssembly—tu servidor solo entrega archivos.

<!-- ### Performance considerations -->

### Consideraciones de rendimiento

<!-- Loading times depend on several factors: -->

Los tiempos de carga dependen de varios factores:

<!-- | Factor            | Impact                                                              | Optimization                                | -->
<!-- | ----------------- | ------------------------------------------------------------------- | ------------------------------------------- | -->
<!-- | **Plugin size**   | Large plugins (e.g., WooCommerce) can take 30-60 seconds to install | Pre-install plugins in your WordPress build | -->
<!-- | **Network speed** | WASM files are ~15-30MB                                             | Use CDN with proper caching headers         | -->
<!-- | **Browser**       | Chrome/Edge perform best; Safari uses fallback mechanisms           | Test across browsers                        | -->
<!-- | **Device**        | Mobile devices load slower than desktop                             | Warn mobile users about longer load times   | -->

| Factor                | Impacto                                                                   | Optimización                                                  |
| --------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Tamaño del plugin** | Los plugins grandes (ej. WooCommerce) pueden tardar 30-60 seg en instalar | Pre-instala plugins en tu build de WordPress                  |
| **Velocidad de red**  | Los archivos WASM son ~15-30MB                                            | Usa CDN con encabezados de caché adecuados                    |
| **Navegador**         | Chrome/Edge tienen mejor rendimiento; Safari usa mecanismos de respaldo   | Prueba en diferentes navegadores                              |
| **Dispositivo**       | Los dispositivos móviles cargan más lento que escritorio                  | Advierte a usuarios móviles sobre tiempos de carga más largos |

<!-- ### Browser compatibility -->

### Compatibilidad con navegadores

<!-- Playground works across modern browsers, but with some differences: -->

Playground funciona en navegadores modernos, pero con algunas diferencias:

<!-- | Browser         | Status              | Notes                                                                              | -->
<!-- | --------------- | ------------------- | ---------------------------------------------------------------------------------- | -->
<!-- | Chrome/Edge     | ✅ Best performance | Full support for all features                                                      | -->
<!-- | Firefox         | ✅ Good             | Reliable performance                                                               | -->
<!-- | Safari          | ✅ Good             | Recent improvements significantly enhanced reliability                             | -->
<!-- | Mobile browsers | ⚠️ Limited          | Works, but with higher memory usage, and a 4G connection can impact the experience | -->

| Navegador           | Estado               | Notas                                                                                    |
| ------------------- | -------------------- | ---------------------------------------------------------------------------------------- |
| Chrome/Edge         | ✅ Mejor rendimiento | Soporte completo para todas las características                                          |
| Firefox             | ✅ Bueno             | Rendimiento confiable                                                                    |
| Safari              | ✅ Bueno             | Mejoras recientes han mejorado significativamente la confiabilidad                       |
| Navegadores móviles | ⚠️ Limitado          | Funciona, pero con mayor uso de memoria, y una conexión 4G puede impactar la experiencia |

<!-- **Technical note**: Safari uses MessagePorts instead of SharedArrayBuffer for streaming responses. This fallback works reliably but adds slight overhead compared to Chrome/Edge. -->

**Nota técnica**: Safari usa MessagePorts en lugar de SharedArrayBuffer para respuestas en streaming. Este mecanismo de respaldo funciona de manera confiable pero añade una ligera sobrecarga comparado con Chrome/Edge.

<!-- ## Usage -->

## Uso

<!-- A self-hosted Playground can be embedded as an iframe. -->

Un Playground auto-hospedado puede ser incrustado como un iframe.

```html
<iframe src="https://my-playground.com"></iframe>
```

<!-- Or dynamically loaded by passing the remote URL to the [Playground Client](/developers/apis/javascript-api/playground-api-client). -->

O cargado dinámicamente pasando la URL remota al [Cliente de Playground](/developers/apis/javascript-api/playground-api-client).

```ts
import { startPlaygroundWeb } from '@wp-playground/client';

const client = await startPlaygroundWeb({
	iframe: document.getElementById('wp'),
	remoteUrl: `https://my-playground.com/remote.html`,
});
```

<!-- ## Static assets -->

## Recursos estáticos

<!-- There are several ways to get the static assets necessary to host the Playground. -->

Hay varias formas de obtener los recursos estáticos necesarios para hospedar el Playground.

<!-- In order of convenience and ease: -->

En orden de conveniencia y facilidad:

<!-- - Download pre-built package -->
<!-- - Fork the repository and build with GitHub Action -->
<!-- - Build locally -->

- Descargar paquete pre-construido
- Hacer fork del repositorio y construir con GitHub Action
- Construir localmente

<!-- ### Download pre-built package -->

### Descargar paquete pre-construido

<!-- To host the Playground as is, without making changes, you can download the built artifact from [the latest successful GitHub Action](https://github.com/WordPress/wordpress-playground/actions/workflows/deploy-website.yml?query=is%3Asuccess). -->

Para hospedar el Playground tal como está, sin hacer cambios, puedes descargar el artefacto construido desde [la última GitHub Action exitosa](https://github.com/WordPress/wordpress-playground/actions/workflows/deploy-website.yml?query=is%3Asuccess).

<!-- - Click on **Deploy Playground website**. -->
<!-- - In the section **Artifacts** at the bottom of the page, click `playground-website`. -->
<!-- - It's a zip package with the same files deployed to the public site. -->

- Haz clic en **Deploy Playground website**.
- En la sección **Artifacts** en la parte inferior de la página, haz clic en `playground-website`.
- Es un paquete zip con los mismos archivos desplegados en el sitio público.

<!-- ### Fork the repository and build with GitHub Action -->

### Hacer fork del repositorio y construir con GitHub Action

<!-- To customize the Playground, you can [fork the Git repository](https://github.com/WordPress/wordpress-playground/fork). -->

Para personalizar el Playground, puedes [hacer fork del repositorio Git](https://github.com/WordPress/wordpress-playground/fork).

<!-- Build it from the fork's GitHub page by going to: **Actions -> Deploy Playground website -> Run workflow**. -->

Constrúyelo desde la página de GitHub de tu fork yendo a: **Actions -> Deploy Playground website -> Run workflow**.

<!-- ### Build locally -->

### Construir localmente

<!-- The most flexible and customizable method is to build the site locally. -->

El método más flexible y personalizable es construir el sitio localmente.

<!-- Create a shallow clone of the Playground repository, or your own fork. -->

Crea un clon superficial del repositorio de Playground, o de tu propio fork.

```sh
git clone -b trunk --single-branch --depth 1 --recurse-submodules https://github.com/WordPress/wordpress-playground.git
```

<!-- Enter the `wordpress-playground` directory. -->

Entra en el directorio `wordpress-playground`.

```sh
cd wordpress-playground
```

<!-- Install dependencies, and build the website. -->

Instala las dependencias y construye el sitio web.

```sh
npm install
npm run build:website
```

<!-- This command internally runs the `nx` task `build:wasm-wordpress-net`. It copies the built assets from packages `remote` and `website` into a new folder at the following path: -->

Este comando internamente ejecuta la tarea `nx` `build:wasm-wordpress-net`. Copia los recursos construidos desde los paquetes `remote` y `website` a una nueva carpeta en la siguiente ruta:

```
dist/packages/playground/wasm-wordpress-net
```

<!-- The entire service of the Playground consists of the content of this folder. -->

El servicio completo del Playground consiste en el contenido de esta carpeta.

<!-- ## Summary of included files -->

## Resumen de archivos incluidos

<!-- The static assets include: -->

Los recursos estáticos incluyen:

<!-- - Data and WASM files for all available PHP and WordPress versions -->
<!-- - `remote.html` - the core of Playground -->
<!-- - `index.html` - the shell, or browser chrome -->
<!-- - Web Worker script -->

- Archivos de datos y WASM para todas las versiones disponibles de PHP y WordPress
- `remote.html` - el núcleo del Playground
- `index.html` - el shell, o chrome del navegador
- Script del Web Worker

<!-- You can deploy the content of the folder to your server using SSH, such as `scp` or `rsync`. -->

Puedes desplegar el contenido de la carpeta a tu servidor usando SSH, como `scp` o `rsync`.

<!-- It is a static site, except for these dynamic aspects. -->

Es un sitio estático, excepto por estos aspectos dinámicos.

<!-- - Apache server directive `.htaccess` file from the package `remote` -->

- Archivo de directiva del servidor Apache `.htaccess` del paquete `remote`

<!-- For these to work, you need a server environment with Apache and PHP installed. -->

Para que estos funcionen, necesitas un entorno de servidor con Apache y PHP instalados.

<!-- ## NGINX configuration -->

## Configuración de NGINX

<!-- As an alternative to Apache, here is an example of using NGINX to serve the Playground. -->

Como alternativa a Apache, aquí hay un ejemplo de usar NGINX para servir el Playground.

<!-- :::info Refer to the source file -->
<!-- The example may be outdated. Please check [the source file](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/playground/remote/.htaccess) for the latest version. -->
<!-- ::: -->

<div class="callout callout-info">

**Consulta el archivo fuente**

El ejemplo puede estar desactualizado. Por favor revisa [el archivo fuente](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/playground/remote/.htaccess) para la última versión.

</div>

<!-- The combined Apache `.htaccess` file looks like this. -->

El archivo combinado de Apache `.htaccess` se ve así.

```htaccess
AddType application/wasm .wasm
```

<!-- An equivalent in NGINX. -->

Un equivalente en NGINX.

```nginx
location ~* .wasm$ {
  types {
    application/wasm wasm;
  }
}
```

<!-- You may need to adjust the above according to server specifics, particularly how to invoke PHP for the path `/plugin-proxy`. -->

Puede que necesites ajustar lo anterior según las especificaciones del servidor, particularmente cómo invocar PHP para la ruta `/plugin-proxy`.

<!-- [Caddy web server](https://caddyserver.com) doesn't require any special config to work. -->

[El servidor web Caddy](https://caddyserver.com) no requiere ninguna configuración especial para funcionar.

<!-- ## Customize bundled data -->

## Personalizar datos empaquetados

<!-- The file `wp.zip` is a bundle of all the files for the virtual file system in Playground. There's a data file for each available WordPress version. -->

El archivo `wp.zip` es un paquete de todos los archivos para el sistema de archivos virtual en Playground. Hay un archivo de datos para cada versión disponible de WordPress.

<!-- The package at `packages/playground/wordpress-builds` is responsible for building these data files. -->

El paquete en `packages/playground/wordpress-builds` es responsable de construir estos archivos de datos.

<!-- Edit the build script in `Dockerfile` to create a custom bundle that includes preinstalled plugins or content. -->

Edita el script de construcción en `Dockerfile` para crear un paquete personalizado que incluya plugins preinstalados o contenido.

<!-- To rebuild the WordPress builds after customizing the `Dockerfile`, run the following command: -->

Para reconstruir los builds de WordPress después de personalizar el `Dockerfile`, ejecuta el siguiente comando:

```
npm run rebuild:wordpress-builds
```

<!-- To rebuild the website to include the custom WordPress builds, follow the instructions [here](#build-locally). -->

Para reconstruir el sitio web para incluir los builds personalizados de WordPress, sigue las instrucciones [aquí](#build-locally).

<!-- ### Install plugins -->

### Instalar plugins

<!-- Here's an example of installing plugins for the data bundle. -->

Aquí hay un ejemplo de instalación de plugins para el paquete de datos.

<!-- Before the section titled `Strip whitespaces from PHP files`. -->

Antes de la sección titulada `Strip whitespaces from PHP files`.

```docker
# === Preinstall plugins ===

RUN cd wordpress/wp-content/mu-plugins && \
    # Install plugins
    for plugin_name in example-plugin-1 example-plugin-2; do \
      curl -L https://downloads.wordpress.org/plugin/{$plugin_name}.latest-stable.zip -o {$plugin_name}.zip && \
      unzip $plugin_file && \
      rm $plugin_file && \
      # Create entry file in mu-plugins root
      echo "<?php require_once __DIR__.'/$plugin_name/$plugin_name.php';" > $plugin_name.php; \
    done;
```

<!-- You can download plugins from URLs other than the WordPress plugin directory, or use Git to pull them from elsewhere. -->

Puedes descargar plugins desde URLs distintas al directorio de plugins de WordPress, o usar Git para obtenerlos de otro lugar.

<!-- It's also possible to copy from a local folder. For example, before `RUN`: -->

También es posible copiar desde una carpeta local. Por ejemplo, antes de `RUN`:

```
COPY ./build-assets/*.zip /root/
```

<!-- Then put the plugin zip files in `build-assets`. In this case, you may want to add their paths to `.gitignore`. -->

Luego coloca los archivos zip de plugins en `build-assets`. En este caso, puede que quieras añadir sus rutas a `.gitignore`.

<!-- ### Import content -->

### Importar contenido

<!-- Here's an example of importing content. -->

Aquí hay un ejemplo de importación de contenido.

```docker
# === Demo content ===

COPY ./build-assets/content.xml /root/
RUN cd wordpress ; \
     echo "Importing content.."; \
    ../wp-cli.phar --allow-root import /root/content.xml --authors=create
```

<!-- This assumes that you have put a WXR export file named `content.xml` in the folder `build-assets`. You can add its path to `.gitignore`. -->

Esto asume que has puesto un archivo de exportación WXR llamado `content.xml` en la carpeta `build-assets`. Puedes añadir su ruta a `.gitignore`.

<!-- ## Production deployment checklist -->

## Lista de verificación para despliegue en producción

<!-- Before going live, verify your self-hosted Playground meets these requirements: -->

Antes de ir a producción, verifica que tu Playground auto-hospedado cumple estos requisitos:

<!-- ### Server configuration -->

### Configuración del servidor

<!-- - [ ] **MIME types**: Ensure `.wasm` files are served with `application/wasm` content type -->
<!-- - [ ] **CORS headers**: If embedding cross-origin, configure appropriate CORS headers -->
<!-- - [ ] **Caching**: Set long cache times for WASM and static assets (they're versioned) -->
<!-- - [ ] **Compression**: Enable gzip/brotli for faster file transfers -->
<!-- - [ ] **HTTPS**: Required for service workers and some browser features -->

- [ ] **Tipos MIME**: Asegura que los archivos `.wasm` se sirven con el tipo de contenido `application/wasm`
- [ ] **Encabezados CORS**: Si incrustas desde otro origen, configura los encabezados CORS apropiados
- [ ] **Caché**: Establece tiempos de caché largos para WASM y recursos estáticos (están versionados)
- [ ] **Compresión**: Habilita gzip/brotli para transferencias de archivos más rápidas
- [ ] **HTTPS**: Requerido para service workers y algunas características del navegador

<!-- ### Performance optimization -->

### Optimización de rendimiento

<!-- - [ ] **CDN**: Serve static assets from a CDN for faster global delivery -->
<!-- - [ ] **Pre-installed plugins**: Bundle frequently-used plugins in your WordPress build -->
<!-- - [ ] **Minimal blueprints**: Keep runtime plugin installations to a minimum -->

- [ ] **CDN**: Sirve recursos estáticos desde un CDN para entrega global más rápida
- [ ] **Plugins pre-instalados**: Empaqueta plugins de uso frecuente en tu build de WordPress
- [ ] **Blueprints mínimos**: Mantén las instalaciones de plugins en tiempo de ejecución al mínimo

<!-- ## Troubleshooting -->

## Solución de problemas

<!-- ### Common issues and solutions -->

### Problemas comunes y soluciones

<!-- #### Playground fails to load or shows blank screen -->

#### Playground no carga o muestra pantalla en blanco

<!-- **Possible causes:** -->

**Posibles causas:**

<!-- - Server doesn't serve WASM files with correct MIME type -->
<!-- - Deployment missing required files -->
<!-- - JavaScript errors in browser console -->

- El servidor no sirve archivos WASM con el tipo MIME correcto
- El despliegue no incluye archivos requeridos
- Errores de JavaScript en la consola del navegador

<!-- **Solutions:** -->

**Soluciones:**

<!-- 1. Check browser console for errors (F12 → Console tab) -->
<!-- 2. Verify `.wasm` files return `application/wasm` content type -->
<!-- 3. Verify you deployed all build files -->

1. Revisa la consola del navegador para errores (F12 → pestaña Consola)
2. Verifica que los archivos `.wasm` devuelven el tipo de contenido `application/wasm`
3. Verifica que desplegaste todos los archivos de construcción

<!-- #### Slow initial loading (30+ seconds) -->

#### Carga inicial lenta (30+ segundos)

<!-- **Possible causes:** -->

**Posibles causas:**

<!-- - Installing large plugins at runtime -->
<!-- - Missing CDN or caching configuration -->
<!-- - User on slow network connection -->

- Instalación de plugins grandes en tiempo de ejecución
- Falta configuración de CDN o caché
- Usuario con conexión de red lenta

<!-- **Solutions:** -->

**Soluciones:**

<!-- 1. Pre-install plugins in your WordPress build instead of runtime installation -->
<!-- 2. Configure CDN with proper caching headers -->
<!-- 3. Show loading indicators to set user expectations -->

1. Pre-instala plugins en tu build de WordPress en lugar de instalación en tiempo de ejecución
2. Configura CDN con encabezados de caché adecuados
3. Muestra indicadores de carga para establecer expectativas del usuario
