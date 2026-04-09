---
slug: /developers/architecture/browser-iframe-rendering
---

# Iframe ベースのレンダリング

<!--
# Iframe-based rendering
-->

ページのリロードを避けるため、すべての `PHPRequestHandler` の応答はiframe内でレンダリングされる必要があります。
システム全体はメインの `index.html` が存在している間しか機能しないことを忘れないでください。メインアプリのリロードは、どんな犠牲を払ってでも避けるべきです。

<!--
To avoid page reloads, all the `PHPRequestHandler` responses must be rendered in an iframe. Remember, the entire setup only lives as long as the main `index.html`. We want to avoid reloading the main app at all costs.
-->

上記のアプリの例では、`index.php` は以下のHTMLをレンダリングします。

<!--
In our app example above, `index.php` renders the following HTML:
-->

```html
<a href="page.php">page.php へ移動</a>
```

<!--
```html
<a href="page.php">Go to page.php</a>
```
-->

`index.html` が `<iframe>` ではなく `<div>` でレンダリングされたと想像してみてください。そのリンクをクリックするとすぐに、ブラウザは `index.html` から `page.php` へ移動しようとします。しかし、`index.html` はワーカースレッド、PHPRequestHandler、そしてそれらをサービスワーカーに接続するトラフィック制御を含む、PHP アプリケーション全体を実行します。ここから移動すると、アプリケーションは破壊されてしまいます。

<!--
Imagine our `index.html` rendered it in a `<div>` instead of an `<iframe>`. As soon as you click on that link, the browser will try to navigate from `index.html` to `page.php`. However, `index.html` runs the entire PHP app, including the Worker Thread, the PHPRequestHandler, and the traffic control connecting them to the Service Worker. Navigating away from it would destroy the app.
-->

ここで、同じリンクが含まれる iframe を考えてみましょう。

<!--
Now, consider an iframe with the same link in it:
-->

```html
<iframe srcdoc='<a href="page.php">page.php へ移動</a>'></iframe>
```

<!--
```html
<iframe srcdoc='<a href="page.php">Go to page.php</a>'></iframe>
```
-->

今回はブラウザでリンクをクリックして、**iframe内**の`page.php`を読み込みます。PHPアプリケーションが実行されるトップレベルの`index.html`は影響を受けません。そのため、`@php-wasm/web`の設定にはiframeが不可欠です。

<!--
This time, click the link in the browser to load `page.php` **inside the iframe**. The top-level `index.html`, where the PHP application runs, remains unaffected. That's why iframes are crucial for the `@php-wasm/web` setup.
-->

:::info Crash reports
Playgroundでは、クラッシュレポートが自動的に収集されることはありません。その代わり、ブラウザでインスタンスの実行に失敗した場合に、ユーザーにクラッシュレポートの提出を促します。

レポートにはログ、説明、URL が含まれており、ユーザーは送信前にレポートを変更できます。

[Logger API](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/playground/website/public/logger.php) がそこから処理を行います。このシンプルな REST API はデータを検証し、**Making WordPress** [#playground-logs Slack チャンネル](https://wordpress.slack.com/archives/C06Q5DCKZ3L) に送信します。
:::

<!--
:::info Crash reports
Playground doesn't collect crash reports automatically. Instead, it prompts users to submit a crash report when an instance fails to run in the browser.

The report includes a log, description, and a URL, and users can modify it before submitting it.

The [Logger API](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/playground/website/public/logger.php) handles it from there. This simple REST API validates the data and sends it to the **Making WordPress** [#playground-logs Slack channel](https://wordpress.slack.com/archives/C06Q5DCKZ3L).
:::
-->

## iframe の注意事項

<!--
## Iframes caveats
-->

- `target="_top"` はまだ処理されていないため、`target="_top"` を含むリンクをクリックすると、作業中のページがリロードされます。
- `iframe` から発生する JavaScript ポップアップは、必ずしも表示されるとは限りません。

<!--
-   `target="_top"` isn't handled yet, so clicking links with `target="_top"` will reload the page you’re working on.
-   JavaScript popups originating in the `iframe` may not always display.
-->
