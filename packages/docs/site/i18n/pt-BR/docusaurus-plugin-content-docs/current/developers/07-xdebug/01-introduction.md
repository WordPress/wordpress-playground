---
title: Usando Xdebug com PHP WASM - Introdução
slug: /developers/xdebug/introduction
description: Depure código PHP executando em WebAssembly no WordPress Playground usando Xdebug, Chrome DevTools e integração com IDE.
---

# Usando Xdebug com PHP WASM

Xdebug é uma extensão de depuração para PHP que permite definir pontos de parada, inspecionar variáveis e percorrer seu código passo a passo. O WordPress Playground inclui Xdebug em seu PHP compilado para WebAssembly, então você pode depurar código WordPress executando diretamente no seu navegador ou IDE.

## Por que Xdebug é importante para PHP WASM

Depurar código PHP em WebAssembly é diferente de depurar PHP tradicional. Sem Xdebug, você está limitado a declarações `var_dump()` e `error_log()`. Xdebug oferece um depurador adequado com pontos de parada, inspeção de variáveis e navegação da pilha de chamadas—as mesmas ferramentas que você usaria ao depurar PHP em um servidor regular.

## XDebug no WordPress Playground

Para um início rápido, confira o [guia de primeiros passos com Xdebug](/developers/xdebug/getting-started) es

Você aprenderá a depurar:

-   Lógica de processamento de formulários
-   Validação de entrada
-   Hooks e filtros do WordPress

## Duas abordagens de depuração

O WordPress Playground suporta duas maneiras de depurar com Xdebug:

**Chrome DevTools**: Depure diretamente no seu navegador sem configuração de IDE. Ótimo para sessões rápidas de depuração ou quando você quer ver tudo em um só lugar.

**Integração com IDE**: Use VSCode ou PhpStorm com recursos completos de IDE como navegação de código, busca em todo o projeto e condições avançadas de pontos de parada. Melhor para cenários de depuração complexos.

Ambos os métodos funcionam com a mesma configuração Xdebug. Você pode até usá-los simultaneamente. Escolha o que funciona melhor para o seu fluxo de trabalho.

## O que você precisará

-   Node.js instalado
-   Navegador Chrome ou Chromium (para depuração DevTools)
-   Visual Studio Code ou PhpStorm (para depuração IDE, opcional)
-   Familiaridade básica com desenvolvimento de plugins WordPress

**Próximo**: [Primeiros Passos com Xdebug →](/developers/xdebug/getting-started)
