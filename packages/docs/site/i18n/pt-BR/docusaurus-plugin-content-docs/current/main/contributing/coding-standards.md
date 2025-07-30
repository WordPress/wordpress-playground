---
slug: /contributing/coding-standards
---

<!--
# Coding principles
-->

# Princípios de codificação

<!--
## Error messages
-->

## Mensagens de erro

<!--
A good error message informs the user of the following steps to take. Any ambiguity in errors thrown by Playground public APIs will prompt the developers to open issues.
-->

Uma boa mensagem de erro informa o usuário sobre os próximos passos a serem seguidos. Qualquer ambiguidade nos erros lançados pelas APIs públicas do Playground levará os desenvolvedores a abrir issues.

<!--
Consider a network error, for example—can we infer the type of error and display a relevant message summarizing the next steps?
-->

Considere um erro de rede, por exemplo: podemos inferir o tipo de erro e exibir uma mensagem relevante resumindo os próximos passos?

<!--
-   **Network error**: "Your internet connection twitched. Try to reload the page.
-   **404**: "Could not find the file".
-   **403**: "The server blocked access to the file".
-   **CORS**: clarify it's a browser security feature and add a link to a detailed explanation (on MDN or another reliable source). Suggest the user move their file somewhere else, like `raw.githubusercontent.com`, and link to a resource explaining how to set up CORS headers on their servers.
-->

-   **Erro de rede**: "Sua conexão com a internet oscilou. Tente recarregar a página."
-   **404**: "Não foi possível encontrar o arquivo".
-   **403**: "O servidor bloqueou o acesso ao arquivo".
-   **CORS**: esclareça que é um recurso de segurança do navegador e adicione um link para uma explicação detalhada (no MDN ou outra fonte confiável). Sugira que o usuário mova o arquivo para outro lugar, como `raw.githubusercontent.com`, e adicione um link para um recurso explicando como configurar os cabeçalhos CORS em seus servidores.

<!--
We handle code formatting and linting automatically. Relax, type away, and let the machines do the work.
-->

Nós lidamos com a formatação de código e o linting automaticamente. Relaxe, digite e deixe as máquinas fazerem o trabalho.

<!--
## Public API
-->

## API Pública

<!--
Playground aims to keep the narrowest possible API scope.
-->

O Playground visa manter o escopo de API o mais restrito possível.

<!--
Public APIs are easy to add and hard to remove. It only takes one PR to introduce a new API, but it may take a thousand to remove it, especially if other projects have already consumed it.
-->

APIs públicas são fáceis de adicionar e difíceis de remover. Basta um PR para introduzir uma nova API, mas pode ser necessário mil para removê-la, especialmente se outros projetos já a consumiram.

<!--
-   Don't expose unnecessary functions, classes, constants, or other components.
-->

-   Não exponha funções, classes, constantes ou outros componentes desnecessários.

<!--
## Blueprints
-->

## Blueprints

<!--
Blueprints are the primary way to interact with Playground. These JSON files describe a set of steps that Playground executes in order.
-->

Blueprints são a principal forma de interagir com o Playground. Estes arquivos JSON descrevem um conjunto de passos que o Playground executa em ordem.

<!--
### Guidelines
-->

### Diretrizes

<!--
Blueprint steps should be **concise and focused**. They should do one thing and do it well.
-->

Os passos de um Blueprint devem ser **concisos e focados**. Devem fazer uma coisa e fazê-la bem.

<!--
-   If you need to create a new step, try refactoring an existing one first.
-   If that's not enough, ensure the new step delivers a new capability. Don't replicate the functionality of existing steps.
-   Assume the step would be called more than once.
-   Assume it would run in a specific order.
-   Add unit tests to verify that.
-->

-   Se precisar criar um novo passo, tente refatorar um existente primeiro.
-   Se isso não for suficiente, garanta que o novo passo ofereça uma nova capacidade. Não replique a funcionalidade de passos existentes.
-   Suponha que o passo será chamado mais de uma vez.
-   Suponha que ele será executado em uma ordem específica.
-   Adicione testes unitários para verificar isso.

<!--
Blueprints should be **intuitive and straightforward**.
-->

Blueprints devem ser **intuitivos e diretos**.

<!--
-   Don't require arguments that can be optional.
-   Use plain argument. For example, `slug` instead of `path`.
-   Define constants in virtual JSON files—don't modify PHP files.
-   Define a TypeScript type for the Blueprint. That's how Playground generates its JSON schema.
-   Write a function to handle a Blueprint step. Accept the argument of the type you defined.
-   Provide a usage example in the doc string. It's automatically reflected in the docs.
-->

-   Não exija argumentos que possam ser opcionais.
-   Use argumentos simples. Por exemplo, `slug` em vez de `path`.
-   Defina constantes em arquivos JSON virtuais—não modifique arquivos PHP.
-   Defina um tipo TypeScript para o Blueprint. É assim que o Playground gera seu esquema JSON.
-   Escreva uma função para lidar com um passo do Blueprint. Aceite o argumento do tipo que você definiu.
-   Forneça um exemplo de uso na doc string. Ele é refletido automaticamente nos documentos.
