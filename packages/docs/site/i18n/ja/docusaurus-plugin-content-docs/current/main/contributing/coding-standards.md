---
slug: /contributing/coding-standards
title: コーディング原則 - WordPress Playground
description: 役立つエラー メッセージ、最小限のパブリック API、ブループリントを中心に、Playground のコーディング原則について詳しく説明します。
---

# コーディング原則

<!--
# Coding principles
-->

## エラーメッセージ

<!--
## Error messages
-->

適切なエラーメッセージは、ユーザーに以下の手順を通知します。Playground の公開 API によってスローされるエラーに不明瞭な点があると、開発者は問題を報告する必要があります。

<!--
A good error message informs the user of the following steps to take. Any ambiguity in errors thrown by Playground public APIs will prompt the developers to open issues.
-->

たとえば、ネットワーク エラーを考えてみましょう。エラーの種類を推測し、次の手順をまとめた関連メッセージを表示できるでしょうか?

<!--
Consider a network error, for example—can we infer the type of error and display a relevant message summarizing the next steps?
-->

-   **ネットワークエラー**: 「インターネット接続が不安定です。ページを再読み込みしてください。」
-   **404**: 「ファイルが見つかりませんでした。」
-   **403**: 「サーバーがファイルへのアクセスをブロックしました。」
-   **CORS**: ブラウザのセキュリティ機能であることを明確にし、詳細な説明へのリンク（MDN などの信頼できる情報源）を追加します。ユーザーにファイルを `raw.githubusercontent.com` などの別の場所に移動することを提案し、サーバー上で CORS ヘッダーを設定する方法を説明したリソースへのリンクを提供します。

<!--
-   **Network error**: "Your internet connection twitched. Try to reload the page.
-   **404**: "Could not find the file".
-   **403**: "The server blocked access to the file".
-   **CORS**: clarify it's a browser security feature and add a link to a detailed explanation (on MDN or another reliable source). Suggest the user move their file somewhere else, like `raw.githubusercontent.com`, and link to a resource explaining how to set up CORS headers on their servers.
-->

コードのフォーマットとリンティングは自動的に行われます。安心して入力し、あとは機械に任せましょう。

<!--
We handle code formatting and linting automatically. Relax, type away, and let the machines do the work.
-->

## パブリック API

<!--
## Public API
-->

Playground は、API スコープを可能な限り狭くすることを目指しています。

<!--
Playground aims to keep the narrowest possible API scope.
-->

パブリック API は追加は簡単ですが、削除は困難です。新しい API を導入するには 1 件の PR で済みますが、削除するには 1,000 件もの PR が必要になることもあります。特に、他のプロジェクトで既にその API を使用している場合はなおさらです。

<!--
Public APIs are easy to add and hard to remove. It only takes one PR to introduce a new API, but it may take a thousand to remove it, especially if other projects have already consumed it.
-->

-   不要な関数、クラス、定数、その他のコンポーネントを公開しないでください。

<!--
-   Don't expose unnecessary functions, classes, constants, or other components.
-->

## ブループリント

<!--
## Blueprints
-->

ブループリントは Playground を操作するための主要な手段です。これらの JSON ファイルは、Playground が順番に実行する一連のステップを記述します。

<!--
Blueprints are the primary way to interact with Playground. These JSON files describe a set of steps that Playground executes in order.
-->

### ガイドライン

<!--
### Guidelines
-->

ブループリントのステップは**簡潔かつ焦点を絞った**ものでなければなりません。1 つのことに集中し、それをしっかりと実行する必要があります。

<!--
Blueprint steps should be **concise and focused**. They should do one thing and do it well.
-->

-   新しいステップを作成する必要がある場合は、まず既存のステップをリファクタリングしてみてください。
-   それでも不十分な場合は、新しいステップが新しい機能を提供することを確認してください。既存のステップの機能を複製しないでください。
-   ステップが複数回呼び出されることを想定してください。
-   特定の順序で実行されることを想定してください。
-   それを検証するための単体テストを追加してください。

<!--
-   If you need to create a new step, try refactoring an existing one first.
-   If that's not enough, ensure the new step delivers a new capability. Don't replicate the functionality of existing steps.
-   Assume the step would be called more than once.
-   Assume it would run in a specific order.
-   Add unit tests to verify that.
-->

ブループリントは**直感的でわかりやすい**ものでなければなりません。

<!--
Blueprints should be **intuitive and straightforward**.
-->

-   省略可能な引数は必須にしないでください。
-   単純な引数を使用してください。例えば、`path` ではなく `slug` を使用してください。
-   定数は仮想 JSON ファイルで定義してください。PHP ファイルを変更しないでください。
-   Blueprint の TypeScript 型を定義してください。Playground はこのようにして JSON スキーマを生成します。
-   Blueprint ステップを処理する関数を記述してください。定義した型の引数を受け入れてください。
-   ドキュメント文字列に使用例を記載してください。これは自動的にドキュメントに反映されます。

<!--
-   Don't require arguments that can be optional.
-   Use plain argument. For example, `slug` instead of `path`.
-   Define constants in virtual JSON files—don't modify PHP files.
-   Define a TypeScript type for the Blueprint. That's how Playground generates its JSON schema.
-   Write a function to handle a Blueprint step. Accept the argument of the type you defined.
-   Provide a usage example in the doc string. It's automatically reflected in the docs.
-->
