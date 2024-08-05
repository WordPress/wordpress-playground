---
title: Playground in native iOS apps
slug: /guides/wordpress-native-ios-app
description: WordPress Playground in native iOS apps
---

## How to ship a real WordPress site in a native iOS app via Playground?

Blocknotes is the first iOS application that ran WordPress natively on iOS devices by leveraging WordPress Playground. Developed by [Ella van Durpe](https://profiles.wordpress.org/ellatrix/), a core committer for WordPress, Blocknotes represents a significant leap in the capabilities of mobile applications by utilizing WebAssembly to run WordPress without the need for a traditional PHP server.

This case study explores the features, technical implementation, and potential implications of Blocknotes for the future of mobile and web development.

**Important!** The current version of Blocknotes isn’t running WordPress Playground anymore. Since the initial release, the app was rewritten to only use the WordPress block editor without the rest of WordPress. This case study covers the early versions of Blocknotes that opened an entire world of new possibilities for WordPress.

## Blocknotes features

Blocknotes allows users to create and edit notes using the WordPress block editor. The notes are automatically saved as HTML files to the user’s iCloud Drive and seamlessly synchronized across devices.

## Technical Implementation

Blocknotes operated as a WebView running an HTML page where a WebAssembly version of PHP was running WordPress. That HTML page was packaged as a native iOS via [Capacitor](https://capacitorjs.com/). This setup allowed WordPress to function in environments traditionally not supported.

In [Blocknotes GitHub repository](https://github.com/blocknotes-org/blocknotes/tree/e08535883332be9a45a0c75b750c54a4e17f6748) you can review the last Playground-based release. Here are the most important parts:

-   [A WordPress build](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/wp-6.2.data) (packaged as a `.data` file).
-   [Static WordPress assets](https://github.com/blocknotes-org/blocknotes/tree/e08535883332be9a45a0c75b750c54a4e17f6748/public).
-   [A WebAssembly build of PHP](https://github.com/blocknotes-org/blocknotes/tree/e08535883332be9a45a0c75b750c54a4e17f6748/node_modules/%40php-wasm/web) (via [@php-wasm/web](https://npmjs.com/package/@php-wasm/web)).
-   [A web worker running PHP and WordPress](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/worker.js).
-   [Hypernotes](https://wordpress.com/plugins/hypernotes) WordPress plugin ([installed here](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/index.js#L160)) to turn wp-admin into a note-taking app.
-   A layer to [load WordPress posts from iOS files](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/index.js#L39) and [save changes as iOS files](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/save-data.js).

## Building your own iOS app with WordPress Playground

Although Blocknotes proved releasing a WordPress-based iOS app is possible, this is still a highly exploratory area. There are no established workflows, libraries, or knowledge bases.

The best documentation we have is the Blocknotes repository. Use it as a reference and a starting point for exploring your new app. Review the key components like the WebAssembly build of PHP, the integration of the WordPress block editor, and how web workers are utilized to run WordPress efficiently. By dissecting these elements, you can gain insights into building your own iOS app with WordPress Playground, pushing the boundaries of what’s possible with mobile web applications.

As you navigate this innovative space, share your findings and challenges with the Playground team and the broader WordPress community. Publishing your learnings will not only aid in your development but also contribute to a collective knowledge base, driving forward the future of WordPress on mobile.

## Potential and the future

Blocknotes paves the way for a new generation of applications that are more accessible, flexible, and powerful.

Once the app-building workflows mature, we may see an automated pipelines for packaging Playground sites as iOS apps. It would make it extremely easy to run the same codebase on the server, in the browser, and as a mobile app.

By working together and sharing our findings, we can push the boundaries of what’s possible with WordPress and mobile app development
