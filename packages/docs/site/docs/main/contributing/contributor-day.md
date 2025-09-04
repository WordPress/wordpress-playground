---
slug: /contributing/contributor-day
title: WordCamp Contributor Day
description: A guide on how to contribute to the WordPress Playground, and it can support you at Contributor Day.
---

# WordCamp Contributor Day

WordCamp Contributor Day is an event where the WordPress community comes together to contribute to the WordPress project. This guide focuses on how you can contribute to the WordPress Playground project or how the Playground can assist you in contributing to WordPress Core.

## Who Can Contribute?

Some events will have a dedicated table for the project. The WordPress Playground contributor tables welcome all kinds of contributions, not just from developers. Whether you are a writer, coder, tester, plugin or theme developer, marketer, site owner, or any other type of user, you are encouraged to contribute.

We value diverse contributions across various areas, including community building, testing, documentation, and design.

## How to Contribute to the Playground Project

This section outlines how you can contribute directly to the WordPress Playground project and its associated tools:

-   **Documentation:** Enhance our documentation by improving existing content, developing new guides, or translating materials into different languages.
-   **Blueprints:** Create plugin demos for plugins at the WordPress Plugin repository, or develop new Blueprints to enrich our project documentation.
-   **Testing the Playground Environment:** Engage in testing the WordPress Playground project itself. You can do this by carefully crafting new issues that describe problems you encounter and suggesting actionable solutions. Test our WordPress web instance (the playground.wordpress.net site), or explore the various applications powered by Playground. Test these tools, observe their functionality, and provide detailed feedback.
-   **Product Feedback:** Your insights are invaluable for improving the Playground experience. This includes general feedback on the web instance, the application, and any server-side tools.

All feedback, including reported issues and test results, can be submitted through our GitHub repository.

### Follow-up and Continued Engagement

While many tasks are completed during the event, your contribution journey doesn't have to end there. You are welcome to continue working on your issues or pull requests after Contributor Day. We anticipate ongoing activity from contributors who take on tasks beyond the event. Please note that if a pull request shows no activity for one month, it may be considered abandoned and subsequently closed.

### Getting Help and Staying Engaged

During Contributor Day, you can find direct assistance and interact with us at the dedicated Playground table. For continuous support and community interaction, you can connect with us on the `#playground` channel on WordPress Slack or via GitHub.

## How to use Playground at Contributor Day

Now we are going to cover how the Playground can assist you during the Contributor Day. The [WordPress Playground VS Code extension](https://marketplace.visualstudio.com/items?itemName=WordPressPlayground.wordpress-playground) and [@wp-playground/cli](https://www.npmjs.com/package/@wp-playground/cli) streamline the process of setting up a local WordPress environment. WordPress Playground powers both—no Docker, MySQL, or Apache required.

Keep reading to learn how to use these tools for [local development](/developers/local-development/wp-playground-cli) when contributing to WordPress. Please note that the extension and the NPM package are under development, and not all [Make WordPress teams](https://make.wordpress.org/) are fully supported.

## Getting Started

### VS Code Playground extension

The [Visual Studio Code Playground extension](https://marketplace.visualstudio.com/items?itemName=WordPressPlayground.wordpress-playground) is a friendly zero-setup development environment.

1. Open VS Code and navigate to the **Extensions** tab (**View > Extensions**).
2. In the search bar, type _WordPress Playground_ and click **Install**.
3. To interact with Playground, click the new icon in the **Activity Bar** and hit the **Start WordPress Server** button.
4. A new tab will open in your browser within seconds.

### @wp-playground/cli NPM package

[`@wp-playground/cli`](/developers/local-development/wp-playground-cli) is a CLI tool that allows you to spin up a WordPress site with a single command. No Docker, MySQL, or Apache are required.

#### Prerequisites

`@wp-playground/cli` requires Node.js 20.18 or newer and NPM. If you haven’t yet, [download and install](https://nodejs.org/en/download) both before you begin.

Depending on the Make WordPress team you contribute to, you may need a different Node.js version than the one you have installed. You can use Node Version Manager (NVM) to switch between versions. [Find the installation guide here](https://github.com/nvm-sh/nvm#installing-and-updating).

#### Running `@wp-playground/cli`

You don’t have to install `@wp-playground/cli` on your device to use it. Navigate to your plugin or theme directory and start `@wp-playground/cli` with the following commands:

```bash
cd my-plugin-or-theme-directory
npx @wp-playground/cli@latest server --auto-mount
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

If you’re unsure about the steps listed above, visit the official [Gutenberg Project Contributor Guide](https://developer.wordpress.org/block-editor/contributors/). Note that in this case, `@wp-playground/cli` replaces `wp-env`.

:::

Open a new terminal terminal tab, navigate to the Gutenberg directory, and start WordPress using `@wp-playground/cli`:

```bash
cd gutenberg
npx @wp-playground/cli@latest server --auto-mount
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
npx @wp-playground/cli@latest server --auto-mount
```

#### Test a Gutenberg PR with Playground in the browser

You don’t need a [local development environment](/developers/local-development/) to test Gutenberg PRs—use Playground to do it directly in the browser.

1. Copy the ID of the PR you’d like to test (pick one from the [list of open Pull Requests](https://github.com/WordPress/gutenberg/pulls)).
2. Open Playground’s [Gutenberg PR Previewer](https://playground.wordpress.net/gutenberg.html) and paste the ID you copied.
3. Once you click **Go**, Playground will verify the PR is valid and open a new tab with the relevant PR, allowing you to review the proposed changes.

## Translate WordPress Plugins with Playground in the browser

You can translate supported WordPress Plugins by loading the plugin you want to translate and use Inline Translation. If the plugin developers have added the option, you'll find the **Translate Live** link on the top right toolbar of the translation view. You can read more about this exciting new option on [this Polyglots blog post](https://make.wordpress.org/polyglots/2023/05/08/translate-live-updates-to-the-translation-playground/).

## Get help and contribute to WordPress Playground

Have a question or an idea for a new feature? Found a bug? Something’s not working as expected? We’re here to help:

-   During Contributor Day, you can reach us at the **Playground table**.
-   Open an issue on the [WordPress Playground GitHub repository](https://github.com/WordPress/wordpress-playground/issues/new). If your focus is the VS Code extension, NPM package, or the plugins, open an issue on the [Playground Tools repository](https://github.com/WordPress/playground-tools/issues/new).
-   Share your feedback on the [**#playground** Slack channel](https://wordpress.slack.com/archives/C04EWKGDJ0K).
