# Hosting playground.wordpress.net on WP Cloud

This document covers our setup to host playground.wordpress.net on WP Cloud.

## Web server configuration

The WP Cloud platform is primarily focused on hosting WordPress. Since playground.wordpress.net is not a WordPress site and has some Playground-specific requirements, we had to do a number of things to get the site running as desired.

WP Cloud uses Nginx which does not support the .htaccess files we used previously for:

-   rewriting URLs
-   redirecting requests
-   customizing response headers

In order to customize these aspects for static files on WP Cloud, we did the following:

-   Configured the WP Cloud site to delegate requests for non-existent files to WordPress.
-   Provided a `__wp__/index.php` file as a default target for Nginx. - Even though this is not a WordPress site, we can provide a `__wp__/index.php` file that Nginx will run as a fallback for non-existent files. The `__wp__/index.php` file is empty and simply exists so Nginx will invoke PHP.
-   Added a `custom-redirects.php` file to implement special request handling. - WP Cloud invokes `<web-root>/custom-redirects.php` (if it exists) at the beginning of every PHP run in order to provide custom request handling. We added this file to implement the rewrites, redirects, and custom headers that we used to get via htaccess.
-   Set aside files that need special handling. - If we need custom treatment of static files, those files cannot be found by Nginx. Otherwise, Nginx will serve them directly without invoking PHP. For this reason, all files that need special treatment are set aside under `<web-root>/files-to-serve-via-php/`

## Deployment notes

New website builds are pushed to the WP Cloud site via SSH.

During deployment, we consult `custom-redirects-lib.php` about each file, and if it needs special treatment (e.g., URL rewrites, redirects, etc), it is set aside into the `<web-root>/files-to-serve-via-php/` folder with its relative path otherwise preserved. For example, if a file `a/b/c/playground.png` requires special handling, it is moved to `<web-root>/files-to-serve-via-php/a/b/c/playground.png`. Nginx will no longer find the file based on the request URI `a/b/c/playground.png` and will delegate the request to PHP, giving us a chance to customize how the file is served.

At the end of the deployment process, the WP Cloud edge cache is purged.
