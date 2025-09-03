---
title: WordPress Playgroundプロジェクトへの貢献
slug: /contributing
id: introduction
description: WordPress Playground への貢献の出発点です。コード、ドキュメント、バグ報告に関するガイドラインをご覧ください。
---

# WordPress Playground プロジェクトへの貢献

<!--
# Contributing to WordPress Playground project
-->

WordPress Playground は、コードからデザイン、ドキュメントからトリアージまで、あらゆる種類の貢献者を歓迎するオープンソース プロジェクトです。

<!--
WordPress Playground is an open-source project that welcomes contributors of all kinds, from code to design, documentation to triage.
-->

## どうすれば貢献できますか?

<!--
## How can I contribute?
-->

-   コードですか？[開発者向けセクション](/contributing/code)をご覧ください。
-   ドキュメントですか？[ドキュメントセクション](/contributing/documentation)をご覧ください。
-   バグ報告ですか？GitHub のメインリポジトリ、または[Playground Tools](https://github.com/WordPress/playground-tools/issues/new)で[新しい問題](https://github.com/WordPress/wordpress-playground/issues/new)を開いてください。
-   アイデアやデザインなど、何かありましたら、[GitHub ディスカッション](https://github.com/WordPress/wordpress-playground/discussions)を開いて、ぜひお話しましょう！

<!--
-   Code? See the [developer section](/contributing/code).
-   Documentation? See the [documentation section](/contributing/documentation).
-   Reporting bugs? Open a [new issue](https://github.com/WordPress/wordpress-playground/issues/new) in the main GitHub repository, or in [Playground Tools](https://github.com/WordPress/playground-tools/issues/new).
-   Ideas, designs, or anything else? Open a [GitHub discussion](https://github.com/WordPress/wordpress-playground/discussions), and let's talk!
-->

## ガイドライン

<!--
## Guidelines
-->

-   すべての WordPress プロジェクトと同様に、私たちは誰もが歓迎され、敬意を持って利用できる環境づくりに努めています。詳しくは、コミュニティの[行動規範](https://make.wordpress.org/handbook/community-code-of-conduct/)をお読みください。
-   コード貢献者は[コーディング原則](/contributing/coding-standards)を確認してください。
-   貢献したすべてのコードに対する著作権はあなたに帰属します。プルリクエストを送信することにより、そのコードを[WordPress Playground ライセンス](https://github.com/WordPress/wordpress-playground?tab=GPL-2.0-1-ov-file#readme)に基づいて公開することに同意したことになります。

<!--
-   As with all WordPress projects, we want to ensure a welcoming and respectful environment for everyone. Please read our community's [Code of Conduct](https://make.wordpress.org/handbook/community-code-of-conduct/) to learn more.
-   Code contributors should review the [coding principles](/contributing/coding-standards).
-   You maintain copyright over any contribution you make. By submitting a Pull Request, you agree to release that code under [WordPress Playground License](https://github.com/WordPress/wordpress-playground?tab=GPL-2.0-1-ov-file#readme).
-->

## イシューのトリアージ

<!--
## Triaging issues
-->

未解決の問題を整理し、潜在的なバグを解決するお手伝いをしたいですか? 方法は次のとおりです:

<!--
Want to help sort through open issues and resolve potential bugs? Here's how:
-->

1. [未解決の問題一覧](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aopen+is%3Aissue)を確認し、貢献できる問題を見つけてください。[Playground Tools リポジトリ](https://github.com/WordPress/playground-tools/issues?q=is%3Aopen+is%3Aissue)についても同様です。
2. 説明とコメントに目を通します。
3. 再現可能なバグの場合は、詳細なコメントまたは修正案を追加します。
4. 再現できない場合は、役立つと思われる追加情報をコメントに追加します。

<!--
1. Review the [list of open issues](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aopen+is%3Aissue) and find the ones that you can help with. Same goes for the [Playground Tools repository](https://github.com/WordPress/playground-tools/issues?q=is%3Aopen+is%3Aissue).
2. Read through the description and comments.
3. If it's a bug you can reproduce, add a descriptive comment or a potential fix.
4. Otherwise, add a comment with any additional information that may be helpful.
-->

## 貢献と GPL ライセンスに関する注意

<!--
## A note on contributing and the GPL license
-->

WordPress Playground と WordPress プロジェクトは、フリーソフトウェアおよびオープンソースソフトウェアに深く根ざしています。具体的には、WordPress Playground は [フリーソフトウェア財団](https://www.fsf.org/) から GPLv2（またはそれ以降）のライセンスを受けています。[ライセンスの本文はこちら](https://github.com/WordPress/wordpress-playground/blob/trunk/LICENSE) でご覧いただけます。もし難しそうに感じる場合は、WordPress.org に [分かりやすい GPL 入門書](https://make.wordpress.org/community/handbook/wordcamp-organizer/planning-details/gpl-primer/) があります。

<!--
WordPress Playground and the WordPress project are strongly rooted in free and open source software. Specifically, WordPress Playground is licenced under GPLv2 (or later) from the [Free Software Foundation](https://www.fsf.org/). You can [read the text of the license here](https://github.com/WordPress/wordpress-playground/blob/trunk/LICENSE) and if that feels overwhelming, WordPress.org has a [friendly GPL Primer](https://make.wordpress.org/community/handbook/wordcamp-organizer/planning-details/gpl-primer/).
-->

したがって、あなたの貢献が以下の内容に該当することにご注意ください。

<!--
As such, please be aware of the implications that your contributions will fall under:
-->

-   貢献を行う際は、貢献内容が GPLv2（またはそれ以降）ライセンスの下で提供されることに同意するものとします。
-   GPL ライセンスには強力なコピーレフト条項があり、すべての派生作品がオープンソースであり、同一のライセンス条件の下で提供されることを保証するため、共同開発環境が促進されます。
-   GPL ライセンスでは、変更、バグ修正、新機能などを元のコードベースに還元することが推奨されます。
-   GPL ライセンスは、コスト面だけでなく、ソフトウェアの使用、変更、配布の自由に関しても、プロジェクトがフリーかつオープンソースであることを保証します。

<!--
-   When you contribute, you agree to license your contributions under the GPLv2 (or later) license
-   The GPL license has strong copyleft provisions that ensure all derivative works remain open-source and under the same license terms, thereby promoting a collaborative development environment.
-   The GPL license encourages contributing any changes, bug fixes, or new features back to the original codebase.
-   The GPL license ensures that the project remains free and open-source, not only in terms of cost but also with respect to the freedom to use, modify, and distribute the software.
-->

上記があなたの貢献にどのような影響を与えるかについてご質問がある場合は、WP Slack および [`meta-playground` チャンネル](https://wordpress.slack.com/archives/C04EWKGDJ0K) までお気軽にお問い合わせください。

<!--
If you have any questions about how the above might affect your contributions, please feel free to reach out on WP Slack and the [`meta-playground` channel](https://wordpress.slack.com/archives/C04EWKGDJ0K).
-->

ご協力ありがとうございました！🎉

<!--
Thank you again for your contributions! 🎉
-->
