# site-docs-site

Generates the markdown documentation for WordPress playground.

## Building API reference

Generate API reference with:

```bash
nx build:api-reference docs-site
```

To tweak the list of packages included in the reference docs, adjust `implicitDependencies` and the appropriate bash command in project.json.
