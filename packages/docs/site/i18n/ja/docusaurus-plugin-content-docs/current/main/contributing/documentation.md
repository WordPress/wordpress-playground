---
slug: /contributing/documentation
title: ドキュメントの貢献 - WordPress Playground
description: 問題のオープンからプル リクエストの送信まで、Playground ドキュメントに貢献する方法に関するガイド。
---

# ドキュメントの貢献

<!--
# Documentation contributions
-->

[WordPress Playground のドキュメント サイト](/) は、あなたのようなボランティアによって管理されており、皆さんの協力をお待ちしています。

<!--
[WordPress Playground's documentation site](/) is maintained by volunteers like you, who'd love your help.
-->

ドキュメント関連の課題はすべて、[`[Type] Documentation`](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22%5BType%5D%20Documentation%22) または [`[Type] Developer Documentation`](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22%5BType%5D%20Developer%20Documentation%22) というラベルが付けられ、[WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) リポジトリに保存されています。未解決の課題の一覧から、取り組みたい課題を見つけてください。また、現在のドキュメントに不足している点があると思われる場合は、課題を開いてご提案を議論してください。

<!--
All documentation-related issues are labeled [`[Type] Documentation`](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22%5BType%5D%20Documentation%22) or [`[Type] Developer Documentation`](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22%5BType%5D%20Developer%20Documentation%22) in the [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) repository. Browse the list of open issues to find one you'd like to work on. Alternatively, if you believe something is missing from the current documentation, open an issue to discuss your suggestion.
-->

## どうすれば貢献できますか?

<!--
## How can I contribute?
-->

[プロジェクト リポジトリで問題を開く](https://github.com/WordPress/wordpress-playground/issues/new) ことで、追加または変更したい内容を説明して貢献できます。

<!--
You can contribute by [opening an issue in the project repository](https://github.com/WordPress/wordpress-playground/issues/new) and describing what you'd like to add or change.
-->

気が向いたら、問題の説明に内容を書いてください。残りの作業はプロジェクトの貢献者が行います。

<!--
If you feel up to it, write the content in the issue description, and the project contributors will take care of the rest.
-->

### リポジトリをフォークし、ローカルでファイルを編集し、プルリクエストを開く

<!--
### Forking the repo, edit files locally and opening Pull Requests
-->

Markdown に精通している場合は、`wordpress-playground` リポジトリを [フォーク](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/fork-a-repo) し、Pull Request を送信して変更や新しいドキュメント ページを提案することができます。

<!--
If you are familiar with markdown, you can [fork](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/fork-a-repo) the `wordpress-playground` repo and propose changes and new documentation pages by submitting a Pull Request.
-->

[WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) リポジトリでブランチを作成し、翻訳されたページを含む新しい PR を開くプロセスは、gutenberg などの他の WordPress リポジトリに貢献する場合と同じです。
https://developer.wordpress.org/block-editor/contributors/code/git-workflow/

<!--
The process of creating a branch to open new PRs with translated pages on the [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) repository is the same than contributing to other WordPress repositories such as gutenberg:
https://developer.wordpress.org/block-editor/contributors/code/git-workflow/
-->

ドキュメント ファイル (`.md` ファイル) は、Playground の GitHub リポジトリに保存されています。英語の場合は [`/packages/docs/site/docs`](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/docs)、その他の言語の場合は [`/packages/docs/site/i18n`](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/i18n) に保存されています。

<!--
The documentation files (`.md` files) are stored in Playground's GitHub repository, [under `/packages/docs/site/docs`](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/docs) for English and [`/packages/docs/site/i18n`](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/i18n) for other languages.
-->

### ブラウザで編集する

<!--
### Edit in the browser
-->

GitHub にログインしている場合は、既存のファイルを編集 (または新しいファイルを追加) し、GitHub UI から直接 PR を送信することもできます。

<!--
If logged in GitHub, you can also edit existing files (or add new ones) and submit a PR directly from the GitHub UI:
-->

1. 編集したいページ、または新しいページを追加したい章のディレクトリを見つけます。
2. **ファイルを追加** ボタンをクリックして新しいファイルを追加するか、既存のファイルをクリックしてから鉛筆アイコンをクリックして編集します。
3. GitHub からリポジトリをフォークして、変更内容を含む新しいブランチを作成するように求められます。
4. 変更を加えるためのエディターが開きます。
5. 完了したら、**変更をコミット** ボタンをクリックしてプルリクエストを送信します。

<!--
1. Find the page you'd like to edit or the directory of the chapter you'd like to add a new page to.
2. Click the **Add Files** button to add a new file, or click on an existing file and then click the pencil icon to edit it.
3. GitHub will ask you to fork the repository and create a new branch with your changes.
4. An editor will open where you can make the changes.
5. When you're done, click the **Commit Changes** button and submit a Pull Request.
-->

これで完了です。WordPress Playground のドキュメントに貢献できました。

<!--
That's it! You've just contributed to the WordPress Playground documentation.
-->

このアプローチでは、リポジトリのクローンを作成したり、ローカル開発環境をセットアップしたり、コマンドを実行したりする必要はありません。

<!--
This approach means you don't need to clone the repository, set up a local development environment, or run any commands.
-->

欠点は、変更内容をプレビューできないことです。プルリクエストを送信する前に変更内容を確認する方法については、読み進めてください。

<!--
The downside is that you won't be able to preview your changes. Keep reading to learn how to review your changes before submitting a Pull Request.
-->

### ローカルプレビュー

<!--
### Local preview
-->

リポジトリをクローンし、デバイス上のディレクトリに移動します。以下のコマンドを実行します。

<!--
Clone the repository and navigate to the directory on your device. Now run the following commands:
-->

```bash
npm install
npm run build:docs
npm run dev:docs
```

ドキュメントサイトは新しいブラウザタブで開き、変更ごとに自動的に更新されます。コードエディタで関連ファイルを編集し、変更内容をリアルタイムでテストしてください。

<!--
The documentation site opens in a new browser tab and refreshes automatically with each change. Continue to edit the relevant file in your code editor and test the changes in real-time.
-->
