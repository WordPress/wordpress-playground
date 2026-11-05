---
slug: /developers/architecture/host-your-own-playground
---

<!-- # Host your own Playground -->

# Hospede seu próprio Playground

<!-- You can host the Playground on your own domain instead of `playground.wordpress.net`. -->

Você pode hospedar o Playground no seu próprio domínio ao invés de `playground.wordpress.net`.

<!-- This is useful for having full control over its content and behavior, as well as removing dependency on a third-party server. It can provide a more customized user experience, for example: a playground with preinstalled plugins and themes, default site settings, or demo content. -->

Isso é útil para ter controle total sobre seu conteúdo e comportamento, assim como remover a dependência de um servidor de terceiros. Pode fornecer uma experiência de usuário mais personalizada, por exemplo: um playground com plugins e temas pré-instalados, configurações padrão do site ou conteúdo de demonstração.

<!-- ## Before you start -->

## Antes de começar

<!-- Self-hosting Playground gives you full control, but requires understanding a few key concepts: -->

Hospedar o Playground por conta própria dá controle total, mas requer entender alguns conceitos-chave:

<!-- ### What to expect -->

### O que esperar

<!-- - **Initial setup complexity**: Building and deploying Playground involves multiple steps. Allow time for troubleshooting during your first deployment. -->
<!-- - **Static file hosting**: Playground is primarily static files (HTML, JS, WASM) with minimal server-side requirements. -->
<!-- - **Browser-based execution**: All WordPress processing happens in the user's browser via WebAssembly—your server only delivers files. -->

- **Complexidade de configuração inicial**: Construir e implantar o Playground envolve múltiplas etapas. Reserve tempo para solução de problemas durante sua primeira implantação.
- **Hospedagem de arquivos estáticos**: O Playground é principalmente arquivos estáticos (HTML, JS, WASM) com requisitos mínimos do lado do servidor.
- **Execução baseada em navegador**: Todo o processamento do WordPress acontece no navegador do usuário via WebAssembly—seu servidor apenas entrega arquivos.

<!-- ### Performance considerations -->

### Considerações de desempenho

<!-- Loading times depend on several factors: -->

Os tempos de carregamento dependem de vários fatores:

<!-- | Factor            | Impact                                                              | Optimization                                | -->
<!-- | ----------------- | ------------------------------------------------------------------- | ------------------------------------------- | -->
<!-- | **Plugin size**   | Large plugins (e.g., WooCommerce) can take 30-60 seconds to install | Pre-install plugins in your WordPress build | -->
<!-- | **Network speed** | WASM files are ~15-30MB                                             | Use CDN with proper caching headers         | -->
<!-- | **Browser**       | Chrome/Edge perform best; Safari uses fallback mechanisms           | Test across browsers                        | -->
<!-- | **Device**        | Mobile devices load slower than desktop                             | Warn mobile users about longer load times   | -->

| Fator                  | Impacto                                                               | Otimização                                          |
| ---------------------- | --------------------------------------------------------------------- | --------------------------------------------------- |
| **Tamanho do plugin**  | Plugins grandes (ex. WooCommerce) podem levar 30-60 seg para instalar | Pré-instale plugins no seu build do WordPress       |
| **Velocidade da rede** | Arquivos WASM têm ~15-30MB                                            | Use CDN com headers de cache apropriados            |
| **Navegador**          | Chrome/Edge têm melhor desempenho; Safari usa mecanismos de fallback  | Teste em diferentes navegadores                     |
| **Dispositivo**        | Dispositivos móveis carregam mais devagar que desktop                 | Avise usuários móveis sobre tempos de carga maiores |

<!-- ### Browser compatibility -->

### Compatibilidade com navegadores

<!-- Playground works across modern browsers, but with some differences: -->

O Playground funciona em navegadores modernos, mas com algumas diferenças:

<!-- | Browser         | Status              | Notes                                                                              | -->
<!-- | --------------- | ------------------- | ---------------------------------------------------------------------------------- | -->
<!-- | Chrome/Edge     | ✅ Best performance | Full support for all features                                                      | -->
<!-- | Firefox         | ✅ Good             | Reliable performance                                                               | -->
<!-- | Safari          | ✅ Good             | Recent improvements significantly enhanced reliability                             | -->
<!-- | Mobile browsers | ⚠️ Limited          | Works, but with higher memory usage, and a 4G connection can impact the experience | -->

