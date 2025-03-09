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

The Google Analytics script is automatically injected into the `<head>` section of all HTML pages during the build process. If the environment variable is not set or is empty, no analytics code will be included in the final HTML output, improving privacy and performance for self-hosted instances that don't require tracking.

This configuration applies to:

-   The main application (`index.html`)
-   The WordPress PR previewer (`public/wordpress.html`)
-   The Gutenberg PR previewer (`public/gutenberg.html`)
-   All demo and builder HTML files

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
# Standard build
npm run build:website

# Verbose build with analytics logging
npm run build:website -- --verbose
```

## Technical Implementation

The analytics integration uses a custom Vite plugin that inserts the Google Analytics script at the end of the `<head>` section in all HTML files during the build process. This approach:

1. Keeps analytics configuration separate from the code
2. Ensures no analytics code is included in the HTML when disabled
3. Requires no placeholder comments in the HTML source files
4. Provides a clean way to customize analytics for self-hosted instances
5. Maintains clean indentation and formatting in the output HTML
6. Operates silently by default (logs can be enabled with `--verbose`)
