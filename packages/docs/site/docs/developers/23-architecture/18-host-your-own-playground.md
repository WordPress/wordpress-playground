---
slug: /developers/architecture/host-your-own-playground
---

# Host your own Playground

You can host the Playground on your own domain instead of `playground.wordpress.net`.

This is useful for having full control over its content and behavior, as well as removing dependency on a third-party server. It can provide a more customized user experience, for example: a playground with preinstalled plugins and themes, default site settings, or demo content.

## Before you start

Self-hosting Playground gives you full control, but requires understanding a few key concepts:

### What to expect

- **Initial setup complexity**: Building and deploying Playground involves multiple steps. Allow time for troubleshooting during your first deployment.
- **Static file hosting**: Playground is primarily static files (HTML, JS, WASM) with minimal server-side requirements.
- **Browser-based execution**: All WordPress processing happens in the user's browser via WebAssembly—your server only delivers files.

### Performance considerations

Loading times depend on several factors:

| Factor            | Impact                                                              | Optimization                                |
| ----------------- | ------------------------------------------------------------------- | ------------------------------------------- |
| **Plugin size**   | Large plugins (e.g., WooCommerce) can take 30-60 seconds to install | Pre-install plugins in your WordPress build |
| **Network speed** | WASM files are ~15-30MB                                             | Use CDN with proper caching headers         |
| **Browser**       | Chrome/Edge perform best; Safari uses fallback mechanisms           | Test across browsers                        |
| **Device**        | Mobile devices load slower than desktop                             | Warn mobile users about longer load times   |

### Browser compatibility

Playground works across modern browsers, but with some differences:

| Browser         | Status              | Notes                                                                              |
| --------------- | ------------------- | ---------------------------------------------------------------------------------- |
| Chrome/Edge     | ✅ Best performance | Full support for all features                                                      |
| Firefox         | ✅ Good             | Reliable performance                                                               |
| Safari          | ✅ Good             | Recent improvements significantly enhanced reliability                             |
| Mobile browsers | ⚠️ Limited          | Works, but with higher memory usage, and a 4G connection can impact the experience |

**Technical note**: Safari uses MessagePorts instead of SharedArrayBuffer for streaming responses. This fallback works reliably but adds slight overhead compared to Chrome/Edge.

## Usage

A self-hosted Playground can be embedded as an iframe.

```html
<iframe src="https://my-playground.com"></iframe>
```

Or dynamically loaded by passing the remote URL to the [Playground Client](/developers/apis/javascript-api/playground-api-client).

```ts
import { startPlaygroundWeb } from '@wp-playground/client';

const client = await startPlaygroundWeb({
	iframe: document.getElementById('wp'),
	remoteUrl: `https://my-playground.com/remote.html`,
});
```

## Static assets

Build the browser website from source to host it on your own domain. This does
not require a GitHub Actions artifact. The `@wp-playground/client` npm package
connects your app to an already hosted browser runtime. The
`@wp-playground/cli` npm package runs WordPress locally with Node.js. Neither
installs the browser website and its Dock.

The [Deploy Playground website workflow](https://github.com/WordPress/wordpress-playground/actions/workflows/deploy-website.yml)
produces a temporary artifact for the public deployment. It expires, and the
build is configured to render WordPress on `wpsandbox.wordpress.net`. Use the
source build below for another domain, even if the artifact is still available.
Running the deploy workflow in a fork without the deployment secrets skips
the build, too.

### Build locally

Create a shallow clone of the Playground repository or your own fork. The
command below uses the latest development source on `trunk`. To pin the
Playground source to a specific version, replace `trunk` with a tag from the
[releases page](https://github.com/WordPress/wordpress-playground/releases).
The tag does not make the build reproducible: the build downloads
`wp-cli.phar` from the `wp-cli/builds` repository's `gh-pages` branch, which
can change between builds.

```sh
git clone -b trunk --single-branch --depth 1 --recurse-submodules https://github.com/WordPress/wordpress-playground.git
```

Enter the `wordpress-playground` directory.

```sh
cd wordpress-playground
```

Use the Node.js version in `.nvmrc`. The commands below require
[nvm](https://github.com/nvm-sh/nvm#installing-and-updating) to be installed.
`nvm install` installs and activates the required Node.js version. If you use
another version manager, install and activate the version in `.nvmrc` with it
instead. Then install the locked dependencies:

```sh
nvm install
npm ci
```

Before building, leave `PLAYGROUND_APP_ORIGIN` and `VITE_WORDPRESS_SITE_URL` unset to serve
the Playground app and its WordPress pages from the same origin. For a public
instance that runs untrusted plugins or Blueprints, use a separate WordPress
origin to reduce exposure. This does not fully protect saved files or native
directory handles. See the [split-origin deployment guide](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/playground/website-deployment/wordpress-frame/README.md).

For a same-origin build, run the following in a POSIX-compatible shell, such
as Bash or Zsh:

```sh
unset PLAYGROUND_APP_ORIGIN VITE_WORDPRESS_SITE_URL
npm run build:website
```

This command internally runs the `nx` task `build:wasm-wordpress-net`. It copies the built assets from packages `remote` and `website` into a new folder at the following path:

```
dist/packages/playground/wasm-wordpress-net
```

Serve the contents of this folder as your site root.

This builds the files you serve. It does not make every Playground feature
independent of external services. For example, production builds use the
project's CORS proxy for requests that the browser cannot make directly,
unless you set `CORS_PROXY_URL` at build time.

### Verify the local build

With Python 3 installed, run this command from the `wordpress-playground`
directory to serve the built files locally:

```sh
python3 -m http.server 8768 --bind 127.0.0.1 \
  --directory dist/packages/playground/wasm-wordpress-net
