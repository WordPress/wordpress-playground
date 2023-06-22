---
title: WordCamp Contributor Day
slug: /wordcamp-contributor-day
---

# WordCamp Contributor Day

The WordPress Playground VS Code extension and wp-now are tools that streamline the process of setting up a local WordPress environment. Both are powered by WordPress Playground, eliminating the need for other tools like Docker and MySQL.

Read on to see how you can use either for contributing to WordPress. Please note that they’re currently in an alpha state and not all Make teams are fully supported.

## Getting Started

If you're a visual learner – here's a step-by-step video for you! If you prefer reading at your own pace, you're welcome to skip over to the written instructions below.

<iframe title="Getting Started with wp-now for WordPress development at Contributor Day" aria-label="Getting Started with wp-now for WordPress development at Contributor Day" width="752" height="423.2" src="https://video.wordpress.com/embed/Gn7XOCAM?cover=1&amp;preloadContent=metadata&amp;useAverageColor=1&amp;hd=1&amp;metadata_token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJ3b3JkcHJlc3MuY29tIiwiaWF0IjoxNjg2MTQ4ODQ5LCJleHAiOjE2ODYzMjE2NDksImJsb2dfaWQiOiIyMDMxMjIxMTIiLCJndWlkIjoiR243WE9DQU0iLCJhdXRoIjoidmlkZW9wcmVzc19wbGF5YmFja190b2tlbiIsImFjY2VzcyI6InZpZGVvIiwiZXhwaXJlcyI6MTY4NjMyMTY0OX0.DJWVfePHl2nUKo8ziG81CK2VlG5Ui8vNg-dZJ7dOSq8" frameborder="0" allowfullscreen="" data-resize-to-parent="true" allow="clipboard-write"></iframe>

### VSCode Playground extension

[Visual Studio Code Playground extension](https://marketplace.visualstudio.com/items?itemName=WordPressPlayground.wordpress-playground) offers a friendly user interface to a local WordPress environment.

To get started, open your Visual Studio Code and navigate to the extensions tab. In the search bar, type 'WordPress playground' and click 'Install'. This will add a new icon on your sidebar.

## wp-now

### Minimum Requirements

To get started with wp-now, you need to have Node and npm installed on your system. You can follow this guide to install them: [Node and npm installation guide](https://nodejs.org/en/download/package-manager). We also recommend using nvm to easily change the node version: [nvm installation guide](https://github.com/nvm-sh/nvm#installing-and-updating).

### Installing

You can globally install wp-now npm package in your machine, or if you prefer, you can run these commands directly from your browser using GitHub codespaces.: [https://www.npmjs.com/package/@wp-now/wp-now](https://www.npmjs.com/package/@wp-now/wp-now).

```
npm install -g @wp-now/wp-now
```

### Running

To start a new server, navigate to your WordPress plugin or theme directory and run the command wp-now start. This will start the server with the default PHP and WordPress versions. A new tab will open automatically in your browser.

```
cd gutenberg
wp-now start
```

You can stop wp-now by killing the process by pressing the keys `CTRL + C`.

To change the PHP or WordPress version, you can use the `--php` and `--wp` arguments. For example, to start a server with PHP 7.4 and WordPress 6.1, you can run:

```
wp-now start --php 7.4 --wp 6.1
```

## Contributing to Gutenberg

### Create a Gutenberg PR Step By Step

Begin by creating a fork of the Gutenberg repository using your GitHub account. Once you've done that, clone your forked repository to your local machine to download the code. Following this, install the necessary dependencies and build the Gutenberg files.

```
git clone git@github.com:WordPress/gutenberg.git
cd gutenberg
npm install
npm run dev
```

Ensure that wp-now is installed on your system. Then, open a new terminal window and start the WordPress server by executing the wp-now command.

```
cd gutenberg
wp-now start
```

Commit and push your changes to your forked repository on GitHub and create a new pull request on the Gutenberg repository.

For more in detail information, check the block editor handbook: https://developer.wordpress.org/block-editor/contributors/code/getting-started-with-code-contribution/#getting-the-gutenberg-code

### Test a Gutenberg PR Step By Step

To test a Gutenberg PR with wp-now, start by navigating to the PR on the Gutenberg repository. Once there, checkout the PR branch to switch your local environment to the version of the code that includes the proposed changes. After checking out the branch, pull the latest changes to ensure your local copy is up to date. Next, run npm install to ensure all dependencies are up to date. This step is crucial as it ensures that your testing environment matches the one in which the changes were made. Finally, test the changes in your local environment. This could involve running unit tests and manually testing features in a browser.

```
# copy the branch-name from GitHub
git checkout branch-name
git pull
npm install
npm run dev

# In a different terminal inside the gutenberg folder
wp-now start
```

### Test a Gutenberg PR with the web version of WordPress Playground

You can manually test a Gutenberg pull request directly from your browser. Given a pull request URL, https://github.com/WordPress/gutenberg/pull/51239, copy the ID (in this case, `51239`) and paste it at https://playground.wordpress.net/gutenberg.html. Use your specific pull request ID. Once you press "Go," your Pull Request will open in a new WordPress Playground where you can review the proposed changes!

![Mermaid chart](https://github.com/WordPress/wordpress-playground/assets/779993/d4bc5a27-1401-4f35-bc68-2fad0ef699d5)

## Translate WordPress Plugins using the WordPress Playground

You can translate WordPress Plugins and Themes the traditional way in the table view at https://translate.wordpress.org/, or you can load the plugin to be translated and use Inline Translation to do so. Find the `Translate Live` link on the top right of the translation view for this. See [this blog post for more context](https://make.wordpress.org/polyglots/2023/05/08/translate-live-updates-to-the-translation-playground/).

## Contributing to other Make projects

At this time, contributing to other Make projects is not fully supported at this time.

## Known Limitations

wp-now is in alpha version. Check out the known issues [https://github.com/WordPress/playground-tools/blob/trunk/packages/wp-now/README.md#known-issues](https://github.com/WordPress/playground-tools/blob/trunk/packages/wp-now/README.md#known-issues).

## Getting Help and Contributing to WordPress Playground

If you encounter any issues when running your project with 'wp-now' or the VSCode Playground extension, don't hesitate to reach out to the Playground table or ask in the #meta-playground Slack channel. Someone will be around to assist you during the day.

If you come across a bug or if you have an idea for a potential feature, we encourage you to share your input. You can create an issue on our GitHub repository at [https://github.com/WordPress/playground-tools](https://github.com/WordPress/playground-tools). Alternatively, you can share your thoughts in the ‘#meta-playground’ channel on Slack.
