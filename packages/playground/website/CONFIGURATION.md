# WordPress Playground Configuration

This document outlines how to configure your self-hosted WordPress Playground instance.

## Environment Variables

WordPress Playground uses environment variables for configuration. These can be set in the following files:

-   `.env` - Default configuration (included in repository)
-   `.env.local` - Local overrides (not committed to Git)

## Available Configuration Options

### Google Analytics

The Google Analytics/GTM integration can be configured using:

```
VITE_GOOGLE_ANALYTICS_ID=your-ga4-id
```

To disable Google Analytics completely, set the value to an empty string:

```
VITE_GOOGLE_ANALYTICS_ID=
```

The Google Analytics script is conditionally included during the build process based on whether this environment variable has a value. This means no tracking script is included in the final HTML when the variable is empty, improving privacy and performance for self-hosted instances that don't require analytics.

## How to Configure Your Self-Hosted Instance

1. Clone the repository
2. Create a `.env.local` file with your custom configuration
3. Build the project according to the main README instructions

Example `.env.local` file:

```
# Custom Google Analytics ID for my self-hosted instance
VITE_GOOGLE_ANALYTICS_ID=G-MYANALYTICS123
```

## Building With Custom Configuration

The environment variables are applied at build time. Make sure your custom `.env.local` file is in place before running:

```bash
npm run build:website
```
