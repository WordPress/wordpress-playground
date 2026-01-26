---
title: Instância Web
slug: /web-instance
description: Um guia detalhado da interface web em playground.wordpress.net, cobrindo a barra de ferramentas, configurações e o gerenciador de instâncias.
---

# Instância web do WordPress Playground {#wordpress-playground-web-instance}

[https://playground.wordpress.net/](https://playground.wordpress.net/) permite que desenvolvedores executem WordPress em um navegador sem um servidor. Este ambiente torna o teste de plugins, temas e recursos rápido e fácil.

Algumas características principais:

- **Baseado em navegador**: Não requer configuração de servidor local.
- **Configuração instantânea**: Execute WordPress com um único clique.
- **Ambiente de teste**: Ideal para testar plugins e temas.

A [API de Parâmetros de Consulta](/developers/apis/query-api/) permite carregar diretamente configurações específicas em uma instância do Playground. Isso inclui definir uma versão específica do WordPress, tema ou plugin. Você também pode definir configurações mais complexas usando blueprints (veja [exemplos aqui](/quick-start-guide#try-a-block-a-theme-or-a-plugin)).

O site do Playground inclui barras de ferramentas que personalizam sua instância e fornecem acesso rápido a recursos e utilitários.

![Playground Toolbar Snapshot](@site/static/img/about/playground-toolbar.webp)

## Personalizar Playground {#customize-playground}

Na barra de ferramentas, você encontrará:

- **Configurações do Playground**: Um painel para configurar sua instância atual, como versões do PHP e WordPress.
- **Painel do Playground**: Este painel permite gerenciar instâncias do WordPress Playground, salvá-las, exportá-las, editar arquivos da sua instância WordPress e criar novos Blueprints.
- **Painel de Lançamento do Playground**: O Painel de Lançamento mostra todas as formas de iniciar uma instância do WordPress Playground.

### Configurações do Playground {#playground-settings}

![snapshot of customize Playground window at Playground instance](@site/static/img/about/playground-settings-panel.webp)

O **Painel de Configurações do Playground** inclui estas [opções da API de Consulta](/developers/apis/query-api#available-options):

- `wp`: Define a versão do WordPress.
- `php`: Especifica a versão do PHP para a instância.
- `language`: Define o idioma da instância WordPress.
- `multisite`: Habilita o suporte ao WordPress multisite.
- `networking`: Habilita o acesso à rede para o Diretório de Plugins do WordPress e APIs do WordPress.

## Gerenciador do Playground {#playground-manager}

![Playground settings panel allow users to save export and edit the WordPress directly](@site/static/img/about/playground-dashboard.webp)

Este painel permite gerenciar instâncias do Playground e fornece acesso aos seguintes painéis:

- **Configurações**: Para gerenciar as configurações do Playground atual
- **Navegador de Arquivos**: IDE integrada para editar arquivos, fazer upload de plugins e temas, e edição ao vivo. O Playground recarrega automaticamente as alterações em tempo real.
- **Blueprint**: Um editor de Blueprint para criar, salvar e executar Blueprints na sua instância web do Playground.
- **Banco de Dados**: Ferramentas para gerenciar o banco de dados com Adminer e phpMyAdmin, e baixar como arquivo `.sqlite`.
- **Logs**: Exibe mensagens de log quando algo dá errado.

![Save Playground Button](@site/static/img/about/playground-dashboard-save.webp)

Clique em "Salvar" para criar uma instância e listá-la no Painel de Lançamento do Playground. O Painel do Playground também oferece opções de exportação e download através do menu de Ações adicionais:

### Menu de ações adicionais {#additional-actions-menu}

![Additional actions Menu](@site/static/img/about/additional-options-playground-dashboard.webp)

- **Exportar Pull Request para GitHub**: Exporte plugins WordPress, temas e diretórios wp-content inteiros como pull requests para qualquer repositório GitHub público. Assista a uma [demonstração desta funcionalidade](https://www.youtube.com/watch?v=gKrij8V3nK0&t=2488s).
- **Baixar como .zip**: Cria um arquivo `.zip` com a configuração da instância do Playground, incluindo quaisquer temas ou plugins instalados. Este `.zip` não inclui conteúdo e alterações do banco de dados.

### Editor de Blueprint {#blueprint-editor}

![Blueprint editor WordPress Playground](@site/static/img/about/playground-blueprint-editor.webp)

O editor de Blueprint substituiu o antigo construtor de Blueprint, oferecendo a capacidade de gerenciar múltiplos Blueprints e validação de código.

### Painel de Lançamento do Playground {#launch-playground-panel}

![Playground Launch Panel](@site/static/img/dashboard/import-playground.webp)

Este painel mostra todas as formas de lançar o WordPress Playground: importar arquivos `.zip`, carregar de repositórios GitHub e visualizar PRs do WordPress core e Gutenberg.

O Painel de Lançamento também lista mais de 40 blueprints da Galeria de Blueprints e seus Playgrounds Salvos.

:::caution

O site em https://playground.wordpress.net está lá para apoiar a comunidade, mas não há garantias de que continuará funcionando se o tráfego crescer significativamente.

Se você precisa de certa disponibilidade, deve [hospedar seu próprio WordPress Playground](/developers/architecture/host-your-own-playground).
:::
