# Asyncify

O [Asyncify](https://emscripten.org/docs/porting/asyncify.html) permite que código síncrono C ou C++ interaja com JavaScript assíncrono. Tecnicamente, ele salva toda a pilha de chamadas C antes de ceder o controle de volta ao JavaScript, e então a restaura quando a chamada assíncrona é finalizada. Isso é chamado de **troca de pilha**.

O suporte a rede na compilação WebAssembly do PHP é implementado usando Asyncify. Quando o PHP faz uma requisição de rede, ele cede o controle de volta ao JavaScript, que faz a requisição, e então retoma o PHP quando a resposta está pronta. Funciona bem o suficiente para que a compilação PHP possa solicitar APIs web, instalar pacotes composer, e até mesmo conectar a um servidor MySQL.

## Falhas do Asyncify

A troca de pilha requer o envolvimento de todas as funções C que podem ser encontradas em uma pilha de chamadas no momento de fazer uma chamada assíncrona. O envolvimento geral de cada função C adiciona uma sobrecarga **significativa**, por isso mantemos uma lista de nomes de funções específicas:

https://github.com/WordPress/wordpress-playground/blob/15a660940ee9b4a332965ba2a987f6fda0c159b1/packages/php-wasm/compile/Dockerfile#L624-L632

Infelizmente, faltar mesmo um único item dessa lista resulta em uma falha do WebAssembly sempre que essa função faz parte da pilha de chamadas quando uma chamada assíncrona é feita. Isso se parece com isto:

![Uma captura de tela de um erro de asyncify no terminal](@site/static/img/developers/asyncify-error.webp)

O Asyncify pode listar automaticamente todas as funções C necessárias quando compilado sem `ASYNCIFY_ONLY`, mas essa auto-detecção é muito ansiosa e acaba listando cerca de 70.000 funções C, o que aumenta o tempo de inicialização para 4,5s. Por isso mantemos a lista manualmente.

Se você estiver interessado em mais detalhes, [veja a issue do GitHub 251](https://github.com/WordPress/wordpress-playground/issues/251).

## Corrigindo falhas do Asyncify

O [Pull Request 253](https://github.com/WordPress/wordpress-playground/pull/253) adiciona um comando `fix-asyncify` que executa uma suíte de testes especializada e automaticamente adiciona quaisquer funções C ausentes identificadas à lista `ASYNCIFY_ONLY`.

Se você encontrar uma falha como a acima, pode corrigi-la:

1. Identificando um caminho de código PHP que aciona a falha – o rastreamento de pilha no terminal deve ajudar com isso.
2. Adicionando um caso de teste que aciona uma falha em `packages/php-wasm/node/src/test/php-asyncify.spec.ts`
3. Executando: `npm run fix-asyncify`
4. Fazendo commit do caso de teste, do Dockerfile atualizado e do PHP.wasm reconstruído

## A próxima API JSPI tornará o Asyncify desnecessário

Eventualmente, o [V8 provavelmente lidará com a troca de pilha para nós](https://github.com/WordPress/wordpress-playground/issues/134) e removerá esse problema completamente. A [Issue 134](https://github.com/WordPress/wordpress-playground/issues/134) rastreia o status desse esforço.

Aqui está [uma nota relevante](https://github.com/fgmccabe) de @fgmccabe:

> A implementação atual no V8 está essencialmente em 'status experimental'. Temos implementações arm64 e x64.
> Os próximos passos são implementar em arm/intel de 32 bits. Isso requer que resolvamos algumas questões que não precisamos resolver até agora.
> Quanto ao node.js, meu palpite é que já está no node, por trás de uma flag.
> Para remover o requisito da flag envolve obter outras implementações. A melhor estimativa para isso é no final deste ano; mas, obviamente, depende de recursos e financiamento.
> Além disso, seria necessário mais progresso no esforço de padronização; mas, dado que é uma especificação 'pequena', isso não deveria ser um fardo de longo prazo.
> Espero que isso ajude você a entender o roadmap :)
