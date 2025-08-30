---
title: WordPress プレイグラウンドについて
slug: /about
description: WordPress Playground の概要、それが何であるか、なぜ便利なのか、そしてブラウザで WordPress を実行する方法について説明します。
---

# WordPress プレイグラウンドについて

<!--
# About WordPress Playground
-->

## WordPress Playground とは何ですか?

<!--
## What is WordPress Playground?
-->

**WordPress Playground は、ホストなしであらゆるデバイスで WordPress を瞬時に実行できるプラットフォームです**。公開中のウェブサイトに影響を与えることなく、WordPress を試したり、学習したりできます。安全で管理された環境で、さまざまな機能、デザイン、設定を自由に試せる仮想サンドボックスです。

<!--
**WordPress Playground is the platform that lets you run WordPress instantly on any device without a host**. It allows you to experiment and learn about WordPress without affecting your live website. It's a virtual sandbox where you can play around with different features, designs, and settings in a safe and controlled environment.
-->

WordPress Playground は、構築、テスト、起動を行う場所です。

<!--
WordPress Playground is your place to build, test, and launch:
-->

-   [ビルド](/about/build): WordPress Playground は、WordPress を使った製品開発をサポートします。ブラウザ、Node.js、モバイルアプリ、VS Code など、作業効率の高い環境からご利用いただけます。
-   [テスト](/about/test): WordPress Playground で QA プロセスをアップグレードしましょう。プラグインやテーマを素早くテストし、プライベートサンドボックスで実験を行い、WP Playground インスタンスから任意のリポジトリに PR を作成できます。
-   [リリース](/about/launch): WordPress Playground を使えば、製品を公開したり、ユーザーにライブで試用してもらったり、リードタイムなしで App Store にリリースしたりできます。

<!--
-   [Build](/about/build): WordPress Playground can help you to build products with WordPress. Use it from where you work best, whether that's in the browser, Node.js, mobile apps, VS Code, or elsewhere.
-   [Test](/about/test): Upgrade your QA process with WordPress Playground. Quickly test your plugins or themes, experiment in a private sandbox, and create PRs from your WP Playground instance to any repo.
-   [Launch](/about/launch): Use WordPress Playground to showcase your product, let users try it live, or launch it in the App Store with zero lead time.
-->

## なぜ WordPress Playground なのか?

<!--
## Why WordPress Playground?
-->

### テーマとプラグインをすぐに試す

<!--
### Try themes and plugins on the fly
-->

