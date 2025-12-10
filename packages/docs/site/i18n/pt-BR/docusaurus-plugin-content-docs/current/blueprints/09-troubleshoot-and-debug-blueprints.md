---
title: Solucionar problemas e depurar
slug: /blueprints/troubleshoot-and-debug
description: Um guia com dicas e ferramentas para ajudar você a solucionar problemas e depurar seus Blueprints, desde problemas comuns até ferramentas do navegador.
---

# Solucionar problemas e depurar Blueprints

Ao criar Blueprints, você pode enfrentar problemas. Aqui estão dicas e ferramentas para ajudar você a depurá-los:

## Revise os erros comuns

-   Exija `wp-load`: para executar uma função PHP do WordPress usando a etapa `runPHP`, você precisará exigir [wp-load.php](https://github.com/WordPress/WordPress/blob/master/wp-load.php). Portanto, o valor da chave `code` deve começar com `"<?php require_once('wordpress/wp-load.php'); RESTO_DO_SEU_CÓDIGO"`.

## Problemas e Soluções Comuns

### WP-CLI: Erro ao Estabelecer Conexão com Banco de Dados em Sites Montados

Ao usar `wp-cli` com um site Playground montado (por exemplo, via `--mount-before-install`), você pode encontrar um erro "Erro ao estabelecer conexão com banco de dados". Isso acontece porque o WordPress Playground carrega o plugin de integração do banco de dados SQLite a partir de seus arquivos internos por padrão, não do diretório montado, significando que não é persistido para chamadas externas de `wp-cli`.

Para resolver isso, você precisa instalar e configurar explicitamente o plugin de integração do banco de dados SQLite dentro de seu Blueprint.

**Solução:** Adicione as seguintes etapas ao seu Blueprint:

```json
{
	"plugins": [ "sqlite-database-integration" ]
}
```

**Exemplo de Uso:**

Para testar isso localmente, combine o Blueprint com seu comando Playground CLI:

```bash
mkdir wordpress
# Certifique-se de que seu blueprint com as etapas acima está salvo como, por exemplo, './blueprint.json'
npx @wp-playground/cli server --mount-before-install=wordpress:/wordpress --blueprint=./blueprint.json
cd wordpress
wp post list
```

Isso garantirá que o plugin SQLite seja instalado corretamente e configurado em seu site WordPress montado, permitindo que comandos `wp-cli` funcionem corretamente.

## Construtor de Blueprints

Você pode usar um [editor de Blueprints](https://playground.wordpress.net/builder/builder.html) no navegador para criar, validar e visualizar seus Blueprints.

:::danger Aviso

O editor está em desenvolvimento e o Playground incorporado às vezes falha ao carregar. Para contornar isso, atualize a página. Estamos cientes disso e trabalhando para melhorar a experiência.

:::

## Verificar o Sistema de Arquivos e Banco de Dados

Algumas etapas de blueprint (como [`writeFile`](/blueprints/steps#WriteFileStep)) alteram a estrutura interna do Sistema de Arquivos da instância Playground e outras (como [`runSql`](/blueprints/steps#runSql)) alteram o banco de dados interno do WordPress.

Para verificar a estrutura final do sistema de arquivos interno e do banco de dados (após as etapas do blueprint terem sido aplicadas), podemos aproveitar alguns plugins WordPress que fornecem um gerenciador SQL e um explorador de arquivos como [`SQL Buddy`](https://wordpress.org/plugins/sql-buddy/) e [`WPide`](https://wordpress.org/plugins/wpide/) (você pode vê-los em ação em https://playground.wordpress.net/?plugin=sql-buddy&plugin=wpide)

:::tip

Há vários métodos que podemos lançar a partir do console de qualquer instância do WordPress Playground para inspecionar os internos dessa instância. Eles são expostos como parte do objeto `window.playground` (veja [Desenvolvedores > API JavaScript > Depuração e teste](/developers/apis/javascript-api/#debugging-and-testing)). Alguns exemplos:

```
> await playground.isDir("/wordpress/wp-content/plugins")
true
> await playground.listFiles("/wordpress/wp-content/plugins")
(3) ['hello.php', 'index.php', 'WordPress-Importer-master']
```

A lista completa de métodos que podemos usar está disponível [aqui](/api/client/interface/PlaygroundClient)

:::

## Verificar erros no console do navegador

Se seu Blueprint não está sendo executado conforme esperado, abra as ferramentas de desenvolvedor do navegador para verificar se há erros.

Para abrir as ferramentas de desenvolvedor no Chrome, Firefox, Safari\* e Edge: pressione `Ctrl + Shift + I` no Windows/Linux ou `Cmd + Option + I` no macOS.

:::caution

Se você ainda não fez isso, ative o menu Desenvolvimento: vá para **Safari > Configurações... > Avançado** e marque **Mostrar recursos para desenvolvedores da web**.

:::

A janela de ferramentas de desenvolvedor permite inspecionar requisições de rede, visualizar logs do console, depurar JavaScript e examinar o DOM e estilos CSS aplicados à sua página. Isso é crucial para diagnosticar e corrigir problemas com Blueprints.

## Registre suas próprias mensagens de erro

Você pode usar `error_log` para suas próprias mensagens de erro através da [etapa `runPHP`](/blueprints/steps#RunPHPStep) (veja [exemplo de blueprint](https://github.com/wordpress/blueprints/blob/trunk/blueprints/reset-data-and-import-content/blueprint.json) e [demo ao vivo](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/reset-data-and-import-content/blueprint.json)) e verifique-os através da opção ["Ver Logs"](/web-instance#playground-options-menu) ou do console do navegador.

![Captura de tela de erros de log](@site/static/img/blueprints/log-errors.webp)

:::info
Quando você baixa sua instância do Playground como um `zip` através da opção ["Baixar como zip"](/web-instance#playground-options-menu), você também baixa o arquivo `debug.log` contendo todos os logs de sua instância do Playground.
:::

## Peça ajuda

A comunidade está aqui para ajudar! Se você tem perguntas ou comentários, [abra uma nova issue](https://github.com/adamziel/blueprints/issues) neste repositório. Lembre-se de incluir os seguintes detalhes:

-   O Blueprint que você está tentando executar.
-   A mensagem de erro que você está vendo, se houver.
-   A saída completa das ferramentas de desenvolvedor do navegador.
-   Qualquer outra informação relevante que possa nos ajudar a entender o problema: SO, versão do navegador, etc.