| Navegador          | Status               | Notas                                                                                |
| ------------------ | -------------------- | ------------------------------------------------------------------------------------ |
| Chrome/Edge        | ✅ Melhor desempenho | Suporte completo para todas as funcionalidades                                       |
| Firefox            | ✅ Bom               | Desempenho confiável                                                                 |
| Safari             | ✅ Bom               | Melhorias recentes aumentaram significativamente a confiabilidade                    |
| Navegadores móveis | ⚠️ Limitado          | Funciona, mas com maior uso de memória, e uma conexão 4G pode impactar a experiência |

<!-- **Technical note**: Safari uses MessagePorts instead of SharedArrayBuffer for streaming responses. This fallback works reliably but adds slight overhead compared to Chrome/Edge. -->

**Nota técnica**: O Safari usa MessagePorts ao invés de SharedArrayBuffer para respostas em streaming. Este mecanismo de fallback funciona de forma confiável mas adiciona uma pequena sobrecarga comparado ao Chrome/Edge.

<!-- ## Usage -->

## Uso

<!-- A self-hosted Playground can be embedded as an iframe. -->

Um Playground auto-hospedado pode ser incorporado como um iframe.

```html
<iframe src="https://my-playground.com"></iframe>
```

<!-- Or dynamically loaded by passing the remote URL to the [Playground Client](/developers/apis/javascript-api/playground-api-client). -->

Ou carregado dinamicamente passando a URL remota para o [Cliente Playground](/developers/apis/javascript-api/playground-api-client).

