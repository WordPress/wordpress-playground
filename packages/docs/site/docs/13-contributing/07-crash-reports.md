---
sidebar_position: 7
title: Crash Reports
---

# Playground.WordPress.net Crash Reports

When Playground crashes on Playground.WordPress.net users are able to submit a crash report. These reports are stored in the [#playground-logs channel on the Making WordPress Slack](https://wordpress.slack.com/archives/C06Q5DCKZ3L).

**Playground doesn't collect crash reports automatically.** Instead, users are prompted to submit a crash report when a crash occurs and are able to modify it before submitting. The crash report includes a Playground logs, a description, and the url.

## Development

Logs are sent to the [logger API on Playground.WordPress.net](https://github.com/WordPress/wordpress-playground/blob/c52d7dbd94dbe3ffc57adde4d9844545ade97f93/packages/playground/website/public/logger.php). The logger API is a simple REST API that accepts a POST request with a `message` parameter.
The API validates the message and then sends it to the [#playground-logs channel on the Making WordPress Slack(https://wordpress.slack.com/archives/C06Q5DCKZ3L).

### Slack app

[We use the Playground Slack app](https://api.slack.com/apps/A06PEFZ00SG) to send logs to the #playground-logs channel.

The [Slack app OAuth token](https://api.slack.com/apps/A06PEFZ00SG/oauth?) and channel id are stored on Playground.WordPress.net as environment variables in `.htaccess`.
