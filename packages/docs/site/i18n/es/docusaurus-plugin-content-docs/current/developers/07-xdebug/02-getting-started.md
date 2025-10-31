---
title: Primeros Pasos con Xdebug
slug: /developers/xdebug/getting-started
description: Antes de poder comenzar a depurar, necesitas ejecutar WordPress Playground con Xdebug habilitado. Esta guía cubre lo básico.
---

# Primeros Pasos con Xdebug

Antes de poder comenzar a depurar, necesitas ejecutar WordPress Playground con Xdebug habilitado. Esta guía cubre lo básico.

## PHP WASM CLI vs Playground CLI

Tienes dos herramientas CLI para elegir:

**`@php-wasm/cli`**: Ejecuta scripts PHP independientes. Úsalo cuando estés depurando código PHP que no necesita WordPress.

**`@wp-playground/cli`**: Ejecuta una instalación completa de WordPress. Úsalo al depurar plugins de WordPress, temas o funcionalidades del núcleo.

Para depurar plugins de WordPress (que es lo que haremos en esta guía), usa Playground CLI.

## Inicio rápido con npx

La forma más rápida de comenzar es usar npx, que no requiere instalación:

```bash
npx @wp-playground/cli@latest server --xdebug
```

Esto inicia WordPress en `http://127.0.0.1:9400` con Xdebug habilitado. Ahora puedes conectar un depurador.

## Iniciando con DevTools

Para depurar con Chrome DevTools, agrega la bandera `--experimental-devtools`:

```bash
npx @wp-playground/cli@latest server --xdebug --experimental-devtools
```

La terminal mostrará una URL para conectar Chrome DevTools. Cubriremos la configuración completa en la [guía de depuración con Chrome DevTools](/developers/testing/xdebug/chrome-devtools).

## Iniciando con integración IDE

Para depurar con VSCode o PhpStorm, agrega la bandera `--experimental-unsafe-ide-integration`:

```bash
npx @wp-playground/cli@latest server --xdebug --experimental-unsafe-ide-integration
```

Esto configura automáticamente tu IDE para depuración. Consulta la [guía de depuración con IDE](/developers/testing/xdebug/ide-integration) para detalles.

## Instalación local (opcional)

Si prefieres instalar los paquetes localmente:

```bash
npm install @wp-playground/cli
```

Luego ejecuta:

```bash
npx @wp-playground/cli server --xdebug
```

## Próximos pasos

Ahora que tienes Playground ejecutándose con Xdebug, elige tu método de depuración:

-   [Depurar con Chrome DevTools](/developers/testing/xdebug/chrome-devtools) - Depuración basada en navegador
-   [Depurar con integración IDE](/developers/testing/xdebug/ide-integration) - VSCode o PhpStorm

Ambas guías usan el mismo plugin de ejemplo para que puedas seguir sin importar qué método elijas.

---

**Próximos pasos**:

-   [Depurar con Chrome DevTools →](/developers/testing/xdebug/chrome-devtools)
-   [Depurar con integración IDE →](/developers/testing/xdebug/ide-integration)
