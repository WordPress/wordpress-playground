---
title: Trace e profiling com Xdebug
slug: /developers/xdebug/trace-and-profile
description: Grave traces de funções e perfis cachegrind do Xdebug no WordPress Playground e leia-os no Speedscope, no KCachegrind ou na sua IDE.
---

<!-- # Tracing and Profiling with Xdebug -->

# Trace e profiling com Xdebug

<!-- Besides the step debugger, Xdebug can record what your code did after the fact: -->

Além do depurador passo a passo, o Xdebug pode gravar o que o seu código fez, para você analisar depois:

<!--
- **`trace` mode** writes every function call, argument, and timing to a `trace.*.xt` file.
- **`profile` mode** writes a cachegrind file you can open in [Speedscope](https://www.speedscope.app/), KCachegrind, QCachegrind, or PhpStorm.
-->

- **O modo `trace`** grava cada chamada de função, argumento e tempo em um arquivo `trace.*.xt`.
- **O modo `profile`** grava um arquivo cachegrind que você pode abrir no [Speedscope](https://www.speedscope.app/), no KCachegrind, no QCachegrind ou no PhpStorm.

<!--
When started with `--xdebug`, Playground enables the `debug` and `develop`
modes by default. Use `--php-ini` to enable additional modes or change any
[php.ini setting](https://www.php.net/manual/en/ini.list.php), including
[Xdebug settings](https://xdebug.org/docs/all_settings). Values passed this way
override both Playground's and Xdebug's defaults.
-->

Quando iniciado com `--xdebug`, o Playground habilita os modos `debug` e `develop`
por padrão. Use `--php-ini` para habilitar outros modos ou alterar qualquer
[configuração do php.ini](https://www.php.net/manual/en/ini.list.php), incluindo as
[configurações do Xdebug](https://xdebug.org/docs/all_settings). Os valores passados dessa forma
substituem os padrões do Playground e do Xdebug.

<!-- ## Recording a trace and a profile -->

## Gravando um trace e um profile {#recording-a-trace-and-a-profile}

<!--
Trace and profile files are written to `xdebug.output_dir`, which is a path in
Playground's virtual filesystem. Mount a directory of your own there so the
files survive after the request ends:
-->

Os arquivos de trace e de profile são gravados em `xdebug.output_dir`, que é um caminho no
sistema de arquivos virtual do Playground. Monte ali um diretório seu para que os
arquivos continuem existindo depois que a requisição terminar:

```bash
mkdir -p ./xdebug-output

npx @wp-playground/cli@latest server \
	--xdebug \
	--mount ./xdebug-output:/xdebug-output \
	--php-ini xdebug.mode debug,develop,trace,profile \
	--php-ini xdebug.start_with_request trigger \
	--php-ini xdebug.output_dir /xdebug-output \
	--php-ini xdebug.trace_output_name trace.%u.%p \
	--php-ini xdebug.profiler_output_name cachegrind.out.%u.%p
```

<!-- Then request the page you want to measure with the `XDEBUG_TRIGGER` parameter: -->

Em seguida, faça uma requisição à página que você quer medir com o parâmetro `XDEBUG_TRIGGER`:

```bash
curl "http://127.0.0.1:9400/wp-json/wp/v2/posts?XDEBUG_TRIGGER=1"
```

<!--
`./xdebug-output` now holds one `trace.*.xt` file and one `cachegrind.out.*`
file for that request. Drop the cachegrind file into Speedscope to see where
the time went, and open the trace file in your editor to follow the call path.
-->

Agora `./xdebug-output` contém um arquivo `trace.*.xt` e um arquivo `cachegrind.out.*`
dessa requisição. Arraste o arquivo cachegrind para o Speedscope para ver onde
o tempo foi gasto, e abra o arquivo de trace no seu editor para acompanhar o caminho das chamadas.

<!-- ### Record on demand, not on every request -->

### Grave sob demanda, não em todas as requisições {#record-on-demand-not-on-every-request}

<!--
`xdebug.start_with_request=trigger` is the setting that makes recording opt-in.
Nothing is written until a request carries `XDEBUG_TRIGGER` as a `GET`
parameter, a `POST` parameter, or a cookie.
-->

`xdebug.start_with_request=trigger` é a configuração que torna a gravação opcional.
Nada é gravado até que uma requisição traga `XDEBUG_TRIGGER` como parâmetro `GET`,
parâmetro `POST` ou cookie.

<!--
This matters because the files are large. One WordPress front-page request
produces a trace of about 135 MB and a cachegrind file of about 22 MB. With
`xdebug.start_with_request=yes`, every request, including every admin-ajax
and REST call your browser makes, writes both files.
-->

Isso importa porque os arquivos são grandes. Uma requisição à página inicial do WordPress
gera um trace de cerca de 135 MB e um arquivo cachegrind de cerca de 22 MB. Com
`xdebug.start_with_request=yes`, toda requisição, incluindo cada chamada admin-ajax
e REST que o seu navegador faz, grava os dois arquivos.

<!--
The trigger also starts the step debugger, so a Playground started this way
only connects to your IDE on triggered requests.
-->

O gatilho também inicia o depurador passo a passo, então um Playground iniciado dessa forma
só se conecta à sua IDE nas requisições que trazem o gatilho.

<!-- ### Give every recording its own file name -->

### Dê a cada gravação um nome de arquivo próprio {#give-every-recording-its-own-file-name}

<!--
By default, Xdebug can give two recordings the same file name, so a new
request can overwrite an earlier one. See
[`xdebug.trace_output_name`](https://xdebug.org/docs/all_settings#trace_output_name)
and
[`xdebug.profiler_output_name`](https://xdebug.org/docs/all_settings#profiler_output_name)
for the default names.
-->

Por padrão, o Xdebug pode dar o mesmo nome de arquivo a duas gravações, e uma nova
requisição pode sobrescrever uma anterior. Veja
[`xdebug.trace_output_name`](https://xdebug.org/docs/all_settings#trace_output_name)
e
[`xdebug.profiler_output_name`](https://xdebug.org/docs/all_settings#profiler_output_name)
para conhecer os nomes padrão.

<!--
Adding `%u` (timestamp with microseconds) to `xdebug.trace_output_name` and
`xdebug.profiler_output_name` keeps one file per request, as in the command
above. Running with `--workers=1` also keeps the output predictable.
-->

Acrescentar `%u` (horário com microssegundos) a `xdebug.trace_output_name` e
`xdebug.profiler_output_name` mantém um arquivo por requisição, como no comando
acima. Rodar com `--workers=1` também deixa a saída previsível.

<!-- ## Using the library API -->

## Usando a API da biblioteca {#using-the-library-api}

<!--
PHP reads `php.ini` before extension-specific ini files, so settings in
`xdebug.ini` take precedence over matching settings in `php.ini`. The
Playground CLI writes `xdebug.*` entries to `xdebug.ini` and all other entries
to `php.ini`. When using `@php-wasm/node` directly, pass the Xdebug ini path to
`setPhpIniEntries()`:
-->

O PHP lê o `php.ini` antes dos arquivos ini específicos de cada extensão, então as configurações do
`xdebug.ini` têm prioridade sobre as configurações equivalentes do `php.ini`. O
Playground CLI grava as entradas `xdebug.*` no `xdebug.ini` e todas as outras entradas
no `php.ini`. Ao usar o `@php-wasm/node` diretamente, passe o caminho do ini do Xdebug para
`setPhpIniEntries()`:

```ts
import { PHP, PHP_EXTENSIONS_DIR, setPhpIniEntries } from '@php-wasm/universal';
import { joinPaths } from '@php-wasm/util';
import { mkdirSync } from 'node:fs';
import { loadNodeRuntime, createNodeFsMountHandler } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.5', { extensions: ['xdebug'] }));

await setPhpIniEntries(
	php,
	{
		'xdebug.mode': 'debug,develop,trace,profile',
		'xdebug.start_with_request': 'trigger',
		'xdebug.output_dir': '/xdebug-output',
		'xdebug.trace_output_name': 'trace.%u.%p',
		'xdebug.profiler_output_name': 'cachegrind.out.%u.%p',
	},
	joinPaths(PHP_EXTENSIONS_DIR, 'xdebug.ini')
);

mkdirSync('./xdebug-output', { recursive: true });
await php.mount('/xdebug-output', createNodeFsMountHandler('./xdebug-output'));
```

<!--
Call `setPhpIniEntries()` before the first request runs. PHP parses the ini
files once, on the first run, and ignores every later write.
-->

Chame `setPhpIniEntries()` antes da primeira requisição. O PHP lê os arquivos ini
uma única vez, na primeira execução, e ignora qualquer gravação posterior.

<!--
Without the third argument, `setPhpIniEntries()` writes `php.ini`, and the
entries an extension ships keep winning over it. An entry you do not set
keeps its default value.
-->

Sem o terceiro argumento, `setPhpIniEntries()` grava no `php.ini`, e as
entradas que uma extensão traz continuam tendo prioridade sobre ele. Uma entrada que você não define
mantém o valor padrão.

<!-- ## Starting a trace from PHP -->

## Iniciando um trace pelo PHP {#starting-a-trace-from-php}

<!-- Xdebug's own functions work too, and they need no trigger: -->

As próprias funções do Xdebug também funcionam, e não precisam de gatilho:

```php
xdebug_start_trace('/xdebug-output/checkout');
do_the_slow_thing();
xdebug_stop_trace();
```

<!--
This is the narrowest option. It records one block of code instead of a whole
request, which keeps the trace file small enough to read by hand.
-->

Esta é a opção mais focada. Ela grava um trecho de código em vez de uma requisição
inteira, o que mantém o arquivo de trace pequeno o bastante para ser lido à mão.