```

Open [http://127.0.0.1:8768/](http://127.0.0.1:8768/) in your browser. Confirm that:

1. The WordPress welcome page and Playground Dock appear.
2. Entering `/wp-admin/` in the Dock's address field opens the WordPress Dashboard.
3. The WordPress iframe URL, inspected with your browser's developer tools,
   starts with `http://127.0.0.1:8768/scope:`. The app and WordPress should use
   the same scheme, hostname, and port, rather than `wpsandbox.wordpress.net`.

Stop the server with `Ctrl+C`. This server is for local verification only.
Use HTTPS when deploying to a public domain; service workers can run over
HTTP on loopback addresses such as `127.0.0.1`.

When reporting a test result, include the output of `git rev-parse HEAD`,
`node --version`, and `npm --version`, along with the browser version and
the command used to serve the files.

## Summary of included files

The static assets include:

- Data and WASM files for all available PHP and WordPress versions
- `remote.html` - the core of Playground
- `index.html` - the shell, or browser chrome
- Web Worker script

You can deploy the content of the folder to your server using SSH, such as `scp` or `rsync`.

It is a static site, except for these dynamic aspects.

- Apache server directive `.htaccess` file from the package `remote`

For these to work, you need a server environment with Apache and PHP installed.

## NGINX configuration

As an alternative to Apache, here is an example of using NGINX to serve the Playground.

<div class="callout callout-info">

**Refer to the source file**

The example may be outdated. Please check [the source file](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/playground/remote/.htaccess) for the latest version.

</div>

The combined Apache `.htaccess` file looks like this.

```htaccess
AddType application/wasm .wasm
```

An equivalent in NGINX.

```nginx
location ~* .wasm$ {
  types {
    application/wasm wasm;
  }
}
```

You may need to adjust the above according to server specifics, particularly how to invoke PHP for the path `/plugin-proxy`.

[Caddy web server](https://caddyserver.com) doesn't require any special config to work.

## Customize bundled data

The file `wp.zip` is a bundle of all the files for the virtual file system in Playground. There's a data file for each available WordPress version.

The package at `packages/playground/wordpress-builds` is responsible for building these data files.

Edit the build script in `Dockerfile` to create a custom bundle that includes preinstalled plugins or content.

To rebuild the WordPress builds after customizing the `Dockerfile`, run the following command:

```
npm run rebuild:wordpress-builds
```

To rebuild the website to include the custom WordPress builds, follow the instructions [here](#build-locally).

### Install plugins

Here's an example of installing plugins for the data bundle.

Before the section titled `Strip whitespaces from PHP files`.

```docker
# === Preinstall plugins ===

RUN cd wordpress/wp-content/mu-plugins && \
    # Install plugins
    for plugin_name in example-plugin-1 example-plugin-2; do \
      curl -L https://downloads.wordpress.org/plugin/{$plugin_name}.latest-stable.zip -o {$plugin_name}.zip && \
      unzip $plugin_file && \
      rm $plugin_file && \
      # Create entry file in mu-plugins root
      echo "<?php require_once __DIR__.'/$plugin_name/$plugin_name.php';" > $plugin_name.php; \
    done;
```

You can download plugins from URLs other than the WordPress plugin directory, or use Git to pull them from elsewhere.

It's also possible to copy from a local folder. For example, before `RUN`:

```
COPY ./build-assets/*.zip /root/
```

Then put the plugin zip files in `build-assets`. In this case, you may want to add their paths to `.gitignore`.

### Import content

Here's an example of importing content.

```docker
# === Demo content ===

COPY ./build-assets/content.xml /root/
RUN cd wordpress ; \
     echo "Importing content.."; \
    ../wp-cli.phar --allow-root import /root/content.xml --authors=create
```

This assumes that you have put a WXR export file named `content.xml` in the folder `build-assets`. You can add its path to `.gitignore`.

## Production deployment checklist

Before going live, verify your self-hosted Playground meets these requirements:

### Server configuration

- [ ] **MIME types**: Ensure `.wasm` files are served with `application/wasm` content type
- [ ] **CORS headers**: If embedding cross-origin, configure appropriate CORS headers
- [ ] **Caching**: Set long cache times for WASM and static assets (they're versioned)
- [ ] **Compression**: Enable gzip/brotli for faster file transfers
- [ ] **HTTPS**: Required for service workers and some browser features

### Performance optimization

- [ ] **CDN**: Serve static assets from a CDN for faster global delivery
- [ ] **Pre-installed plugins**: Bundle frequently-used plugins in your WordPress build
- [ ] **Limit additional downloads**: Minimize runtime plugin installations (by blueprints, for example)

## Troubleshooting

### Common issues and solutions

#### Playground fails to load or shows blank screen

**Possible causes:**

- Server doesn't serve WASM files with correct MIME type
- Deployment missing required files
- JavaScript errors in browser console

**Solutions:**

1. Check browser console for errors (F12 → Console tab)
2. Verify `.wasm` files return `application/wasm` content type
3. Verify you deployed all build files

#### Slow initial loading (30+ seconds)

**Possible causes:**

- Installing large plugins at runtime
- Missing CDN or caching configuration
- User on slow network connection

**Solutions:**

1. Pre-install plugins in your WordPress build instead of runtime installation
2. Configure CDN with proper caching headers
3. Show loading indicators to set user expectations
