---
title: Usando Xdebug con PHP WASM - Introducción
slug: /developers/xdebug/introduction
description: Depura código PHP ejecutándose en WebAssembly dentro de WordPress Playground usando Xdebug, Chrome DevTools e integración con IDE.
---

# Usando Xdebug con PHP WASM

Xdebug es una extensión de depuración para PHP que te permite establecer puntos de interrupción, inspeccionar variables y recorrer tu código paso a paso. WordPress Playground incluye Xdebug en su PHP compilado para WebAssembly, por lo que puedes depurar código de WordPress que se ejecuta directamente en tu navegador o IDE.

## Por qué Xdebug es importante para PHP WASM

Depurar código PHP en WebAssembly es diferente de depurar PHP tradicional. Sin Xdebug, estás limitado a declaraciones `var_dump()` y `error_log()`. Xdebug te ofrece un depurador adecuado con puntos de interrupción, inspección de variables y navegación de la pila de llamadas: las mismas herramientas que usarías al depurar PHP en un servidor regular.

## XDebug en WordPress Playground

Para un inicio rápido, consulta la [guía de primeros pasos con Xdebug](/developers/xdebug/getting-started)

Aprenderás a depurar:

-   Lógica de procesamiento de formularios
-   Validación de entrada
-   Hooks y filtros de WordPress

## Dos enfoques de depuración

WordPress Playground admite dos formas de depurar con Xdebug:

**Chrome DevTools**: Depura directamente en tu navegador sin configuración de IDE. Excelente para sesiones rápidas de depuración o cuando quieres ver todo en un solo lugar.

**Integración con IDE**: Usa VSCode o PhpStorm con funciones completas de IDE como navegación de código, búsqueda en todo el proyecto y condiciones avanzadas de puntos de interrupción. Mejor para escenarios de depuración complejos.

Ambos métodos funcionan con la misma configuración de Xdebug. Incluso puedes usarlos simultáneamente. Elige lo que mejor se adapte a tu flujo de trabajo.

## Lo que necesitarás

-   Node.js instalado
-   Navegador Chrome o Chromium (para depuración con DevTools)
-   Visual Studio Code o PhpStorm (para depuración con IDE, opcional)
-   Conocimiento básico de desarrollo de plugins de WordPress

**Siguiente**: [Primeros Pasos con Xdebug →](/developers/xdebug/getting-started)
