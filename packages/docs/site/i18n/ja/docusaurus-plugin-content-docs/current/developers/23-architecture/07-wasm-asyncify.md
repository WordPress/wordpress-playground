# Asyncify

<!--
# Asyncify
-->

[Asyncify](https://emscripten.org/docs/porting/asyncify.html) は、同期CまたはC++コードと非同期JavaScriptの連携を可能にします。技術的には、JavaScriptに制御を戻す前にCのコールスタック全体を保存し、非同期呼び出しが終了した時点でそれを復元します。これは**スタックスイッチング**と呼ばれます。

<!--
[Asyncify](https://emscripten.org/docs/porting/asyncify.html) lets synchronous C or C++ code interact with asynchronous JavaScript. Technically, it saves the entire C call stack before yielding control back to JavaScript, and then restores it when the asynchronous call is finished. This is called **stack switching**.
-->

WebAssembly PHP ビルドのネットワークサポートは Asyncify を使用して実装されています。PHP がネットワークリクエストを行うと、制御は JavaScript に返され、JavaScript がリクエストを行い、レスポンスの準備が整うと PHP が再開されます。この仕組みは十分に機能しており、PHP ビルドは Web API のリクエスト、Composer パッケージのインストール、さらにはMySQL サーバーへの接続も実行できます。

<!--
Networking support in the WebAssembly PHP build is implemented using Asyncify. When PHP makes a network request, it yields control back to JavaScript, which makes the request, and then resumes PHP when the response is ready. It works well enough that PHP build can request web APIs, install composer packages, and even connect to a MySQL server.
-->

## Asyncify クラッシュ

<!--
## Asyncify crashes
-->

スタック切り替えには、非同期呼び出しを行う際にコールスタックに存在する可能性のあるすべてのC関数をラップする必要があります。すべてのC関数を一括ラップすると**重大な**オーバーヘッドが発生します。そのため、具体的な関数名のリストを保持しています。

<!--
Stack switching requires wrapping all C functions that may be found at a call stack at a time of making an asynchronous call. Blanket-wrapping of every single C function adds a **significant** overhead, which is why we maintain a list of specific function names:
-->

https://github.com/WordPress/wordpress-playground/blob/15a660940ee9b4a332965ba2a987f6fda0c159b1/packages/php-wasm/compile/Dockerfile#L624-L632

残念ながら、このリストに1つでも項目が欠けていると、非同期呼び出し時にその関数がコールスタックの一部になっていると、WebAssembly がクラッシュします。これは次のようになります。

<!--
Unfortunately, missing even a single item from that list results in a WebAssembly crash whenever that function is a part of the call stack when an asynchronous call is made. It looks like this:
-->

![A screenshot of an asyncify error in the terminal](@site/static/img/developers/asyncify-error.webp)

Asyncify は `ASYNCIFY_ONLY` なしでビルドした場合、必要な C 関数をすべて自動リスト化できますが、この自動検出は過剰であり、最終的に約 70,000 個の C 関数がリスト化され、起動時間が 4.5 秒にまで増加します。そのため、リストは手動で管理しています。

<!--
Asyncify can auto-list all the required C functions when built without `ASYNCIFY_ONLY`, but that auto-detection is overeager and ends up listing about 70,000 C functions which increases the startup time to 4.5s. That's why we maintain the list manually.
-->

詳細にご興味がおありの場合は、[GitHub の問題 251](https://github.com/WordPress/wordpress-playground/issues/251) を参照してください。

<!--
If you are interested in more details, [see GitHub issue 251](https://github.com/WordPress/wordpress-playground/issues/251).
-->

## Asyncify のクラッシュを修正

<!--
## Fixing Asyncify crashes
-->

[Pull Request 253](https://github.com/WordPress/wordpress-playground/pull/253) は、特殊なテスト スイートを実行し、不足していることが判明した C 関数を `ASYNCIFY_ONLY` リストに自動的に追加する `fix-asyncify` コマンドを追加します。

<!--
[Pull Request 253](https://github.com/WordPress/wordpress-playground/pull/253) adds a `fix-asyncify` command that runs a specialized test suite and automatically adds any identified missing C functions to the `ASYNCIFY_ONLY` list.
-->

上記のようなクラッシュが発生した場合は、次の方法で修正できます。

<!--
If you run into a crash like the one above, you can fix it by:
-->

1. クラッシュの原因となる PHP コードパスを特定します。ターミナルのスタックトレースが役立つはずです。
2. クラッシュを引き起こすテストケースを`packages/php-wasm/node/src/test/php-asyncify.spec.ts`に追加します。
3. `npm run fix-asyncify`を実行します。
4. テストケース、更新された Dockerfile、再構築された PHP.wasm をコミットします。

<!--
1. Identifying a PHP code path that triggers the crash – the stack trace in the terminal should help with that.
2. Adding a test case that triggers a crash to `packages/php-wasm/node/src/test/php-asyncify.spec.ts`
3. Running: `npm run fix-asyncify`
4. Committing the test case, the updated Dockerfile, and the rebuilt PHP.wasm
-->

## 今後の JSPI API では Asyncify は不要になります

<!--
## The upcoming JSPI API will make Asyncify unnecessary
-->

最終的には、[V8 がスタック切り替えを自動で処理し](https://github.com/WordPress/wordpress-playground/issues/134)、この問題は完全に解消されるでしょう。[Issue 134](https://github.com/WordPress/wordpress-playground/issues/134) では、その取り組みの進捗状況を追跡しています。

<!--
Eventually, [V8 will likely handle stack switching for us](https://github.com/WordPress/wordpress-playground/issues/134) and remove this problem entirely. [Issue 134](https://github.com/WordPress/wordpress-playground/issues/134) tracks the status of that effort.
-->

@fgmccabe からの [関連メモ](https://github.com/fgmccabe) は次のとおりです。

<!--
Here's [a relevant note](https://github.com/fgmccabe) from @fgmccabe:
-->

> V8 の現在の実装は、実質的に「実験段階」です。arm64 と x64 の実装があります。
> 次のステップは、32 ビット ARM/Intel への実装です。そのためには、これまで解決する必要のなかったいくつかの問題を解決する必要があります。
> Node.js については、おそらくフラグの背後で既に Node.js に組み込まれているでしょう。
> フラグの要件を削除するには、他の実装が必要になります。その時期は今年末頃になる見込みですが、もちろんリソースと資金次第です。
> さらに、標準化の取り組みをさらに進める必要がありますが、「小規模」な仕様であることを考えると、長期的な負担にはならないはずです。
> これがロードマップの理解に役立つことを願っています :)

<!--
> The current implementation in V8 is essentially 'experimental status'. We have arm64 and x64 implementations.
> The next steps are to implement on 32 bit arm/intel. That requires us to solve some issues that we did not have to solve so far.
> As for node.js, my guess is that it is already in node, behind a flag.
> To remove the flag requirement involves getting other implementations. The best estimate for that is towards the end of this year; but it obviously depends on resources and funding.
> In addition, it would need further progress in the standardization effort; but, given that it is a 'small' spec, that should not be a long term burden.
> Hope that this helps you understand the roadmap :)
-->
