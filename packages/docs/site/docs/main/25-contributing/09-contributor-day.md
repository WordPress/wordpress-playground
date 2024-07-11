---
slug: /wordcamp-contributor-day
---

# WordCamp Contributor Day

The [WordPress Playground VS Code extension](https://marketplace.visualstudio.com/items?itemName=WordPressPlayground.wordpress-playground) and [wp-now](https://www.npmjs.com/package/@wp-now/wp-now) streamline the process of setting up a local WordPress environment. WordPress Playground powers both—no Docker, MySQL, or Apache required.

Keep reading to learn how to use these tools for [local development](../../developers/05-local-development/01-wp-now.md) when contributing to WordPress. Please note that the extension and the NPM package are under development, and not all [Make WordPress teams](https://make.wordpress.org/) are fully supported.

## Getting Started

If you’re a visual learner, here’s a step-by-step video tutorial. If you prefer reading at your own pace, skip to the written instructions below.

<iframe title="Getting Started with wp-now for WordPress development at Contributor Day" width="752" height="423" src="https://video.wordpress.com/embed/Gn7XOCAM?cover=1&amp;preloadContent=metadata&amp;useAverageColor=1&amp;hd=1&amp;metadata_token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJ3b3JkcHJlc3MuY29tIiwiaWF0IjoxNjg2MTQ4ODQ5LCJleHAiOjE2ODYzMjE2NDksImJsb2dfaWQiOiIyMDMxMjIxMTIiLCJndWlkIjoiR243WE9DQU0iLCJhdXRoIjoidmlkZW9wcmVzc19wbGF5YmFja190b2tlbiIsImFjY2VzcyI6InZpZGVvIiwiZXhwaXJlcyI6MTY4NjMyMTY0OX0.DJWVfePHl2nUKo8ziG81CK2VlG5Ui8vNg-dZJ7dOSq8" allow="fullscreen" loading="eager"></iframe>

### VS Code Playground extension

The [Visual Studio Code Playground extension](https://marketplace.visualstudio.com/items?itemName=WordPressPlayground.wordpress-playground) is a friendly zero-setup development environment.

1. Open VS Code and navigate to the **Extensions** tab (**View > Extensions**).
2. In the search bar, type _WordPress Playground_ and click **Install**.
3. To interact with Playground, click the new icon in the **Activity Bar** and hit the **Start WordPress Server** button.
4. A new tab will open in your browser within seconds.

### wp-now NPM package

`@wp-now/wp-now` is a CLI tool that allows you to spin up a WordPress site with a single command. No Docker, MySQL, or Apache are required.

#### Prerequisites

`wp-now` requires Node.js and NPM. If you haven’t yet, [download and install](https://nodejs.org/en/download) both before you begin.

Depending on the Make WordPress team you contribute to, you may need a different Node.js version than the one you have installed. You can use Node Version Manager (NVM) to switch between versions. [Find the installation guide here](https://github.com/nvm-sh/nvm#installing-and-updating).

#### Run wp-now

You don’t have to install `wp-now` on your device to use it. Navigate to your plugin or theme directory and start `wp-now` with the following commands:

```bash
cd my-plugin-or-theme-directory
npx @wp-now/wp-now start
```

## Ideas for contributors

### Create a Gutenberg Pull Request (PR)

1. Fork the [Gutenberg repository](https://github.com/WordPress/gutenberg) in your GitHub account.
2. Then, clone the forked repository to download the files.
3. Install the necessary dependencies and build the code in development mode.

```bash
git clone git@github.com:WordPress/gutenberg.git
cd gutenberg
npm install
npm run dev
```

:::info

If you’re unsure about the steps listed above, visit the official [Gutenberg Project Contributor Guide](https://developer.wordpress.org/block-editor/contributors/). Note that in this case, `wp-now` replaces `wp-env`.

:::

Open a new terminal terminal tab, navigate to the Gutenberg directory, and start WordPress using `wp-now`:

```bash
cd gutenberg
npx @wp-now/wp-now start
```

When you’re ready, commit and push your changes to your forked repository on GitHub and open a Pull Request on the Gutenberg repository.

### Test a Gutenberg PR

1. To test other Gutenberg PRs, checkout the branch associated with it.
2. Pull the latest changes to ensure your local copy is up to date.
3. Next, install the necessary dependencies, ensuring your testing environment matches the latest changes.
4. Finally, build the code in development mode.

```bash
# copy the branch-name from GitHub #
git checkout branch-name
git pull
npm install
npm run dev

# In a different terminal inside the Gutenberg directory *
npx @wp-now/wp-now start
```

#### Test a Gutenberg PR with Playground in the browser

You don’t need a local development environment to test Gutenberg PRs—use Playground to do it directly in the browser.

1. Copy the ID of the PR you’d like to test (pick one from the [list of open Pull Requests](https://github.com/WordPress/gutenberg/pulls)).
2. Open Playground’s [Gutenberg PR Previewer](https://playground.wordpress.net/gutenberg.html) and paste the ID you copied.
3. Once you click **Go**, Playground will verify the PR is valid and open a new tab with the relevant PR, allowing you to review the proposed changes.

## Translate WordPress Plugins with Playground in the browser

You can translate supported WordPress Plugins by loading the plugin you want to translate and use Inline Translation. If the plugin developers have added the option, you'll find the **Translate Live** link on the top right toolbar of the translation view. You can read more about this exciting new option on [this Polyglots blog post](https://make.wordpress.org/polyglots/2023/05/08/translate-live-updates-to-the-translation-playground/).

## Get help and contribute to WordPress Playground

Have a question or an idea for a new feature? Found a bug? Something’s not working as expected? We’re here to help:

-   During Contributor Day, you can reach us at the **Playground table**.
-   Open an issue on the [WordPress Playground GitHub repository](https://github.com/WordPress/wordpress-playground/issues/new). If your focus is the VS Code extension, NPM package, or the plugins, open an issue on the [Plaground Tools repository](https://github.com/WordPress/playground-tools/issues/new).
-   Share your feedback on the [**#meta-playground** Slack channel](https://wordpress.slack.com/archives/C04EWKGDJ0K).
