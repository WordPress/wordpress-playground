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

## Spacefast prototype

The standalone demo at `/website-server/demos/spacefast.html` explores using
Spacefast as the public source of an editable Playground site and as its static
host. This is an experimental demo, not an integration with the website's Save
menu. The intended product flow is to start in Playground, choose **Save to
Spacefast**, paste a handoff, and name the site; subsequent editing starts from
an **Edit in Playground** link. The demo currently exposes the underlying setup
and destination fields to make the integration testable.

Run it from the repository root with Node 24 and installed dependencies:

```sh
PLAYGROUND_CORS_PROXY_MAX_REQUEST_SIZE=16777216 npm run dev
```

Open `http://127.0.0.1:5400/website-server/demos/spacefast.html`. Start a new
Playground from the setup Blueprint, connect by pasting a fresh Spacefast handoff
URL, and save. A team handoff can create a public Space; a Space handoff writes
only to its assigned Space. An existing destination must already be public and
contain this prototype's site data. Credentials are kept in memory only. Closing
the tab disconnects the local client but does not revoke the issued Spacefast
key; manage that key in Spacefast's Connected apps.

Each save publishes these files together as a Spacefast version:

```text
_playground/site.json           Format version, Space ID, original site URL, upload paths
_playground/blueprint.json      Setup Blueprint (v1)
_playground/database.sqlite     SQLite snapshot produced with VACUUM INTO
_playground/uploads/...         Files from wp-content/uploads
```

These files are intentionally public, including the complete database. No
WordPress installation archive is created. Plugins, themes, and configuration
must be reproducible from the setup Blueprint. The demo does not infer a
Blueprint from plugins or themes subsequently installed in wp-admin, and it
does not save edits to their files. It currently assumes a single WordPress
site with its standard uploads directory and database table prefix.

To reopen, paste the public Spacefast URL and choose **Load public site**, or use
the demo's editor link (`?source=<public-site-url>`), then choose **Load public
site**. No handoff is needed for reading. Loading starts a new runtime, installs
the Blueprint's dependencies, restores SQLite and uploads, and uses WP-CLI to
replace the old Playground URL, including serialized values. To save a remix,
connect your own team handoff and clear the destination Space ID to create a new
Space. Save explicitly before closing; there is no remote autosave or concurrent
editor conflict detection.

For static hosting, configure an exporter such as Simply Static to write to
`/wordpress/static` and use the public Spacefast URL as its destination URL.
Generate the export, then choose **Save and publish static files**. The demo
publishes the directory's contents alongside `_playground/` as a complete
snapshot, so removed static files disappear. Ordinary **Save site data** retains
the existing static output while replacing source data and removing deleted
uploads. Server-specific `.htaccess` and `.user.ini` files are omitted. Export
generation, including Simply Static's crawler/background-job compatibility with
browser Playground, remains to be validated separately.

Requests use the existing `fetchWithCorsProxy` helper. Management authorization
is explicitly opted in for the Spacefast API; upload targets receive only their
issued headers. The proxy now accepts PUT and a configurable body limit; its
default remains below 1 MiB per POST or PUT. The example above allows bodies
below 16 MiB locally. The proxy deployment and its front-end web server must
support the upload method and desired body size before hosting the demo remotely.
The demo checks that a version is ready and serving on the live channel before
reporting a successful save. Live authentication and publication require a fresh
handoff and have not been exercised with the reference-only handoff.
