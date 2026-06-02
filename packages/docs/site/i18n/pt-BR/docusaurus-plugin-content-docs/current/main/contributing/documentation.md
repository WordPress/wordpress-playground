---
slug: /contributing/documentation
title: Contribuições para a documentação
description: Um guia sobre como contribuir para a documentação do Playground, desde abrir issues até enviar pull requests.
---

<!--
# Documentation contributions
-->

# Contribuições para a documentação

<!--
[WordPress Playground's documentation site](/) is maintained by volunteers like you, who'd love your help.
-->

O [site de documentação do WordPress Playground](/) é mantido por voluntários como você, que adorariam sua ajuda.

<!--
All documentation-related issues are labeled [`[Type] Documentation`](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22%5BType%5D%20Documentation%22) or [`[Type] Developer Documentation`](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22%5BType%5D%20Developer%20Documentation%22) in the [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) repository. Browse the list of open issues to find one you'd like to work on. Alternatively, if you believe something is missing from the current documentation, open an issue to discuss your suggestion.
-->

Todas as issues relacionadas à documentação são rotuladas como [`[Type] Documentation`](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22%5BType%5D%20Documentation%22) ou [`[Type] Developer Documentation`](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22%5BType%5D%20Developer%20Documentation%22) no repositório [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground). Navegue pela lista de issues abertas para encontrar uma na qual você gostaria de trabalhar. Alternativamente, se você acredita que algo está faltando na documentação atual, abra uma issue para discutir sua sugestão.

<!--
## How can I contribute?
-->

## Como posso contribuir?

<!--
You can contribute by [opening an issue in the project repository](https://github.com/WordPress/wordpress-playground/issues/new) and describing what you'd like to add or change.
-->

Você pode contribuir [abrindo uma issue no repositório do projeto](https://github.com/WordPress/wordpress-playground/issues/new) e descrevendo o que você gostaria de adicionar ou alterar.

<!--
If you feel up to it, write the content in the issue description, and the project contributors will take care of the rest.
-->

Se você se sentir à vontade, escreva o conteúdo na descrição da issue, e os contribuidores do projeto cuidarão do resto.

<!--
Would you like to see the documentation in your language? Check the [Translation section](/contributing/translations).
-->

Gostaria de ver a documentação no seu idioma? Confira a [seção de Traduções](/contributing/translations).

<!--
### Forking the repo, edit files locally and opening Pull Requests
-->

### Fazer fork do repositório, editar arquivos localmente e abrir Pull Requests

<!--
If you are familiar with markdown, you can [fork](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/fork-a-repo) the `wordpress-playground` repo and propose changes and new documentation pages by submitting a Pull Request.
-->

Se você está familiarizado com markdown, pode [fazer um fork](https://docs.github.com/pt/pull-requests/collaborating-with-pull-requests/working-with-forks/fork-a-repo) do repositório `wordpress-playground` e propor alterações e novas páginas de documentação enviando um Pull Request.

<!--
The process of creating a branch to open new PRs with translated pages on the [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) repository is the same than contributing to other WordPress repositories such as gutenberg:
https://developer.wordpress.org/block-editor/contributors/code/git-workflow/
-->

O processo de criação de uma branch para abrir novos PRs com páginas traduzidas no repositório [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) é o mesmo que contribuir para outros repositórios do WordPress, como o gutenberg:
https://developer.wordpress.org/block-editor/contributors/code/git-workflow/

<!--
The documentation files (`.md` files) are stored in Playground's GitHub repository, [under `/packages/docs/site/docs`](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/docs).
-->

Os arquivos de documentação (arquivos `.md`) são armazenados no repositório GitHub do Playground, [em `/packages/docs/site/docs`](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/docs) para versão em inglês e [`/packages/docs/site/i18n`](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/i18n) para outros idiomas.

<!--
### Edit in the browser
-->

### Editar no navegador

<!--
If logged in GitHub, you can also edit existing files (or add new ones) and submit a PR directly from the GitHub UI:
-->

Se estiver logado no GitHub, você também pode editar arquivos existentes (ou adicionar novos) e enviar um PR diretamente da interface do GitHub:

<!--
1. Find the page you'd like to edit or the directory of the chapter you'd like to add a new page to.
2. Click the **Add Files** button to add a new file, or click on an existing file and then click the pencil icon to edit it.
3. GitHub will ask you to fork the repository and create a new branch with your changes.
4. An editor will open where you can make the changes.
5. When you're done, click the **Commit Changes** button and submit a Pull Request.
-->

1. Encontre a página que você gostaria de editar ou o diretório do capítulo ao qual você gostaria de adicionar uma nova página.
2. Clique no botão **Add Files** para adicionar um novo arquivo, ou clique em um arquivo existente e depois no ícone de lápis para editá-lo.
3. O GitHub solicitará que você faça um fork do repositório e crie uma nova branch com suas alterações.
4. Um editor será aberto onde você pode fazer as alterações.
5. Quando terminar, clique no botão **Commit Changes** e envie um Pull Request.

<!--
That's it! You've just contributed to the WordPress Playground documentation.
-->

É isso! Você acabou de contribuir para a documentação do WordPress Playground.

<!--
This approach means you don't need to clone the repository, set up a local development environment, or run any commands.
-->

Esta abordagem significa que você não precisa clonar o repositório, configurar um ambiente de desenvolvimento local ou executar nenhum comando.

<!--
The downside is that you won't be able to preview your changes. Keep reading to learn how to review your changes before submitting a Pull Request.
-->

A desvantagem é que você não poderá visualizar suas alterações. Continue lendo para aprender como revisar suas alterações antes de enviar um Pull Request.

<!--
### Local preview
-->

### Pré-visualização local

<!--
Clone the repository and navigate to the directory on your device. Now run the following commands:
-->

Clone o repositório e navegue para o diretório em seu dispositivo. Agora execute os seguintes comandos:

```bash
npm install
npm run build:docs
npm run dev:docs
```

<!--
The documentation site opens in a new browser tab and refreshes automatically with each change. Continue to edit the relevant file in your code editor and test the changes in real-time.
-->

O site da documentação abrirá em uma nova aba do navegador e será atualizado automaticamente a cada alteração. Continue a editar o arquivo relevante em seu editor de código e teste as alterações em tempo real.
