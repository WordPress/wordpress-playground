## Playground components

A library of reusable, dependency-free components (well, React is a dependency) that can be reused between Playground webapp, WordPress plugins, WordPress blocks, and the Blueprints builder. For example, the PathMappingControl will make a good fit for all these places.

## Design decisions

The components in this package use `@wordpress/components` under the hood. Web components were considered for portability, but ultimately weren't used because they:

-   Wouldn't have the native WordPress look and feel
-   Couldn't easily mix with WordPress components
-   Had some issues around focus management

## Development Instructions (or ideally a Blueprint)

1. Run `nx dev playground-components`
2. Go to http://localhost:5173/
3. Play with the widgets and confirm they work intuitively
