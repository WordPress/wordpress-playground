---
sidebar_position: 1
title: Code Contributions
---

# Code Contributions

The WordPress Playground project uses GitHub for managing code and tracking issues. The main repository is at: [https://github.com/WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground).

To contribute Pull Requests, you'll need to fork the Playground repository and clone it to your local machine. You can then create a branch, make changes, and submit a pull request.

Once you have a fork, you can clone it as follows – just replace `WordPress/wordpress-playground` with your GitHub username and repository name:

```bash
git clone -b trunk --single-branch --depth 1 git@github.com:WordPress/wordpress-playground.git
cd wordpress-playground
nvm use # You'll need Node 16 or later
npm install
npm run dev
```

That's it, WordPress Playground is now running on your machine and you're ready to contribute!

Browse [the issues list](https://github.com/wordpress/wordpress-playground/issues) to find issues to work on. The [good first issue](https://github.com/wordpress/wordpress-playground/issues?q=is%3Aopen+is%3Aissue+label%3A%22Good+First+Issue%22) labels are good starting points.

Be sure to also review the following resources:

-   [Coding Standards](./03-coding-standards.md)
-   [Packages and projects](./04-packages-and-projects.md)
-   [Vision and Philosophy](https://github.com/WordPress/wordpress-playground/issues/472)
-   [Roadmap](https://github.com/WordPress/wordpress-playground/issues/525)
