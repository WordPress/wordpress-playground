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

### ブラウザストレージと復元

<!--
Playground runs WordPress in the browser. New Playgrounds are autosaved when
browser storage and saving are available, and they appear in **Your
Playgrounds**. Playground keeps up to five recent autosaves. After five exist,
creating another deletes the oldest one. Autosaves are recovery points, not
long-term backups. Store an autosave permanently or export a ZIP when you want
to keep it.
-->

Playground はブラウザ内で WordPress を実行します。ブラウザストレージと保存機能を利用できる場合、新しい Playground は自動保存され、**Playground 一覧**に表示されます。最近の自動保存は最大 5 件保持されます。5 件ある状態で新たに作成すると、最も古いものが削除されます。自動保存は復元ポイントであり、長期的なバックアップではありません。残しておきたい場合は自動保存を永続的に保存するか、ZIP をエクスポートしてください。

<!--
Use these storage modes deliberately:
-->

用途に合わせて、次の保存モードを選んでください。

<!--
- **Autosaved**: stored in browser storage and retained only while it is one of up to five recent autosaves.
- **Saved**: stored permanently in browser storage or saved to a local directory.
- **Temporary**: created with `?storage=temp` or when saving is unavailable. It is discarded when the tab closes or the browser page refreshes.
-->

- **自動保存済み**: ブラウザストレージに保存され、最近の自動保存 5 件のいずれかである間だけ保持されます。
- **保存済み**: ブラウザストレージに永続的に保存されたか、ローカルディレクトリに保存されています。
- **一時的**: `?storage=temp` を付けた場合、または保存機能を利用できない場合に作成されます。タブを閉じるかブラウザページを更新すると破棄されます。

<!--
The Playground **Refresh page** button reloads the WordPress page inside the current Playground. Browser refresh (Cmd+R or F5) reloads the whole Playground app. A stored or autosaved Playground can recover after that reload, but a temporary Playground cannot.
-->

Playground の**ページを更新**ボタンは、現在の Playground 内にある WordPress ページを再読み込みします。ブラウザの更新（Cmd+R または F5）は Playground アプリ全体を再読み込みします。保存済みまたは自動保存済みの Playground は更新後に復元できますが、一時的な Playground は復元できません。

<!--
![The Dock controls for refreshing WordPress, opening storage choices, and exporting the Playground](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/persistence-controls.webp)
-->

![WordPress の更新、保存方法の選択、Playground のエクスポートを行う Dock コントロール](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/persistence-controls.webp)

<!--
Browser storage still belongs to the browser. Storage pressure, private browsing, profile changes, or clearing site data can remove it. Export a ZIP when you need a portable backup.
-->

ブラウザストレージはブラウザによって管理されます。容量不足、プライベートブラウジング、プロファイルの変更、サイトデータの消去によって削除される場合があります。持ち運べるバックアップが必要な場合は ZIP をエクスポートしてください。

<!--
![The Your Playgrounds pane with the current Playground](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/your-playgrounds.webp)
-->

![現在の Playground が表示された「Playground 一覧」パネル](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/your-playgrounds.webp)

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