```ts
import { startPlaygroundWeb } from '@wp-playground/client';

const client = await startPlaygroundWeb({
	iframe: document.getElementById('wp'),
	remoteUrl: `https://my-playground.com/remote.html`,
});
```

<!-- ## Static assets -->

## Recursos estáticos {#static-assets}

<!-- Build the browser website from source to host it on your own domain. This does
not require a GitHub Actions artifact. The `@wp-playground/client` npm package
connects your app to an already hosted browser runtime. The
`@wp-playground/cli` npm package runs WordPress locally with Node.js. Neither
installs the browser website and its Dock. -->

Compile o site do Playground a partir do código-fonte para hospedá-lo no seu próprio domínio. Isso não exige um artefato do GitHub Actions. O pacote npm `@wp-playground/client` conecta sua aplicação a um ambiente de execução no navegador já hospedado. O pacote npm `@wp-playground/cli` executa o WordPress localmente com Node.js. Nenhum deles instala o site do Playground e seu Dock.

<!-- The [Deploy Playground website workflow](https://github.com/WordPress/wordpress-playground/actions/workflows/deploy-website.yml)
produces a temporary artifact for the public deployment. It expires, and the
build is configured to render WordPress on `wpsandbox.wordpress.net`. Use the
source build below for another domain, even if the artifact is still available.
Running the deploy workflow in a fork without the deployment secrets skips
the build, too. -->

O [fluxo de trabalho Deploy Playground website](https://github.com/WordPress/wordpress-playground/actions/workflows/deploy-website.yml) produz um artefato temporário para a implantação pública. Ele expira, e a compilação é configurada para exibir o WordPress em `wpsandbox.wordpress.net`. Para outro domínio, compile a partir do código-fonte seguindo as instruções abaixo, mesmo que o artefato ainda esteja disponível. Executar o fluxo de implantação em um fork sem os segredos de implantação também faz com que a compilação seja ignorada.

<!-- ### Build locally -->

### Compilar localmente {#build-locally}

<!-- Create a shallow clone of the Playground repository or your own fork. The
command below uses the latest development source on `trunk`. To pin the
Playground source to a specific version, replace `trunk` with a tag from the
[releases page](https://github.com/WordPress/wordpress-playground/releases).
The tag does not make the build reproducible: the build downloads
`wp-cli.phar` from the `wp-cli/builds` repository's `gh-pages` branch, which
can change between builds. -->

Crie um clone superficial do repositório do Playground ou do seu próprio fork. O comando abaixo usa o código de desenvolvimento mais recente de `trunk`. Para fixar o código-fonte do Playground em uma versão específica, substitua `trunk` por uma tag da [página de versões](https://github.com/WordPress/wordpress-playground/releases). A tag não torna a compilação reproduzível: a compilação baixa `wp-cli.phar` do branch `gh-pages` do repositório `wp-cli/builds`, que pode mudar entre compilações.

```sh
git clone -b trunk --single-branch --depth 1 --recurse-submodules https://github.com/WordPress/wordpress-playground.git
```

<!-- Enter the `wordpress-playground` directory. -->

Entre no diretório `wordpress-playground`.

```sh
cd wordpress-playground
```

<!-- Use the Node.js version in `.nvmrc`. The commands below require
[nvm](https://github.com/nvm-sh/nvm#installing-and-updating) to be installed.
`nvm install` installs and activates the required Node.js version. If you use
another version manager, install and activate the version in `.nvmrc` with it
instead. Then install the locked dependencies: -->

Use a versão do Node.js indicada em `.nvmrc`. Os comandos abaixo exigem que o [nvm](https://github.com/nvm-sh/nvm#installing-and-updating) esteja instalado. `nvm install` instala e ativa a versão necessária do Node.js. Se você usa outro gerenciador de versões, use-o para instalar e ativar a versão indicada em `.nvmrc`. Em seguida, instale as dependências nas versões fixadas no arquivo de bloqueio:

```sh
nvm install
npm ci
```

<!-- Before building, leave `PLAYGROUND_APP_ORIGIN` and `VITE_WORDPRESS_SITE_URL` unset to serve
the Playground app and its WordPress pages from the same origin. For a public
instance that runs untrusted plugins or Blueprints, use a separate WordPress
origin to reduce exposure. This does not fully protect saved files or native
directory handles. See the [split-origin deployment guide](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/playground/website-deployment/wordpress-frame/README.md). -->

Antes de compilar, deixe `PLAYGROUND_APP_ORIGIN` e `VITE_WORDPRESS_SITE_URL` sem definição para servir a aplicação Playground e suas páginas do WordPress na mesma origem. Para uma instância pública que execute plugins ou Blueprints não confiáveis, use uma origem separada para o WordPress para reduzir a exposição. Isso não protege completamente os arquivos salvos nem os identificadores de acesso a diretórios nativos. Consulte o [guia de implantação com origens separadas](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/playground/website-deployment/wordpress-frame/README.md).

<!-- For a same-origin build, run the following in a POSIX-compatible shell, such
as Bash or Zsh: -->

Para compilar com a mesma origem, execute os comandos a seguir em um shell compatível com POSIX, como Bash ou Zsh:

```sh
unset PLAYGROUND_APP_ORIGIN VITE_WORDPRESS_SITE_URL
npm run build:website
```

<!-- This command internally runs the `nx` task `build:wasm-wordpress-net`. It copies the built assets from packages `remote` and `website` into a new folder at the following path: -->

Este comando executa internamente a tarefa `nx` `build:wasm-wordpress-net`. Ele copia os recursos compilados dos pacotes `remote` e `website` para uma nova pasta no seguinte caminho:

```
dist/packages/playground/wasm-wordpress-net
```

<!-- Serve the contents of this folder as your site root. -->

Sirva o conteúdo desta pasta como a raiz do seu site.

<!-- This builds the files you serve. It does not make every Playground feature
independent of external services. For example, production builds use the
project's CORS proxy for requests that the browser cannot make directly,
unless you set `CORS_PROXY_URL` at build time. -->

Esse processo compila os arquivos que você vai servir. Ele não torna todos os recursos do Playground independentes de serviços externos. Por exemplo, as compilações de produção usam o proxy CORS do projeto para requisições que o navegador não consegue fazer diretamente, a menos que você defina `CORS_PROXY_URL` no momento da compilação.

<!-- ### Verify the local build -->

### Verificar a compilação local {#verify-the-local-build}

<!-- With Python 3 installed, run this command from the `wordpress-playground`
directory to serve the built files locally: -->

Com o Python 3 instalado, execute este comando no diretório `wordpress-playground` para servir os arquivos compilados localmente:

```sh
python3 -m http.server 8768 --bind 127.0.0.1 \
  --directory dist/packages/playground/wasm-wordpress-net
