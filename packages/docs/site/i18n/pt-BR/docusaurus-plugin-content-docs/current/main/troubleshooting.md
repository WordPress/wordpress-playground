---
title: Solução de problemas
slug: /troubleshooting
description: Diagnostique erros comuns do site do WordPress Playground, incluindo falhas de inicialização, problemas com SQLite, armazenamento do navegador e recuperação de Playgrounds salvos.
---

<!-- title: Troubleshooting -->

<!-- description: Diagnose common WordPress Playground website errors, including boot failures, SQLite issues, browser storage, and saved Playground recovery. -->

<!-- # Troubleshooting WordPress Playground -->

# Solução de problemas no WordPress Playground

<!--
This page covers errors from the Playground website itself, saved Playgrounds,
browser storage, and WordPress boot. For Blueprint-specific errors, see
[Troubleshoot and debug Blueprints](/blueprints/troubleshoot-and-debug).
-->

Esta página cobre erros do próprio site do Playground, Playgrounds salvos,
armazenamento do navegador e inicialização do WordPress. Para erros específicos
de Blueprint, consulte [Solução de problemas e depuração de Blueprints](/blueprints/troubleshoot-and-debug).

<!-- ## Playground looks broken -->

## O Playground parece quebrado

<!-- Try these first: -->

Tente isto primeiro:

<!--
- Use the reload button inside the Playground toolbar instead of refreshing the browser tab. Browser refresh starts the whole Playground app again.
- Open the same URL in a private window to rule out saved-site or browser-storage state.
- Disable browser extensions that block JavaScript, WebAssembly, storage, workers, or network requests.
- Check browser developer tools for Console and Network errors.
- If the URL includes `?site-slug=...`, try removing that query parameter to start a fresh unsaved Playground.
-->

- Use o botão de recarregar dentro da barra de ferramentas do Playground em vez de atualizar a aba do navegador. A atualização do navegador inicia todo o app do Playground novamente.
- Abra a mesma URL em uma janela privativa para descartar problemas de estado de site salvo ou armazenamento do navegador.
- Desative extensões do navegador que bloqueiam JavaScript, WebAssembly, armazenamento, workers ou requisições de rede.
- Verifique as ferramentas de desenvolvedor do navegador para erros nas abas Console e Network.
- Se a URL incluir `?site-slug=...`, tente remover esse parâmetro de consulta para iniciar um Playground novo e não salvo.

<!-- ## A clean site says the MySQL extension is missing -->

## Um site limpo diz que a extensão MySQL está ausente

<!-- You may see a WordPress error page like this: -->

Você pode ver uma página de erro do WordPress como esta:

```text
Your PHP installation appears to be missing the MySQL extension which is required by WordPress.
```

<!--
In Playground, this usually means WordPress did not load the SQLite integration
that lets WordPress run without MySQL. Playground runs WordPress in WebAssembly
and uses SQLite instead of a MySQL server.
-->

No Playground, isso geralmente significa que o WordPress não carregou a
integração SQLite que permite executar o WordPress sem MySQL. O Playground
executa o WordPress em WebAssembly e usa SQLite em vez de um servidor MySQL.

<!-- Try these steps: -->

Tente estes passos:

<!--
- Start a fresh unsaved Playground at https://playground.wordpress.net/ to confirm the public site can boot.
- If the URL includes a saved site, remove `?site-slug=...` and load a new temporary site.
- If this happened after importing a ZIP, confirm the import did not include a custom `wp-content/db.php` that overrides Playground's SQLite setup.
- If this happened in the CLI, do not use `--skip-sqlite-setup` unless you provide your own database integration.
- If this happened with a Blueprint, see the [Blueprint troubleshooting page](/blueprints/troubleshoot-and-debug).
-->

- Inicie um Playground novo e não salvo em https://playground.wordpress.net/ para confirmar que o site público consegue inicializar.
- Se a URL incluir um site salvo, remova `?site-slug=...` e carregue um novo site temporário.
- Se isso aconteceu depois de importar um ZIP, confirme que a importação não incluiu um `wp-content/db.php` personalizado que substitui a configuração SQLite do Playground.
- Se isso aconteceu na CLI, não use `--skip-sqlite-setup`, a menos que você forneça sua própria integração de banco de dados.
- Se isso aconteceu com um Blueprint, consulte a [página de solução de problemas de Blueprint](/blueprints/troubleshoot-and-debug).

<!--
If you are writing a Blueprint and need to add the SQLite integration plugin,
`plugins` goes at the top level:
-->

Se você estiver escrevendo um Blueprint e precisar adicionar o plugin de
integração SQLite, `plugins` fica no nível superior:

```json
{
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	},
	"plugins": ["sqlite-database-integration"],
	"steps": [
		{
			"step": "login",
			"username": "admin"
		}
	]
}
```

<!-- ## Error connecting to the SQLite database -->

## Error connecting to the SQLite database

<!--
This means Playground loaded the SQLite integration, but WordPress still could
not connect to the database.
-->

Isso significa que o Playground carregou a integração SQLite, mas o WordPress
ainda não conseguiu se conectar ao banco de dados.

<!-- Common causes: -->

Causas comuns:

<!--
- A saved Playground's browser storage is stale or incomplete.
- An imported site ZIP contains an incompatible database file or database drop-in.
- A mounted local directory is missing files that WordPress needs.
- Browser storage was cleared, evicted, or blocked.
-->

- O armazenamento do navegador de um Playground salvo está desatualizado ou incompleto.
- Um ZIP de site importado contém um arquivo de banco de dados ou drop-in de banco de dados incompatível.
- Um diretório local montado não tem arquivos de que o WordPress precisa.
- O armazenamento do navegador foi limpo, removido ou bloqueado.

<!-- Recommended recovery: -->

Recuperação recomendada:

<!--
1. Start a fresh unsaved Playground without `site-slug`.
2. If the fresh site works, the issue is tied to the saved site or imported archive.
3. Export any accessible files from the broken saved site using the File Browser or local directory copy, if available.
4. Re-import the site into a new Playground, or rebuild it from its Blueprint.
-->

1. Inicie um Playground novo e não salvo sem `site-slug`.
2. Se o site novo funcionar, o problema está ligado ao site salvo ou ao arquivo importado.
3. Exporte quaisquer arquivos acessíveis do site salvo quebrado usando o Navegador de arquivos ou uma cópia do diretório local, se disponível.
4. Reimporte o site para um novo Playground ou reconstrua-o a partir do Blueprint.

<!-- ## NotAllowedError -->

## NotAllowedError

<!--
`NotAllowedError` usually means the browser blocked an operation that requires
user permission or a supported browser context. In Playground, this often
relates to saved sites or local directory access.
-->

`NotAllowedError` geralmente significa que o navegador bloqueou uma operação
que exige permissão do usuário ou um contexto de navegador compatível. No
Playground, isso costuma estar relacionado a sites salvos ou acesso a
diretórios locais.

<!-- You may see this exact message: -->

Você pode ver esta mensagem exata:

```text
The request is not allowed by the user agent or the platform in the current context.
```

<!-- Try: -->

Tente:

<!--
- Open Playground in a normal top-level browser tab, not inside a restricted iframe.
- Reopen the site from the Playground **Saved Playgrounds** panel.
- If the site was saved to a local directory, import or save the directory again.
- Confirm the browser supports the file or storage API being used. Chrome and Edge generally have the broadest local directory support.
- Check whether private browsing mode, enterprise policy, or browser settings block storage access.
-->

- Abrir o Playground em uma aba normal de nível superior do navegador, não dentro de um iframe restrito.
- Reabrir o site pelo painel **Saved Playgrounds** do Playground.
- Se o site foi salvo em um diretório local, importar ou salvar o diretório novamente.
- Confirmar que o navegador oferece suporte à API de arquivos ou armazenamento em uso. Chrome e Edge geralmente têm o suporte mais amplo a diretórios locais.
- Verificar se o modo de navegação privativa, uma política empresarial ou as configurações do navegador bloqueiam acesso ao armazenamento.

<!-- ## NoModificationAllowedError -->

## NoModificationAllowedError

<!--
`NoModificationAllowedError` means the browser or filesystem refused a write.
This can happen when a saved local directory became read-only, permission was
lost, or browser storage is unavailable.
-->

`NoModificationAllowedError` significa que o navegador ou sistema de arquivos
recusou uma gravação. Isso pode acontecer quando um diretório local salvo se
tornou somente leitura, a permissão foi perdida ou o armazenamento do navegador
está indisponível.

<!-- You may see this exact message: -->

Você pode ver esta mensagem exata:

```text
An attempt was made to write to a file or directory which could not be modified due to the state of the underlying filesystem.
```

<!-- Try: -->

Tente:

<!--
- Save a copy to a different local directory.
- Check that the target folder still exists and is writable.
- Avoid system-protected folders or synced folders that temporarily lock files.
- Start a fresh unsaved Playground if you only need a temporary test site.
- Use [Playground CLI](/developers/local-development/wp-playground-cli) for local development that needs reliable filesystem persistence.
-->