WordPress Playground を使えば、あらゆる [テーマ](https://developer.wordpress.org/themes/getting-started/what-is-a-theme/) を試すことができます。豊富なテーマから選び、サイト上でどのように見えるかを確認できます。また、色、フォント、レイアウト、その他の視覚要素を変更して、独自のデザインを作成することもできます。テーマに加えて、プラグインも試すことができます。WordPress Playground では、さまざまなプラグインをインストールしてテストし、その動作やサイトでのメリットを確認できます。これにより、何かを壊す心配をすることなく、WordPress の機能を探索し、理解することができます。

<!--
With the WordPress Playground, you can explore any [theme](https://developer.wordpress.org/themes/getting-started/what-is-a-theme/). You can choose from a wide range of themes and see how they look on your site. You can also modify the colors, fonts, layouts, and other visual elements to create a unique design. \
In addition to themes, you can experiment with plugins too. With WordPress Playground, you can install and test different plugins to see how they work and what they can do for your site. This allows you to explore and understand the capabilities of WordPress without worrying about breaking anything.
-->

### どこでもコンテンツを作成

<!--
### Create content on the go
-->

WordPress Playground のもう一つの優れた機能は、コンテンツの作成と編集機能です。ブログ記事を書いたり、ページを作成したり、画像や動画などのメディアをサイトに追加したりできます。これにより、コンテンツを効果的に整理・構造化する方法を理解するのに役立ちます。

<!--
Another great feature of WordPress Playground is the ability to create and edit content. You can write blog posts, create pages, and add media like images and videos to your site. This helps you understand how to organize and structure your content effectively.
-->

作成したコンテンツはデバイス上のプレイグラウンドに限定され、そこから離れると消えてしまうため、実際のサイトを壊すリスクなしに自由に探索して遊ぶことができます。

<!--
The content you create is limited to the Playground on your device and disappears once you leave it, so you are free to explore and play without risking breaking any actual site.
-->

でも、ちょっと待ってください！Playground インスタンスを GitHub リポジトリに接続し、PR を作成してそれらの変更を永続化することもできます。

<!--
But hey! You can also connect your Playground instance to a GitHub repo and create a PR to persist those changes.
-->

### とても安全です

<!--
### It's super safe
-->

総じて、WordPress Playground は初心者が WordPress を学習し、実践的な経験を積むためのリスクのない環境を提供します。公開中のウェブサイトに変更を加える前に、自信と知識を身に付けるのに役立ちます。

<!--
Overall, WordPress Playground provides a risk-free environment for beginners to learn and get hands-on experience with WordPress. It helps you to gain confidence and knowledge before making changes to your live website.
-->

:::tip
WordPress Playground を活用してテーマやプラグインをテストし、その場でコンテンツを作成する方法について詳しくは、[ガイド セクション](/guides) をご覧ください。
:::

<!--
:::tip
Check the [guides section](/guides) to learn more about how to leverage WordPress Playground to test your themes and plugins and create content on the fly.
:::
-->

## WordPress Playground はどのように機能しますか?

<!--
## How does WordPress Playground work?
-->

WordPress Playground を初めてご利用いただくと、WordPress ウェブサイトを作成・カスタマイズできる専用のスペースが提供されます。このスペースは、実際のウェブサイトとは完全に分離されています。

<!--
When you first start using WordPress Playground, you'll be provided with a separate space where you can create and customise your own WordPress website. This space is completely isolated from your actual website.
-->

### ストリーミング配信されますが、配信されません。

<!--
### Streamed, not served.
-->

ブラウザで Playground を開いたときに表示される WordPress は、他の WordPress と同様に機能しますが、[いくつかの制限](/developers/limitations)があり、重要な例外として、インターネット アドレスを持つ永続的なサーバーではないため、一部のサードパーティ サービス (自動化、共有、分析、電子メール、バックアップなど) への接続が永続的に制限されます。

<!--
The WordPress you see when you open Playground in your browser is a WordPress that should function like any WordPress, with [a few limitations](/developers/limitations) and the important exception that it's not a permanent server with an internet address which will limit connections to some third-party services (automation, sharing, analysis, email, backups, etc.) in a persistent way.
-->

Playground に表示される読み込み画面と進行状況バーには、ブラウザへの基礎技術のストリーミングと [WordPress Blueprints](/blueprints) からの構成手順の両方が含まれます ([例](/blueprints/examples) を参照)。そのため、完全なサーバー、WordPress ソフトウェア、テーマとプラグインのソリューション、および構成手順をネットワーク経由でストリーミングできます。

<!--
The loading screen and progress bar you see on Playground includes both the streaming of those foundational technologies to your browser and configuration steps from [WordPress Blueprints](/blueprints) (see [examples](/blueprints/examples)), so that a full server, WordPress software, Theme & Plugin solutions and configuration instructions can be streamed over-the-wire.
-->

## Playground は、Web サーバーまたはローカル デスクトップ アプリで WordPress を実行することと何が違うのでしょうか?

<!--
## What makes Playground different from running WordPress on a web server or local desktop app?
-->

WordPress のような Web アプリケーションは長い間、[ロジックの実行](/developers/architecture/wasm-php-overview)と[データの保存](/developers/architecture/wordpress#sqlite)にサーバー テクノロジに依存してきました。

<!--
Web applications like WordPress have long relied on server technologies [to run logic](/developers/architecture/wasm-php-overview) and [store data](/developers/architecture/wordpress#sqlite).
-->

これらのテクノロジを使用するには、インターネットに接続された Web サーバーを実行するか、テクノロジがインストールされた仮想サーバーまたは現在のデバイス上の基盤テクノロジに依存するデスクトップ サービスまたはアプリ (「WordPress ローカル環境」と呼ばれることもあります) でこれらのテクノロジを使用する必要がありました。

<!--
Using those technologies has meant either running a web server connected to the internet or using those technologies in a desktop service or app (sometimes called a "WordPress local environment") that either leans on a virtual server with the technologies installed or the underlying technologies on the current device.
-->

Playground は、WordPress (および WP-CLI) を含むサーバー テクノロジを、ブラウザーで実行できるファイルとしてストリーミングする新しい方法です。

<!--
Playground is a novel way to stream server technologies—including WordPress (and WP-CLI)—as files that can then run in the browser.
-->