```

<!-- Open [http://127.0.0.1:8768/](http://127.0.0.1:8768/) in your browser. Confirm that: -->

Abra [http://127.0.0.1:8768/](http://127.0.0.1:8768/) no navegador. Confirme que:

<!-- 1. The WordPress welcome page and Playground Dock appear.
2. Entering `/wp-admin/` in the Dock's address field opens the WordPress Dashboard.
3. The WordPress iframe URL, inspected with your browser's developer tools,
   starts with `http://127.0.0.1:8768/scope:`. The app and WordPress should use
   the same scheme, hostname, and port, rather than `wpsandbox.wordpress.net`. -->

1. A página de boas-vindas do WordPress e o Dock do Playground aparecem.
2. Digitar `/wp-admin/` no campo de endereço do Dock abre o painel do WordPress.
3. O URL do iframe do WordPress, inspecionado nas ferramentas de desenvolvimento do navegador, começa com `http://127.0.0.1:8768/scope:`. A aplicação e o WordPress devem usar o mesmo protocolo, nome de host e porta, em vez de `wpsandbox.wordpress.net`.

<!-- Stop the server with `Ctrl+C`. This server is for local verification only.
Use HTTPS when deploying to a public domain; service workers can run over
HTTP on loopback addresses such as `127.0.0.1`. -->

Encerre o servidor com `Ctrl+C`. Este servidor serve apenas para verificação local. Use HTTPS ao implantar em um domínio público; os service workers podem funcionar via HTTP em endereços de loopback, como `127.0.0.1`.

<!-- When reporting a test result, include the output of `git rev-parse HEAD`,
`node --version`, and `npm --version`, along with the browser version and
the command used to serve the files. -->

Ao relatar o resultado de um teste, inclua a saída de `git rev-parse HEAD`, `node --version` e `npm --version`, além da versão do navegador e do comando usado para servir os arquivos.

<!-- ## Summary of included files -->

## Resumo dos arquivos incluídos

<!-- The static assets include: -->

Os recursos estáticos incluem:

<!-- - Data and WASM files for all available PHP and WordPress versions -->
<!-- - `remote.html` - the core of Playground -->
<!-- - `index.html` - the shell, or browser chrome -->
<!-- - Web Worker script -->

- Arquivos de dados e WASM para todas as versões disponíveis de PHP e WordPress
- `remote.html` - o núcleo do Playground
- `index.html` - o shell, ou chrome do navegador
- Script Web Worker

<!-- You can deploy the content of the folder to your server using SSH, such as `scp` or `rsync`. -->

Você pode implantar o conteúdo da pasta no seu servidor usando SSH, como `scp` ou `rsync`.

<!-- It is a static site, except for these dynamic aspects. -->

É um site estático, exceto por estes aspectos dinâmicos.

<!-- - Apache server directive `.htaccess` file from the package `remote` -->

- Arquivo de diretiva do servidor Apache `.htaccess` do pacote `remote`

<!-- For these to work, you need a server environment with Apache and PHP installed. -->

Para que estes funcionem, você precisa de um ambiente de servidor com Apache e PHP instalados.

<!-- ## NGINX configuration -->

## Configuração NGINX

<!-- As an alternative to Apache, here is an example of using NGINX to serve the Playground. -->

Como alternativa ao Apache, aqui está um exemplo de uso do NGINX para servir o Playground.

<!-- :::info Refer to the source file -->
<!-- The example may be outdated. Please check [the source file](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/playground/remote/.htaccess) for the latest version. -->
<!-- ::: -->

<div class="callout callout-info">

**Consulte o arquivo fonte**

O exemplo pode estar desatualizado. Por favor verifique [o arquivo fonte](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/playground/remote/.htaccess) para a versão mais recente.

</div>

<!-- The combined Apache `.htaccess` file looks like this. -->

