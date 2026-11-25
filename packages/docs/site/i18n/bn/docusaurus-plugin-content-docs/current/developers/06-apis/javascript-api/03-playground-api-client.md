---
slug: /developers/apis/javascript-api/playground-api-client
---

<!--
# Playground API Client
-->

# প্লেগ্রাউন্ড API ক্লায়েন্ট (Playground API Client) {#playground-api-client}

<!--
The `PlaygroundClient` object implements the `UniversalPHP` interface. All the methods from that interface are also available in Node.js and same-process PHP instances (Playground runs PHP in a web worker).
-->

`PlaygroundClient` অবজেক্টটি `UniversalPHP` ইন্টারফেস ইমপ্লিমেন্ট করে। সেই ইন্টারফেসের সমস্ত মেথড Node.js এবং একই প্রসেসের PHP ইনস্ট্যান্সেও উপলব্ধ (প্লেগ্রাউন্ড একটি ওয়েব ওয়ার্কারে PHP চালায়)।

<!--
Broadly speaking, you can use the client to perform three types of operations:
-->

বিস্তৃতভাবে বলতে গেলে, আপনি ক্লায়েন্ট ব্যবহার করে তিন ধরনের কাজ সম্পাদন করতে পারেন:

<!--
- Running PHP code
- Customizing `PHP.ini`
- Managing files and directories
-->

- PHP কোড চালানো
- `PHP.ini` কাস্টমাইজ করা
- ফাইল এবং ডিরেক্টরি পরিচালনা করা

<!--
## SharedWorker runtime
-->

## SharedWorker রানটাইম (SharedWorker runtime) {#sharedworker-runtime}

<!--
`startPlaygroundWeb()` uses a dedicated worker by default. Applications can opt into
sharing one PHP runtime across tabs on the same origin and browser storage partition.
Serve the matching client and remote runtime from the application's own deployment:
-->

ডিফল্টভাবে `startPlaygroundWeb()` একটি ডেডিকেটেড ওয়ার্কার ব্যবহার করে। অ্যাপ্লিকেশনগুলো একই অরিজিন (origin) এবং ব্রাউজার স্টোরেজ পার্টিশনের একাধিক ট্যাবের মধ্যে একটি একক PHP রানটাইম শেয়ার করার সুবিধা বেছে নিতে পারে। অ্যাপ্লিকেশনের নিজস্ব ডিপ্লয়মেন্ট থেকে মানানসই ক্লায়েন্ট এবং রিমোট রানটাইম পরিবেশন (serve) করুন:

```js
const client = await startPlaygroundWeb({
	iframe: document.getElementById('wp'),
	remoteUrl: new URL('/remote.html', window.location.href).href,
	workerMode: 'shared',
	scope: 'my-site',
});
```

<!--
Shared mode requires browser SharedWorker support and an explicit `scope`. Tabs using
the same scope and build share the initialized site; use different scopes for independent
runtimes. Only the initializing connection runs its startup Blueprint. Closing its tab
once initialization finishes does not interrupt the other tabs. The main Playground
website continues to use dedicated workers.
-->

শেয়ার্ড মোডের জন্য ব্রাউজারের SharedWorker সমর্থন এবং একটি সুস্পষ্ট `scope` প্রয়োজন। একই স্কোপ এবং বিল্ড ব্যবহারকারী ট্যাবগুলো ইনিশিয়ালাইজ করা সাইটটি শেয়ার করে; স্বাধীন রানটাইমের জন্য আলাদা স্কোপ ব্যবহার করুন। শুধুমাত্র ইনিশিয়ালাইজিং সংযোগটি তার স্টার্টআপ ব্লুপ্রিন্ট চালায়। ইনিশিয়ালাইজেশন সম্পন্ন হওয়ার পর সংশ্লিষ্ট ট্যাব বন্ধ করে দিলেও অন্যান্য ট্যাবের কার্যক্রমে কোনো ব্যাঘাত ঘটে না। মূল প্লেগ্রাউন্ড ওয়েবসাইট ডেডিকেটেড ওয়ার্কার ব্যবহার অব্যাহত রাখে।

<!--
By default, both version options use the remote runtime's build version. Applications
that check deployments themselves can pass `sharedWorkerVersion` for the current deployment
and `sharedWorkerClientVersion` for the build loaded by the connecting application. If they
differ, the tab must reload before connecting. A new deployment discovers the previous
worker through localStorage and waits for its shutdown confirmation before replacement.
If that identity is lost or the worker cannot be reached, a replacement may start while
the previous runtime is still running; there is no ownership lock.
-->

