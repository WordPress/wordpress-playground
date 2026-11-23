---
slug: /developers/architecture/browser-php-worker-threads
title: Worker Threads do PHP
description: Como o WordPress Playground executa o PHP em um web worker para não deixar lenta a interface do site principal.
---

<!-- # PHP Worker Threads -->

# Worker Threads do PHP

<!--
PHP is always ran in a [web worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) to ensure the PHP runtime doesn't slow down the user interface of the main website.
-->

O PHP sempre é executado em um [web worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API), para garantir que o ambiente de execução do PHP não deixe lenta a interface do site principal.

<!-- Imagine the following code: -->

Imagine o seguinte código:

```js
<button onclick="for(let i=0;i<100000000;i++>) {}">Freeze the page</button>
<input type="text" />
```

<!--
As soon as you click that button the browser will freeze and you won't be able to type in the input. That's just how browsers work. Whether it's a for loop or a PHP server, running intensive tasks slows down the user interface.
-->

Assim que você clica nesse botão, o navegador congela e você não consegue digitar no campo. É simplesmente assim que os navegadores funcionam. Seja um loop `for` ou um servidor PHP, executar tarefas pesadas deixa a interface lenta.

<!-- ### Initiating web workers -->

### Iniciando web workers {#initiating-web-workers}

<!--
Web workers are separate programs that can process heavy tasks outside of the main application. They must be initiated by the main JavaScript program living in the browser tab. Here's how:
-->

Web workers são programas separados que podem processar tarefas pesadas fora da aplicação principal. Eles precisam ser iniciados pelo programa JavaScript principal que roda na aba do navegador. Veja como:

```ts
const phpClient = consumeAPI<PHPClient>(
	spawnPHPWorkerThread(
		'/worker-thread.js' // Valid Worker script URL
	)
);
await phpClient.isReady();
await phpClient.run({ code: `<?php echo "Hello from the thread!";` });
```

<!-- ### Controlling web workers -->

### Controlando web workers {#controlling-web-workers}

<!--
Exchanging messages is the only way to control web workers. The main application has no access to functions or variables inside of a web worker. It can only send and receive messages using `worker.postMessage` and `worker.onmessage = function(msg) { }`.
-->

Trocar mensagens é a única forma de controlar web workers. A aplicação principal não tem acesso às funções nem às variáveis dentro de um web worker. Ela só pode enviar e receber mensagens usando `worker.postMessage` e `worker.onmessage = function(msg) { }`.

<!--
This can be tedious, which is why Playground provides a convenient [consumeAPI](/api/universal/function/consumeAPI) function that abstracts the message exchange and exposes specific functions from the web worker. This is why we can call `phpClient.run` in the example above.
-->

Isso pode ser trabalhoso, e por isso o Playground oferece a função [consumeAPI](/api/universal/function/consumeAPI), que abstrai a troca de mensagens e expõe funções específicas do web worker. É por isso que podemos chamar `phpClient.run` no exemplo acima.
