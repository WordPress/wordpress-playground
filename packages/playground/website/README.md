# WordPress Playground website

This package contains the playground.wordpress.net website. Most assets built in this package
are pre-emptively downloaded and cached in the browser to support the offline mode. If you
want to add a new, bulky page without increasing the required download size, add it in the
`playground-website-extras` package instead.

## Development

### Tests

To run the end to end tests locally, use the following command:

```bash
npx nx run playground-website:e2e:dev:cypress
```

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