ডিফল্টভাবে, উভয় সংস্করণ অপশন রিমোট রানটাইমের বিল্ড সংস্করণ ব্যবহার করে। যে অ্যাপ্লিকেশনগুলো নিজস্ব ডিপ্লয়মেন্ট যাচাই করে, সেগুলো বর্তমান ডিপ্লয়মেন্টের জন্য `sharedWorkerVersion` এবং সংযোগকারী অ্যাপ্লিকেশনের মাধ্যমে লোড হওয়া বিল্ডের জন্য `sharedWorkerClientVersion` পাস করতে পারে। যদি এগুলোর মধ্যে অমিল থাকে, তবে সংযোগ স্থাপনের পূর্বে ট্যাবটি রিলোড করতে হবে। একটি নতুন ডিপ্লয়মেন্ট localStorage-এর মাধ্যমে পূর্ববর্তী ওয়ার্কারকে শনাক্ত করে এবং প্রতিস্থাপনের পূর্বে এটি শাটডাউন নিশ্চিতকরণের জন্য অপেক্ষা করে। যদি সেই পরিচয় হারিয়ে যায় বা ওয়ার্কারের সাথে যোগাযোগ করা না যায়, তবে পূর্ববর্তী রানটাইমটি চালু থাকা অবস্থাতেই একটি প্রতিস্থাপন শুরু হতে পারে; এতে কোনো ওনারশিপ লক (ownership lock) থাকে না।

<!--
The embedding application must handle same-origin `playground-reload-required` messages
from its remote iframe and offer a tab reload. The message's `ready` field indicates
whether shutdown is complete; otherwise wait for `playground-runtime-closed` before
allowing reload. A `shared-runtime-retirement-error` message reports a retirement failure.
Validate the message origin and source against the embedded remote iframe.
-->

এমবেড করা অ্যাপ্লিকেশনকে অবশ্যই তার রিমোট আইফ্রেম থেকে আসা সেম-অরিজিন `playground-reload-required` মেসেজগুলো হ্যান্ডেল করতে হবে এবং ট্যাব রিলোডের সুবিধা দিতে হবে। মেসেজের `ready` ফিল্ডটি নির্দেশ করে শাটডাউন সম্পন্ন হয়েছে কিনা; অন্যথায় রিলোড করার অনুমতি দেওয়ার পূর্বে `playground-runtime-closed`-এর জন্য অপেক্ষা করুন। একটি `shared-runtime-retirement-error` মেসেজ রিটায়ারমেন্ট ব্যর্থতার রিপোর্ট দেয়। এমবেড করা রিমোট আইফ্রেমের বিপরীতে মেসেজের অরিজিন এবং উৎস যাচাই করুন।

<!--
`await client.shutdownSharedRuntime()` explicitly retires the runtime for all connected
tabs: it rejects new work, drains active operations, flushes OPFS, and disposes PHP. It
rejects if retirement fails and is a no-op in dedicated mode. The
`shouldRunStartupBlueprint()` and `finishSharedRuntimeInitialization()` methods are
internal startup coordination hooks; applications should let `startPlaygroundWeb()` call them.
-->

`await client.shutdownSharedRuntime()` সমস্ত সংযুক্ত ট্যাবের জন্য রানটাইমকে স্পষ্টভাবে রিটায়ার (অবসর) করে: এটি নতুন কাজ বাতিল করে, চলমান অপারেশনগুলো সম্পন্ন করে, OPFS ফ্লাশ করে এবং PHP নিষ্কাশন (dispose) করে। রিটায়ারমেন্ট ব্যর্থ হলে এটি রিজেক্ট করে এবং ডেডিকেটেড মোডে এটি কোনো পরিবর্তন আনে না (no-op)। `shouldRunStartupBlueprint()` এবং `finishSharedRuntimeInitialization()` মেথডগুলো অভ্যন্তরীণ স্টার্টআপ সমন্বয় হুক; অ্যাপ্লিকেশনগুলোর উচিত `startPlaygroundWeb()`-কে এগুলো কল করতে দেওয়া।

<!--
## Running PHP code
-->

## PHP কোড চালানো (Running PHP code) {#running-php-code}

<!--
The two methods you can use to run PHP code are:

