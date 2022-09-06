=== Akismet Spam Protection ===
Contributors: matt, ryan, andy, mdawaffe, tellyworth, josephscott, lessbloat, eoigal, cfinke, automattic, jgs, procifer, stephdau, kbrownkd
Tags: comments, spam, antispam, anti-spam, contact form, anti spam, comment moderation, comment spam, contact form spam, spam comments
Requires at least: 5.0
Tested up to: 6.0.1
Stable tag: 4.2.5
License: GPLv2 or later

The best anti-spam protection to block spam comments and spam in a contact form. The most trusted antispam solution for WordPress and WooCommerce.

== Description ==

Akismet checks your comments and contact form submissions against our global database of spam to prevent your site from publishing malicious content. You can review the comment spam it catches on your blog's "Comments" admin screen.

Major features in Akismet include:

* Automatically checks all comments and filters out the ones that look like spam.
* Each comment has a status history, so you can easily see which comments were caught or cleared by Akismet and which were spammed or unspammed by a moderator.
* URLs are shown in the comment body to reveal hidden or misleading links.
* Moderators can see the number of approved comments for each user.
* A discard feature that outright blocks the worst spam, saving you disk space and speeding up your site.

PS: You'll be prompted to get an Akismet.com API key to use it, once activated. Keys are free for personal blogs; paid subscriptions are available for businesses and commercial sites.

== Installation ==

Upload the Akismet plugin to your blog, activate it, and then enter your Akismet.com API key.

1, 2, 3: You're done!

== Changelog ==

= 4.2.5 =
*Release Date - 11 July 2022*

* Fixed a bug that added unnecessary comment history entries after comment rechecks.
* Added a notice that displays when WP-Cron is disabled and might be affecting comment rechecks.

= 4.2.4 =
*Release Date - 20 May 2022*

* Improved translator instructions for comment history.
* Bumped the "Tested up to" tag to WP 6.0.

= 4.2.3 =
*Release Date - 25 April 2022*

* Improved compatibility with Fluent Forms
* Fixed missing translation domains
* Updated stats URL.
* Improved accessibility of elements on the config page.

= 4.2.2 =
*Release Date - 24 January 2022*

* Improved compatibility with Formidable Forms
* Fixed a bug that could cause issues when multiple contact forms appear on one page.
* Updated delete_comment and deleted_comment actions to pass two arguments to match WordPress core since 4.9.0.
* Added a filter that allows comment types to be excluded when counting users' approved comments.

= 4.2.1 =
*Release Date - 1 October 2021*

* Fixed a bug causing AMP validation to fail on certain pages with forms.

= 4.2 =
*Release Date - 30 September 2021*

* Added links to additional information on API usage notifications.
* Reduced the number of network requests required for a comment page when running Akismet.
* Improved compatibility with the most popular contact form plugins.
* Improved API usage buttons for clarity on what upgrade is needed.

For older changelog entries, please see the [additional changelog.txt file](https://plugins.svn.wordpress.org/akismet/trunk/changelog.txt) delivered with the plugin.