O arquivo Apache `.htaccess` combinado se parece com isso.

```htaccess
AddType application/wasm .wasm
```

<!-- An equivalent in NGINX. -->

Um equivalente em NGINX.

```nginx
location ~* .wasm$ {
  types {
    application/wasm wasm;
  }
}
```

<!-- You may need to adjust the above according to server specifics, particularly how to invoke PHP for the path `/plugin-proxy`. -->

Você pode precisar ajustar o acima de acordo com as especificidades do servidor, particularmente como invocar PHP para o caminho `/plugin-proxy`.

<!-- [Caddy web server](https://caddyserver.com) doesn't require any special config to work. -->

[O servidor web Caddy](https://caddyserver.com) não requer nenhuma configuração especial para funcionar.

<!-- ## Customize bundled data -->

## Personalizar dados empacotados

<!-- The file `wp.zip` is a bundle of all the files for the virtual file system in Playground. There's a data file for each available WordPress version. -->

O arquivo `wp.zip` é um pacote de todos os arquivos para o sistema de arquivos virtual no Playground. Há um arquivo de dados para cada versão disponível do WordPress.

<!-- The package at `packages/playground/wordpress-builds` is responsible for building these data files. -->

O pacote em `packages/playground/wordpress-builds` é responsável por construir estes arquivos de dados.

<!-- Edit the build script in `Dockerfile` to create a custom bundle that includes preinstalled plugins or content. -->

Edite o script de construção no `Dockerfile` para criar um pacote personalizado que inclui plugins pré-instalados ou conteúdo.

<!-- To rebuild the WordPress builds after customizing the `Dockerfile`, run the following command: -->

Para reconstruir os builds do WordPress após personalizar o `Dockerfile`, execute o seguinte comando:

```
npm run rebuild:wordpress-builds
```

<!-- To rebuild the website to include the custom WordPress builds, follow the instructions [here](#build-locally). -->

Para reconstruir o site para incluir os builds personalizados do WordPress, siga as instruções [aqui](#build-locally).

<!-- ### Install plugins -->

### Instalar plugins

<!-- Here's an example of installing plugins for the data bundle. -->

Aqui está um exemplo de instalação de plugins para o pacote de dados.

<!-- Before the section titled `Strip whitespaces from PHP files`. -->

Antes da seção intitulada `Strip whitespaces from PHP files`.

```docker
# === Preinstall plugins ===

RUN cd wordpress/wp-content/mu-plugins && \
    # Install plugins
    for plugin_name in example-plugin-1 example-plugin-2; do \
      curl -L https://downloads.wordpress.org/plugin/{$plugin_name}.latest-stable.zip -o {$plugin_name}.zip && \
      unzip $plugin_file && \
      rm $plugin_file && \
      # Create entry file in mu-plugins root
      echo "<?php require_once __DIR__.'/$plugin_name/$plugin_name.php';" > $plugin_name.php; \
    done;
```

<!-- You can download plugins from URLs other than the WordPress plugin directory, or use Git to pull them from elsewhere. -->

Você pode baixar plugins de URLs diferentes do diretório de plugins do WordPress, ou usar Git para obtê-los de outro lugar.

<!-- It's also possible to copy from a local folder. For example, before `RUN`: -->

Também é possível copiar de uma pasta local. Por exemplo, antes de `RUN`:

```
COPY ./build-assets/*.zip /root/
```

<!-- Then put the plugin zip files in `build-assets`. In this case, you may want to add their paths to `.gitignore`. -->

Então coloque os arquivos zip dos plugins em `build-assets`. Neste caso, você pode querer adicionar seus caminhos ao `.gitignore`.

<!-- ### Import content -->

### Importar conteúdo

<!-- Here's an example of importing content. -->

Aqui está um exemplo de importação de conteúdo.

```docker
# === Demo content ===

COPY ./build-assets/content.xml /root/
RUN cd wordpress ; \
     echo "Importing content.."; \
    ../wp-cli.phar --allow-root import /root/content.xml --authors=create
```

<!-- This assumes that you have put a WXR export file named `content.xml` in the folder `build-assets`. You can add its path to `.gitignore`. -->

Isso assume que você colocou um arquivo de exportação WXR chamado `content.xml` na pasta `build-assets`. Você pode adicionar seu caminho ao `.gitignore`.

<!-- ## Production deployment checklist -->

## Lista de verificação para implantação em produção

<!-- Before going live, verify your self-hosted Playground meets these requirements: -->

Antes de ir para produção, verifique se seu Playground auto-hospedado atende a estes requisitos:

<!-- ### Server configuration -->

### Configuração do servidor

<!-- - [ ] **MIME types**: Ensure `.wasm` files are served with `application/wasm` content type -->
<!-- - [ ] **CORS headers**: If embedding cross-origin, configure appropriate CORS headers -->
<!-- - [ ] **Caching**: Set long cache times for WASM and static assets (they're versioned) -->
<!-- - [ ] **Compression**: Enable gzip/brotli for faster file transfers -->
<!-- - [ ] **HTTPS**: Required for service workers and some browser features -->

- [ ] **Tipos MIME**: Garanta que arquivos `.wasm` sejam servidos com tipo de conteúdo `application/wasm`
- [ ] **Headers CORS**: Se incorporar cross-origin, configure headers CORS apropriados
- [ ] **Cache**: Defina tempos de cache longos para WASM e recursos estáticos (eles são versionados)
- [ ] **Compressão**: Habilite gzip/brotli para transferências de arquivos mais rápidas
- [ ] **HTTPS**: Necessário para service workers e algumas funcionalidades do navegador

<!-- ### Performance optimization -->

### Otimização de desempenho

<!-- - [ ] **CDN**: Serve static assets from a CDN for faster global delivery -->
<!-- - [ ] **Pre-installed plugins**: Bundle frequently-used plugins in your WordPress build -->
<!-- - [ ] **Minimal blueprints**: Keep runtime plugin installations to a minimum -->

- [ ] **CDN**: Sirva recursos estáticos de um CDN para entrega global mais rápida
- [ ] **Plugins pré-instalados**: Empacote plugins frequentemente usados no seu build do WordPress
- [ ] **Blueprints mínimos**: Mantenha instalações de plugins em tempo de execução no mínimo

<!-- ## Troubleshooting -->

## Solução de problemas

<!-- ### Common issues and solutions -->

### Problemas comuns e soluções

<!-- #### Playground fails to load or shows blank screen -->

#### Playground não carrega ou mostra tela em branco

<!-- **Possible causes:** -->

**Possíveis causas:**

<!-- - Server doesn't serve WASM files with correct MIME type -->
<!-- - Deployment missing required files -->
<!-- - JavaScript errors in browser console -->

- Servidor não serve arquivos WASM com tipo MIME correto
- Implantação faltando arquivos necessários
- Erros JavaScript no console do navegador

<!-- **Solutions:** -->

**Soluções:**

<!-- 1. Check browser console for errors (F12 → Console tab) -->
<!-- 2. Verify `.wasm` files return `application/wasm` content type -->
<!-- 3. Verify you deployed all build files -->

1. Verifique o console do navegador para erros (F12 → aba Console)
2. Verifique se arquivos `.wasm` retornam tipo de conteúdo `application/wasm`
3. Verifique se você implantou todos os arquivos de construção

<!-- #### Slow initial loading (30+ seconds) -->

#### Carregamento inicial lento (30+ segundos)

<!-- **Possible causes:** -->

**Possíveis causas:**

<!-- - Installing large plugins at runtime -->
<!-- - Missing CDN or caching configuration -->
<!-- - User on slow network connection -->

- Instalando plugins grandes em tempo de execução
- Faltando configuração de CDN ou cache
- Usuário em conexão de rede lenta

<!-- **Solutions:** -->

**Soluções:**

<!-- 1. Pre-install plugins in your WordPress build instead of runtime installation -->
<!-- 2. Configure CDN with proper caching headers -->
<!-- 3. Show loading indicators to set user expectations -->

1. Pré-instale plugins no seu build do WordPress ao invés de instalação em tempo de execução
2. Configure CDN com headers de cache apropriados
3. Mostre indicadores de carregamento para definir expectativas do usuário
