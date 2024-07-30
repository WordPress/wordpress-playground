# WordPress Playground website

## Development

### Tests

To run the end to end tests locally, use the following command:

```bash
npx nx run playground-website:e2e:dev:cypress
```

You can run a single test by adding the `--spec` flag:

```bash
npx nx run playground-website:e2e:dev:cypress  --spec="packages/playground/website/cypress/e2e/offline.cy.ts"
```

#### Preview tests

You can run the preview tests locally by running the following command:

```bash
sudo npx nx run playground-website:e2e
```

_Sudo is required to load the preview server on port 80. You can change the port in `project.json` if you want to use a different port._

#### Debugging

You can debug the tests by adding the `--headed --no-exit` flags:

```bash
npx nx run playground-website:e2e:dev:cypress --headed --no-exit
```

When production tests fail you can see the test output in the GitHub Actions logs.
You can find screenshots of the failed tests in the Summary > Artifacts section of the failed workflow run.

### GitHub integration development

To test the GitHub integration with Playground you will need to connect to GitHub.
You can skip the connection flow locally by setting your GitHub personal access token in the code.

To set your token add the bellow code [after this line](https://github.com/WordPress/wordpress-playground/blob/86e8b2d6792259711a127382cb0d2542996915c8/packages/playground/website/src/github/github-export-form/form.tsx#L139).

```
setOAuthToken('YOUR-TOKEN');
```

Replace `YOUR-TOKEN` with your [Personal access token](https://github.com/settings/tokens) (with repo scope).

## Tracking

The WordPress Playground website uses Google Analytics to track user interactions. We use this data to better understand how Playground is being used. We do not track or store any personal information.

### Custom tracking events

We also track custom events whenever a user loads Playground and what blueprint steps are they using. We only record names of steps.
