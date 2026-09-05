## Playground components

A library of reusable components for the Playground webapp, WordPress plugins,
WordPress blocks, and Blueprint authoring tools.

## Design decisions

The components in this package use `@wordpress/components` under the hood. Web components were considered for portability, but ultimately weren't used because they:

- Wouldn't have the native WordPress look and feel
- Couldn't easily mix with WordPress components
- Had some issues around focus management

## Blueprint bundle editor

`BlueprintBundleEditor` edits the files in an `EventedFilesystem`. The host
chooses where that filesystem is stored and what a preview request does.

```tsx
import { BlueprintBundleEditor } from '@wp-playground/components';

<BlueprintBundleEditor filesystem={filesystem} readOnly={false} onChange={saveDraft} onPreview={openPreview} />;
```

The editor includes the file tree, file import and zip export, Blueprint JSON
completion, validation messages, and a read-only mode. It does not save sites,
change the page URL, or start a Playground on its own.

## Development Instructions (or ideally a Blueprint)

1. Run `nx dev playground-components`
2. Go to http://localhost:5173/
3. Play with the widgets and confirm they work intuitively