- Salvar uma cópia em outro diretório local.
- Verificar se a pasta de destino ainda existe e é gravável.
- Evitar pastas protegidas pelo sistema ou pastas sincronizadas que bloqueiam arquivos temporariamente.
- Iniciar um Playground novo e não salvo se você só precisa de um site temporário de teste.
- Usar a [Playground CLI](/developers/local-development/wp-playground-cli) para desenvolvimento local que precisa de persistência confiável do sistema de arquivos.

<!-- ## Saved Playground cannot reload -->

## Playground salvo não recarrega

<!--
Saved Playgrounds are stored in browser storage or in a local directory you
selected. They are not hosted on a remote server.
-->

Playgrounds salvos são armazenados no armazenamento do navegador ou em um
diretório local que você selecionou. Eles não são hospedados em um servidor
remoto.

<!-- If a saved Playground cannot reload: -->

Se um Playground salvo não recarregar:

<!--
- Confirm you are using the same browser and browser profile where it was saved.
- Check whether browser data was cleared or storage was disabled.
- If the site was saved to a local directory, confirm the directory still exists and has not moved.
- If the URL includes `?site-slug=...`, remove it to start a fresh unsaved site.
- Recreate the saved site from its original Blueprint or import ZIP if storage was lost.
-->

- Confirme que você está usando o mesmo navegador e perfil de navegador em que ele foi salvo.
- Verifique se os dados do navegador foram limpos ou se o armazenamento foi desativado.
- Se o site foi salvo em um diretório local, confirme que o diretório ainda existe e não foi movido.
- Se a URL incluir `?site-slug=...`, remova-o para iniciar um site novo e não salvo.
- Recrie o site salvo a partir do Blueprint original ou do ZIP de importação se o armazenamento foi perdido.

<!-- ## Browser storage and persistence -->

## Armazenamento do navegador e persistência

<!--
An unsaved Playground is temporary. A browser refresh, tab close, storage
cleanup, or browser profile change can remove its state.
-->

Um Playground não salvo é temporário. Uma atualização do navegador, fechamento
da aba, limpeza de armazenamento ou troca de perfil do navegador pode remover
o estado dele.

<!--
Use the **Save** button before doing meaningful work. For longer-running local
development, prefer the [Playground CLI](/developers/local-development/wp-playground-cli),
which persists site files on disk.
-->

Use o botão **Save** antes de fazer trabalhos importantes. Para desenvolvimento
local de longa duração, prefira a [Playground CLI](/developers/local-development/wp-playground-cli),
que persiste os arquivos do site em disco.

<!--
<div class="callout callout-tip">

The refresh button inside the Playground toolbar reloads WordPress while keeping
the current Playground runtime. The browser refresh button reloads the full app
and can discard unsaved changes.
</div>
-->

<div class="callout callout-tip">

O botão de atualizar dentro da barra de ferramentas do Playground recarrega o
WordPress mantendo o runtime atual do Playground. O botão de atualizar do
navegador recarrega o app inteiro e pode descartar alterações não salvas.

</div>

<!-- ## When to start fresh -->

## Quando começar do zero

<!-- Start a fresh unsaved Playground when: -->

Inicie um Playground novo e não salvo quando:

<!--
- You only need to test whether the public Playground site is working.
- The URL points to a saved `site-slug` that no longer loads.
- You are debugging whether an error comes from Playground itself or from a plugin, theme, Blueprint, or imported site.
- Browser storage or local directory access is suspected to be broken.
-->

- Você só precisa testar se o site público do Playground está funcionando.
- A URL aponta para um `site-slug` salvo que não carrega mais.
- Você está depurando se um erro vem do próprio Playground ou de um plugin, tema, Blueprint ou site importado.
- Há suspeita de problema no armazenamento do navegador ou no acesso a diretório local.

<!-- Use this URL for a clean site: -->

Use esta URL para um site limpo:

```text
https://playground.wordpress.net/
```

<!-- ## Report a Playground issue -->

## Relatar um problema do Playground

<!--
If the problem reproduces on a fresh unsaved Playground, please
[open an issue](https://github.com/WordPress/wordpress-playground/issues) and
include:
-->

Se o problema for reproduzido em um Playground novo e não salvo,
[abra uma issue](https://github.com/WordPress/wordpress-playground/issues) e
inclua:

<!--
- The full Playground URL.
- The browser and operating system.
- Whether you used a saved site, imported ZIP, Blueprint, local directory, or CLI.
- The exact error name and message.
- Console and Network details from browser developer tools.
-->

- A URL completa do Playground.
- O navegador e o sistema operacional.
- Se você usou um site salvo, ZIP importado, Blueprint, diretório local ou CLI.
- O nome e a mensagem exatos do erro.
- Detalhes das abas Console e Network das ferramentas de desenvolvedor do navegador.
