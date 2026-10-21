# WordPress Playground website

This package contains the playground.wordpress.net website. Most assets built in this package
are pre-emptively downloaded and cached in the browser to support the offline mode. If you
want to add a new, bulky page without increasing the required download size, add it in the
`playground-website-extras` package instead.

## Development

### Updating Reprint

Reprint is downloaded and verified before the website build or dev server starts.
The browser loads that bundled client from Playground only when a transfer needs it.
It is excluded from the files downloaded eagerly for offline mode.

To select the latest stable release:

```bash
npm exec -- nx run playground-website:update-reprint
```

To select a particular release instead, run:

```bash
npm exec -- nx run playground-website:update-reprint --args=v0.10.13
```

The command reads the release asset's SHA-256 from GitHub, verifies the downloaded
PHAR, and writes the version and checksum together to `src/lib/reprint/release.json`.
Commit that file and run the website checks before deploying. Builds use the selected
release, never whatever happens to be latest. Generated PHAR files are not committed.

### Tests

To run the end to end tests locally, use the following command:

```bash
npx nx e2e playground-website
```

See [the Playwright guide](./playwright/README.md) for browser installation,
UI mode, and CI commands.

### GitHub integration development

To test the GitHub integration with Playground you will need to connect to GitHub.
You can skip the connection flow locally by setting your GitHub personal access token in the code.

To set your token add the below code [after this line](https://github.com/WordPress/wordpress-playground/blob/86e8b2d6792259711a127382cb0d2542996915c8/packages/playground/website/src/github/github-export-form/form.tsx#L139).

```
setOAuthToken('YOUR-TOKEN');
```

Replace `YOUR-TOKEN` with your [Personal access token](https://github.com/settings/tokens) (with repo scope).

#### Pull-request preview states

The pull-request preview normally calls the production plugin proxy, whose
result depends on GitHub credentials, rate limits, workflow history, and
network availability. Start the website with deterministic verification
responses when testing this interface locally:

```bash
PLAYGROUND_PR_PREVIEW_MOCKS=true npm run dev
```

Open **New → Preview a PR**, then enter one of these reserved PR numbers:

| PR number   | WordPress Core response | Gutenberg response | Expected state                         |
| ----------- | ----------------------- | ------------------ | -------------------------------------- |
| `900000001` | Available               | Missing            | Opens a WordPress Core preview         |
| `900000002` | Missing                 | Available          | Opens a Gutenberg preview              |
| `900000003` | Available               | Available          | Asks which repository to open          |
| `900000004` | Missing                 | Missing            | Reports that neither PR was found      |
| `900000005` | Unavailable             | Missing            | Reports that GitHub cannot be checked  |
| `900000006` | Missing                 | No workflow runs   | Reports that the build has not started |
| `900000007` | Missing                 | Expired artifact   | Reports that the artifact expired      |
| `900000008` | Artifact pending        | Missing            | Shows the retry countdown              |

Only verification requests for these numbers are mocked. Other PR numbers and
all artifact downloads continue through the normal plugin proxy.

## Tracking

The WordPress Playground website uses Google Analytics to track user interactions. We use this data to better understand how Playground is being used. We do not track or store any personal information.

Analytics is only enabled when the `VITE_GOOGLE_ANALYTICS_ID` environment variable is set at build time. When absent, no analytics code is shipped. See `.env.example` for details.

### Custom tracking events

We also track custom events whenever a user loads Playground and what blueprint steps are they using. We only record names of steps.

## Spacefast

Click **Autosaved → Storage location → Save to Spacefast**, enter a name, and
paste a Spacefast handoff URL or prompt. Saving installs and configures the free
Simply Static plugin, generates the static website, and publishes it together
with the Blueprint, SQLite snapshot, and uploads. New Spaces are public. The
complete database is readable alongside the static site. Write credentials stay
in tab memory; only the destination and setup Blueprint are retained locally.

Run the website with a larger proxy upload limit when testing media files:

```sh
PLAYGROUND_CORS_PROXY_MAX_REQUEST_SIZE=16777216 npm run dev
```

Each save creates one snapshot containing the static website and:

```text
_playground/site.json           Format version, Space ID, source URL, upload paths
_playground/blueprint.json      Blueprint that recreates the installation and restores its data
_playground/database.sqlite     SQLite snapshot produced with VACUUM INTO
wp-content/uploads/...          One shared copy for static hosting and editable source
```

Manifest format 2 shares uploads with the static site instead of keeping a
second copy under `_playground/uploads/`. Unreferenced media is retained too.
Older format 1 source remains readable, and the next save replaces its separate
upload directory with the shared layout. Deleted pages and files disappear from
the current snapshot. Each version has the message **Saved from WordPress
Playground**.

Generated pages have an **Edit with Playground** link pointing to the normal
website with `?blueprint-url=<Spacefast URL>/_playground/blueprint.json`. It uses
the current Playground origin, including localhost during development. The
hosted Blueprint installs the original dependencies, restores SQLite and uploads,
updates URLs including serialized values, and logs in to wp-admin. No separate
demo page is needed. The database migration uses WP-CLI; static generation uses
Simply Static's PHP hooks without WP-CLI or a Pro license.

A Blueprint-installed MU plugin advances Simply Static's job in batches and
renders public pages between batches to avoid nested PHP loopback requests. It
adds the edit link only to exported pages. Temporary crawl files remain outside
uploads. The adapter is tested with Simply Static 3.8.18, the version installed
when the plugin is absent. Plugin/theme files must be reproducible from the setup
Blueprint; later edits to those files are not stored. The current layout assumes
a single WordPress site with the standard uploads directory.

Spacefast API and upload requests go directly through the configured CORS proxy,
with buffered bodies and no initial cross-origin attempt. Management authorization
is explicitly opted in for the API; upload targets receive only their issued
credentials. The proxy supports PUT and configurable
`PLAYGROUND_CORS_PROXY_MAX_REQUEST_SIZE`, retaining its default limit when unset.
Uploads must finish and the version must become live before saving succeeds.
No reference handoff is redeemed by tests; browser checks mock Spacefast while
running real WordPress and Simply Static.
