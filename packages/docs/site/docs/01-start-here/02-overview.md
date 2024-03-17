---
title: Overview
slug: /overview
---

# Overview

WordPress Playground is an online platform that allows you to experiment and learn about WordPress without affecting your live website. It's a virtual sandbox where you can play around with different features, designs, and settings in a safe and controlled environment.

## Here's how it works

When you first start using WordPress Playground, you'll be provided with a separate space where you can create and customise your own WordPress website. This space is completely isolated from your actual website.

## Try themes and plugins on the fly

Within the WordPress Playground, you can explore various [themes](https://developer.wordpress.org/themes/getting-started/what-is-a-theme/). You can choose from a wide range of themes and see how they look on your site. You can also modify the colors, fonts, layouts, and other visual elements to create a unique design.
In addition to themes, you can experiment with plugins too. With WordPress Playground, you can install and test different plugins to see how they work and what they can do for your site. This allows you to explore and understand the capabilities of WordPress without worrying about breaking anything.

## Create content on the go

Another great feature of WordPress Playground is the ability to create and edit content. You can write blog posts, create pages and add media like images and videos to your site. This helps you understand how to organize and structure your content effectively.

The content you create is limited to the Playground on your device and disappears once you leave it, so you are free to explore and play without risking breaking any actual site.

## And, yes it's safe

Overall, WordPress Playground provides a risk-free environment for beginners to learn and get hands-on experience with WordPress. It helps you to gain confidence and knowledge before making changes to your live website.

## What makes Playground different from running WordPress on a web server or local desktop app?

Web applications like WordPress have long-relied on server technologies [to run logic](https://wordpress.github.io/wordpress-playground/architecture/wasm-php-overview) and [to store data](https://wordpress.github.io/wordpress-playground/architecture/wordpress#sqlite).

Using those technologies has meant either running an web server connected to the internet or using those technologies in a desktop service or app (sometimes called a "WordPress local environment") that either leans on a virtual server with the technologies installed or the underlying technologies on the current device.

**Playground is a novel way to stream server technologies -- and WordPress _(and WP-CLI)_ -- as files that can then run in the browser.**

### _Streamed_, not served.

The WordPress you see when you open Playground in your browser is a WordPress that should function like any WordPress, with [a few limitations](https://wordpress.github.io/wordpress-playground/limitations) and the important exception that it's not a permanent server with an internet address which will limit connections to some third-party services (automation, sharing, analysis, email, backups, etc.) in a persistient way.

The loading screen and progress bar you see on Playground includes both the streaming of those foundational technologies to your browser and configuration steps [(examples)](https://wordpress.github.io/wordpress-playground/blueprints-api/examples) from [WordPress Blueprints](https://github.com/WordPress/blueprints-library), so that a full server, WordPress software, Theme & Plugin solutions and configuration instructions can be streamed over-the-wire.

While many WordPress solutions may require internet connectivity to interact with social networks, live feeds and other internet services, those kind of connections [could be limited in Playground](https://wordpress.github.io/wordpress-playground/architecture/wasm-php-overview/#networking-support-varies-between-platforms). However, by enabling network connectivity in the Customize Playground settings modal [(example URL w/ query parameter)](https://playground.wordpress.net/?networking=yes), you can mostly wire-up internet connectivity to the WordPress in Playground.
