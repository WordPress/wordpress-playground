---
slug: /developers/limitations
description: WordPress Playgroundの現状の制限について学びましょう。ブラウザ固有の動作、一時的なストレージ設計、iframeの特異性、WP-CLIのサポート状況などが含まれます。
---

# 制限事項

<!--
# Limitations
-->

WordPress Playground は現在開発中であり、実行および開発時に留意すべき制限がいくつかあります。

<!--
WordPress Playground is under active development and has some limitations you should keep in mind when running it and developing with it.
-->

これらの問題のステータスは、[Playground プロジェクト ボード](https://github.com/orgs/WordPress/projects/180) で追跡できます。

<!--
You can track the status of these issues on the [Playground Project board](https://github.com/orgs/WordPress/projects/180).
-->

## ブラウザの中で

<!--
## In the browser
-->

### 設計上は一時的なもの

<!--
### Temporary by design
-->

Playground は、ページを読み込むたびに新しい WordPress インスタンスを作成します。そのため、ブラウザを更新すると、データベースの変更、アップロード、修正はすべて破棄されます。

<!--
Playground creates fresh WordPress instances on each page load. Refreshing the browser page discards all database changes, uploads, and modifications.
-->

**理由**: Playgroundは、WordPressを従来のサーバーから配信するのではなく、ブラウザに直接ストリーミングします。そのため、リフレッシュするたびにクリーンな状態から再開されます。

<!--
**Why this happens**: Playground streams WordPress directly to your browser rather than serving it from a traditional server. Each refresh starts a clean slate.
-->

**作業を保存するには：**

<!--
**To persist your work:**
-->

- **保存**: 「保存」ボタン（右上のアドレスバーの横）をクリックしてブラウザに保存できます。その後、ブラウザのアドレスバーからページを再読み込みしてください。
- **開発向け**: 永続的なローカルストレージをサポートしている [Playground CLI](/developers/local-development/wp-playground-cli) をご利用ください。

<!--
- **Save**: Enable browser storage via the "Save" button (top right, next to address bar), before refreshing the page via the browser bar.
- **For development**: Use [Playground CLI](/developers/local-development/wp-playground-cli) which supports persistent local storage
-->

<div class="callout callout-tip">

Playground 内の更新ボタンは WordPress のコンテンツのみを再読み込みし、PHP/WPの状態は維持します。ブラウザの更新ボタン（F5またはCmd+R）はインスタンス全体を破棄します。

</div>

<!--
<div class="callout callout-tip">

The dedicated refresh button inside Playground only reloads WordPress content—it preserves your PHP/WP state. The browser's refresh button (F5 or Cmd+R) destroys the entire instance.

</div>
-->

![Refresh Playground Button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/refresh-playground-button.webp)

<blockquote>
<figure>
<figcaption><i>1. Playgroundのエクスポート</i></figcaption>

![Save Button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/export-playground.webp)

</figure>

<figure>
<figcaption><i>2. 保存ボタン:</i></figcaption>

![Save Button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/saving-playground.webp)

</figure>
</blockquote>

<!--
<blockquote>
<figure>
<figcaption><i>1. Exporting Playground:</i></figcaption>

![Save Button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/export-playground.webp)

</figure>

<figure>
<figcaption><i>2. Save button:</i></figcaption>

![Save Button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/saving-playground.webp)

</figure>
</blockquote>
-->

### ブラウザサポート

<!--
### Browser support
-->

WordPress Playgroundは、主要なデスクトップおよびモバイルブラウザすべてで動作するように設計されています。対応ブラウザは以下の通りです。

<!--
WordPress Playground is designed to work across all major desktop and mobile browsers. This includes:
-->

- **デスクトップブラウザ**: Chrome、Firefox、Safari、Edge、その他Chromiumベースのブラウザ
- **モバイルブラウザ**: Safari（iOS）、Chrome（Android）、その他モバイルブラウザの派生版

<!--
- **Desktop browsers**: Chrome, Firefox, Safari, Edge, and other Chromium-based browsers
- **Mobile browsers**: Safari (iOS), Chrome (Android), and other mobile browser variants
-->

Playgroundは最新のWeb技術を活用しており、主要なブラウザ環境で一貫して機能するはずです。ただし、一部の高度な機能については、特定のブラウザやバージョンによってサポートレベルが異なる場合があります。

<!--
Playground leverages modern web technologies and should function consistently across these browser environments. However, some advanced features may have varying levels of support depending on the specific browser and its version.
-->

### パフォーマンスに関する注意点

<!--
### Performance expectations
-->

Playgroundがセットアップする内容によって、読み込み時間は異なります。

<!--
Loading times vary based on what Playground needs to set up:
-->

| シナリオ                                 | 一般的な読み込み時間       |
| :--------------------------------------- | :------------------------- |
| 新規WordPress (プラグインなし)           | 5～10秒                    |
| 小規模なプラグインあり                   | 10～20秒                   |
| 大規模なプラグインあり (例: WooCommerce) | 30～60秒                   |
| モバイル端末                             | デスクトップの1.5～2倍遅い |

<!--
| Scenario                               | Typical Load Time          |
| -------------------------------------- | -------------------------- |
| Fresh WordPress (no plugins)           | 5-10 seconds               |
| With small plugins                     | 10-20 seconds              |
| With large plugins (e.g., WooCommerce) | 30-60 seconds              |
| On mobile devices                      | 1.5-2x slower than desktop |
-->

![Save Button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/playground-performance-graph.webp)

**パフォーマンスに影響を与える要因**

<!--
**Factors that affect performance:**
-->

- **プラグインのサイズ**: プラグインのサイズが大きいと、実行時のインストールに時間がかかります。
- **ネットワーク速度**: WASMファイルは15～30MBです。
- **デバイスのメモリ**: メモリの少ないデバイスでは、動作が遅くなることがあります。
- **ブラウザ**: Chrome/Edgeが最もパフォーマンスが高く、Safariはやや劣ります。

<!--
- **Plugin size**: Large plugins take longer to install at runtime
- **Network speed**: WASM files are 15-30MB
- **Device memory**: Low-memory devices may experience slowdowns
- **Browser**: Chrome/Edge perform best; Safari slightly slower
-->

<blockquote>
<strong>注:</strong> 現在、Opera Miniへの対応は未確認です。
</blockquote>

<blockquote>
<strong>Note:</strong> Opera Mini support is not currently confirmed.
</blockquote>

## Playground で開発する場合

<!--
## When developing with Playground
-->

### iframe の癖

<!--
### Iframe quirks
-->

Playground は WordPress を [`iframe`](/developers/architecture/browser-iframe-rendering) でレンダリングするため、`target="_top"` を含むリンクをクリックすると作業中のページがリロードされます。
また、`iframe` で生成された JavaScript ポップアップは常に表示されるとは限りません。

<!--
Playground renders WordPress in an [`iframe`](/developers/architecture/browser-iframe-rendering) so clicking links with `target="_top"` will reload the page you’re working on.
Also, JavaScript popups originating in the `iframe` may not always display.
-->

### WordPress PHP 関数を実行する

<!--
### Run WordPress PHP functions
-->

Playgroundでは、`runPHP`ステップを使ってブループリント内でPHPコードを実行できます。WordPress固有のPHP関数を実行するには、まず`wp-load.php`を読み込む必要があります。

<!--
Playground supports running PHP code in Blueprints using the [`runPHP` step](/blueprints/steps#RunPHPStep). To run WordPress-specific PHP functions, you’d need to first require [wp-load.php](https://github.com/WordPress/WordPress/blob/master/wp-load.php):
-->

```json
{
	"step": "runPHP",
	"code": "<?php require_once('wordpress/wp-load.php'); OTHER_CODE ?>"
}
```

### WP-CLI の使用

<!--
### Using WP-CLI
-->

ブループリントの[`wp-cli`](/blueprints/steps#WPCLIStep)ステップから`wp-cli`コマンドを実行できます。ただし、Playground はブラウザ内で実行されるため、[利用可能なコマンドの全て](https://developer.wordpress.org/cli/commands/)をサポートしているわけではありません。サポートされているコマンドの明確なリストはありませんが、[オンラインデモ](https://playground.wordpress.net/demos/wp-cli.html)で試してみることで、どのようなことが可能かを確認するのに役立ちます。

<!--
You can execute `wp-cli` commands via the Blueprints [`wp-cli`](/blueprints/steps#WPCLIStep) step. However, since Playground runs in the browser, it doesn't support the [full array](https://developer.wordpress.org/cli/commands/) of available commands. While there is no definite list of supported commands, experimenting in [the online demo](https://playground.wordpress.net/demos/wp-cli.html) will help you assess what's possible.
-->
