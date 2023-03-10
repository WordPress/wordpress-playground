=== Akismet Spam Protection ===
Contributors: matt, ryan, andy, mdawaffe, tellyworth, josephscott, lessbloat, eoigal, cfinke, automattic, jgs, procifer, stephdau
Tags: comments, spam, antispam, anti-spam, contact form, anti spam, comment moderation, comment spam, contact form spam, spam comments
Requires at least: 5.0
Tested up to: 5.9
Stable tag: 4.2.3
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

= 4.1.12 =
*Release Date - 3 September 2021*

* Fixed "Use of undefined constant" notice.
* Improved styling of alert notices.

= 4.1.11 =
*Release Date - 23 August 2021*

* Added support for Akismet API usage notifications on Akismet settings and edit-comments admin pages.
* Added support for the deleted_comment action when bulk-deleting comments from Spam.
 
= 4.1.10 =
*Release Date - 6 July 2021*

* Simplified the code around checking comments in REST API and XML-RPC requests.
* Updated Plus plan terminology in notices to match current subscription names.
* Added `rel="noopener"` to the widget link to avoid warnings in Google Lighthouse.
* Set the Akismet JavaScript as deferred instead of async to improve responsiveness.
* Improved the preloading of screenshot popups on the edit comments admin page.

= 4.1.9 =
*Release Date - 2 March 2021*

* Improved handling of pingbacks in XML-RPC multicalls

= 4.1.8 =
*Release Date - 6 January 2021*

* Fixed missing fields in submit-spam and submit-ham calls that could lead to reduced accuracy.
* Fixed usage of deprecated jQuery function.

= 4.1.7 =
*Release Date - 22 October 2020*

* Show the "Set up your Akismet account" banner on the comments admin screen, where it's relevant to mention if Akismet hasn't been configured.
* Don't use wp_blacklist_check when the new wp_check_comment_disallowed_list function is available.

= 4.1.6 =
*Release Date - 4 June 2020*

* Disable "Check for Spam" button until the page is loaded to avoid errors with clicking through to queue recheck endpoint directly.
* Added filter "akismet_enable_mshots" to allow disabling screenshot popups on the edit comments admin page.

For older changelog entries, please see the [additional changelog.txt file](https://plugins.svn.wordpress.org/akismet/trunk/changelog.txt) delivered with the plugin.