- [`run()`](#the-run-method) - runs PHP code and returns the output
- [`request()`](#the-request-method) - makes an HTTP request to the website

In Node.js, you can also use the [`cli()`](#the-cli-method) method to run PHP in a CLI mode.
-->

PHP কোড চালানোর জন্য আপনি যে দুটি মেথড ব্যবহার করতে পারেন তা হলো:

- [`run()`](#the-run-method) - PHP কোড চালায় এবং আউটপুট প্রদান করে
- [`request()`](#the-request-method) - ওয়েবসাইটে একটি HTTP রিকোয়েস্ট পাঠায়

Node.js-এ, আপনি CLI মোডে PHP চালানোর জন্য [`cli()`](#the-cli-method) মেথডও ব্যবহার করতে পারেন।

<!--
### The `run()` method
-->

### run() মেথড (The `run()` method) {#the-run-method}

<!--
The handbook imports static/handbook/playground-api-client.md, generated
from this page and TypeDoc by bin/generate-handbook-api-client.js. Keep the
TSDocstring components here so the generated API descriptions stay in sync.
-->

import TSDocstring from '@site/src/components/TSDocstring';

<TSDocstring path={[ "@wp-playground/client", "PlaygroundClient", "run" ]} />

<!--
### The `request()` method
-->

### request() মেথড (The `request()` method) {#the-request-method}

<TSDocstring path={[ "@wp-playground/client", "PlaygroundClient", "request" ]} />

<!--
## Customizing `PHP.ini`
-->

## `PHP.ini` কাস্টমাইজ করা (Customizing `PHP.ini`) {#customizing-phpini}

<!--
The API client also allows you to change the `php.ini` file:
-->

API ক্লায়েন্ট আপনাকে `php.ini` ফাইল পরিবর্তন করার সুবিধাও দেয়:

```ts
await setPhpIniEntries(client, {
	display_errors: 'On',
	error_reporting: 'E_ALL',
});
```

<!--
## Managing files and directories
-->

## ফাইল এবং ডিরেক্টরি পরিচালনা করা (Managing files and directories) {#managing-files-and-directories}

<!--
The `client` object provides you with a low-level API for managing files and directories in the PHP filesystem:
-->

PHP ফাইলসিস্টেমে ফাইল এবং ডিরেক্টরি পরিচালনার জন্য `client` অবজেক্ট আপনাকে একটি লো-লেভেল API প্রদান করে:

```ts
await client.mkdirTree('/wordpress/test');
// Create a new PHP file
await client.writeFile(
	'/wordpress/test/index.php',
	`<?php
     echo "Hello, world!<br/>";
     // List all the files in current directory
     print_r(glob(__DIR__ . '/*'));
  `
);
// Create files named 1, 2, and 3
await client.writeFile('/wordpress/test/1', '');
await client.writeFile('/wordpress/test/2', '');
await client.writeFile('/wordpress/test/3', '');
// Remove the file named 1
await client.unlink('/wordpress/test/1');
// Navigate to our PHP file
await client.goTo('/test/index.php');
```

<!--
For a complete list of these methods, refer to the `PlaygroundClient` interface.
-->

এই মেথডগুলোর সম্পূর্ণ তালিকার জন্য `PlaygroundClient` ইন্টারফেসটি দেখুন।

<!--
## Sending messages to JavaScript
-->

## জাভাস্ক্রিপ্টে মেসেজ পাঠানো (Sending messages to JavaScript) {#sending-messages-to-javascript}

<!--
You can pass messages from PHP to JavaScript using the `post_message_to_js()` function. It accepts one argument:

- `$data` (string) – Data to pass to JavaScript.
-->

আপনি `post_message_to_js()` ফাংশন ব্যবহার করে PHP থেকে জাভাস্ক্রিপ্টে মেসেজ পাঠাতে পারেন। এটি একটি আর্গুমেন্ট গ্রহণ করে:

- `$data` (string) – জাভাস্ক্রিপ্টে পাঠানোর ডেটা।

<!--
For example, here's how you would send a message with a JSON-encoded post ID and title:
-->

উদাহরণস্বরূপ, একটি JSON-এনকোডেড পোস্ট আইডি এবং শিরোনাম সহ কীভাবে একটি মেসেজ পাঠাবেন তা নিচে দেওয়া হলো:

```TypeScript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.3'));

php.onMessage(
	// The data is always passed as a string
	function (data: string) {
		// Let's decode and log the data:
		console.log(JSON.parse(data));
	}
);

// Now that we have a listener in place, let's
// dispatch a message:
await php.runStream({
	code: `<?php
        post_message_to_js(
            json_encode([
                'post_id' => '15',
                'post_title' => 'This is a blog post!'
            ])
        );
    `,
});

// You will see the following output in the console:
// { post_id: '15', post_title: 'This is a blog post!' }
```

<!--
## The `cli()` method
-->

## cli() মেথড (The `cli()` method) {#the-cli-method}

<!--
In Node.js, you also have access to the `cli()` method that runs PHP in a CLI mode:
-->

Node.js-এ, আপনার `cli()` মেথডের অ্যাক্সেসও রয়েছে যা একটি CLI মোডে PHP চালায়:

```ts
// Run PHP in a CLI mode
client.cli(['-r', 'echo "Hello, world!";']);
// Outputs "Hello, world!"
```

<!--
Once `cli()` method finishes running, the PHP instance is no longer usable and should be discarded. This is because PHP internally cleans up all the resources and calls `exit()`.
-->

একবার `cli()` মেথড চলা শেষ হলে, PHP ইনস্ট্যান্সটি আর ব্যবহারযোগ্য থাকে না এবং তা বাতিল করা উচিত। এর কারণ হলো PHP অভ্যন্তরীণভাবে সমস্ত রিসোর্স পরিষ্কার করে এবং `exit()` কল করে।
