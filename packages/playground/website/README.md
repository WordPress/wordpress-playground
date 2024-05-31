# WordPress Playground website

## Development

### Tests

To run the end to end tests locally, use the following command:

```bash
npx nx run playground-website:e2e:dev:cypress
```

## Tracking

The WordPress Playground website uses Google Analytics to track user interactions. We use this data to better understand how Playground is being used. We do not track or store any personal information.

### Custom tracking events

We also track custom events whenever a user loads Playground and what blueprint steps are they using. We only record names of steps.
