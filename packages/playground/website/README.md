# WordPress Playground website

This package contains the playground.wordpress.net website. The app serves shared
platform assets on demand; rendered WordPress pages use the configured sandbox origin.
Keep bulky optional pages in `playground-website-extras` so builds that prefetch
offline assets do not download them eagerly.

## Development

Run `npm run dev` and open <http://127.0.0.1:5400/website-server/>.
WordPress uses the existing remote Vite server without a feature flag:

```text
127.0.0.1:5400  SPA, Dock, remote.html, PHP, OPFS, and picked directories
127.0.0.1:4400  rendered WordPress, HTTP helper, and service worker
```

Different ports are different origins. WordPress cannot read the loaded app or
PHP iframe's documents or OPFS. Both ports use app-origin source modules, so
normal Vite updates still work without a production build or local DNS changes.
The app's proxy preserves its Host header; direct requests to the WordPress port
cannot load `api.html`, `remote.html`, or arbitrary source files.

`http://localhost:5400/website-server/` works too and uses `localhost:4400` for
WordPress. Keep both ports free: the servers stop rather than silently select
ports that no longer match. Local devcontainers publish both ports. Custom HTTPS
hosts and forwarded tunnel URLs keep their existing same-origin behavior; this
change does not configure a second public tunnel. Standalone remote, Personal WP,
and sync development also keep their existing behavior.

`?reprint` still enables the Reprint UI. It does not choose where WordPress runs.
The configured sandbox is used during SPA navigation and full reloads alike.

The single WordPress origin is still shared by all sites. The split does not add
per-site HTTP authorization or stop WordPress from embedding a fresh app/API
iframe. See the [boundary limits](./bin/wordpress-frame/README.md#limits).

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
