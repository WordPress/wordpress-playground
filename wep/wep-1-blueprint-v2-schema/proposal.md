# WordPress Extension Proposal 1: Blueprints version 2

This proposal describes a version 2 of WordPress Blueprints, including the
schema, data structures, and the Execution Algorithm.

TypeScript is used for its expressive, self-validating type system. The
actual implementation will be built in PHP.

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## Introduction

A Blueprint is a description of a WordPress site that a build tool can
understand and create that site.

### Design goals

This proposal connects:

-   Business cases such as starter sites, AI site builders, smooth
    developer onboarding.
-   Real-world Blueprints usage and feedback received between 2023
    and 2025.

Blueprints v2 should:

-   Be AI-friendly.
-   Be simple to validate.
-   Be easy to understand, modify, remix.
-   Support collaborative workflows, e.g. by producing meaningful, human-readable diffs in version control.
-   Be expressible in other formats such as TOML.
-   Be possible to compose with other Blueprints.
-   Offer an easy and recommended way of doing things.
-   Express a single, unambiguous intent with well-known execution order.
-   Enable loading data from multiple sources (files, URLs, git repos, etc).
-   Be portable across production, development, and Playground environments.
-   Retain feature-level BC with Blueprints v1. The schema differs, but the
    existing Blueprints may be migrated without losing features.
-   Support 90% of the use cases via declarative syntax.

Blueprints v2 should not:

-   Be a programming language. They won't support variables, conditionals,
    loops, etc. Use PHP, TypeScript, or another programming language if
    you need more flow control.
-   Turn the JSON document into a content export format. Use SQL, WXR, HTML, and
    other appropriate formats to express complex content structures
-   Support all possible use-cases via the declarative syntax. Use procedural steps
    when you run into limitations.

## JSON data format

A Blueprint is a JSON document that describes the expected state of a WordPress site.

A Blueprint **MUST** be encoded as UTF-8 and a Blueprint runner **MUST** reject any non-UTF-8 inputs.

Here's a simple Blueprint example to paint the picture before we dive
into the details:

```
{
	"wordpressVersion": "6.6",
	"plugins": ["jetpack", "https://woo.com/woocommerce.zip"],
	"themes": ["./wp-content/themes/adventurer/"],
	"postTypes": {
		"book": { "label": "Book" }
	},
	"constants": {
		"WP_DEBUG": true
	}
}
```

### Schema

[Appendix A](appendix-A-blueprint-v2-schema.ts) describes the complete
Blueprint JSON schema. It uses the TypeScript type syntax to express the
schema and discusses specific properties in details.

#### Extending the schema

A Blueprint runner **MUST** only support the schema described in this document.
It **MUST** NOT expose any schema extension points.

The purpose of this limitation is to:

-   Keep the runner implementations simple
-   Keep all Blueprints portable across all runners

Implementers in need of additional Blueprint properties are encouraged to
follow the approach used by the [Blueprint Execution Algorithm](#blueprint-execution-algorithm). Namely,
transpile a Blueprint with additional properties into a Blueprint that only
uses the core set of properties.

For example, the following hypothetical Blueprint with a WooCommerce-specific
property:

```json
{
	"products": [
		{
			"name": "T-shirt",
			"price": 100
		}
	]
}
```

Would have to be transpiled into the following Blueprint that only uses the core
properties before use:

```json
{
	"plugins": ["woocommerce"],
	"content": [
		{
			"type": "posts",
			"source": [
				{
					"title": "T-shirt",
					"content": "This is a T-shirt",
					"post_type": "product",
					"post_status": "publish"
				}
			]
		}
	]
}
```

#### Declarative and imperative syntax

The recommended way of writing Blueprints is by declaring the required
plugins, themes, post types, content, and so on using the top-level
declarative properties. They're easy to write, read, validate, and
AI tends to handle them well.

However, sometimes the declarative syntax is not expressive enough. For
example, you may want to set site option A at the beginning, install a
few plugins, and then change site option B that was overridden by one
of the plugins.

For these cases, the Blueprint supports an imperative
`additionalStepsAfterExecution` property where operations can be expressed
as an ordered list. That syntax is discouraged for most cases and is reserved
for complex, sequential logic that is not easily expressible using the
declarative syntax.

See [Step execution order](#step-execution-order) for more details.

#### TOML and other data formats

Blueprints v2 only supports the JSON syntax.

Version 3 and beyond may reconsider this and add support for TOML, XML, and
other formats.

### Data sources

Blueprints support loading data from multiple sources, such as local files,
remote URLs, git repositories, or WordPress.org directories.

[Appendix B](appendix-B-data-sources.ts) discusses the supported data sources
in details.

Whenever a Blueprint refers to a local path, that path is resolved within
the context of the [Blueprint Execution Context](#blueprint-execution-context).

Any data source that cannot be resolved, such as a non-existent relative path
or a URL that responds with a 404, will stop the Blueprint execution with a
clear error message.

## Blueprint Bundles

Blueprints shipped with extra files are called "Blueprint Bundles". A ZIP
file, a git repository, and a local directory are all examples of a Blueprint
bundle.

Bundles exist because JSON is not the most convenient format for expressing
site content or plugin code.

### Bundle directory structure

Bundle **MUST** be structured using the following directory layout:

```
blueprint.json
wp-content/
└─── plugins/
|    └─── akismet.zip
|    └─── custom-meta-box.php
|    └─── hello-dolly/
|         └─── hello-dolly.php
└─── mu-plugins/
|    └─── 0-check-integrity.zip
└─── themes/
|    └─── twentytwentythree/
|         └─── style.css
|         └─── functions.php
|         └─── screenshot.jpg
└─── languages/
|    └─── plugins/
|         └─── akismet/
|              └─── akismet-en_US.po
|              └─── akismet-en_US.mo
|              └─── akismet-de_DE.po
|              └─── akismet-de_DE.mo
|    └─── themes/
|         └─── twentytwentythree/
|              └─── twentytwentythree-en_US.po
|              └─── twentytwentythree-en_US.mo
|    └─── en_US.po
|    └─── en_US.mo
|    └─── de_DE.po
|    └─── de_DE.mo
└─── uploads/
|    └─── fonts/
|         └─── open-sans.woff2
|         └─── roboto.woff2
|         └─── ...
|    └─── 2024/
|         └─── 01/
|              └─── image.jpg
|              └─── video.mp4
|              └─── audio.mp3
|              └─── document.pdf
|              └─── other.txt
└─── content/
     └─── dump-1.sql
     └─── dump-2.sql
     └─── dump-3.sql
     └─── bike-repair-shop.wxr
     └─── posts/
           └─── posts/
				└─── 2025-01-01-my-first-post.html
           └─── pages/
                └─── books/
                     └─── post-type.json
                     └─── the-old-man-and-the-sea.html
                     └─── harry-potter.md
```

This is an augmented wp-content directory structure. In future iterations, WordPress
sites may become their own "live Blueprints" by creating the additional files within
the `wp-content` directory.

A Blueprint runner enforces this directory structure during Blueprint validation:

-   Plugins **MUST** only be accepted from the `wp-content/plugins` directory.
    The accepted formats are:

    -   A directory containing at least one file with a `Plugin Name:` header comment
    -   A single-file plugin `*.php`
    -   A ZIP archive whose root contains a plugin directory or file

    For more details on WordPress plugin structure and requirements, see [the WordPress plugin basics documentation](https://developer.wordpress.org/plugins/plugin-basics/).

-   Themes **MUST** only be accepted from the `wp-content/themes` directory.
    The accepted formats are:

    -   A directory whose root contains `style.css` and (optionally) `index.php`
    -   A ZIP archive wrapping such a directory

    For more details on WordPress theme structure and requirements, see [the WordPress theme basics documentation](https://developer.wordpress.org/themes/basics/).

-   Translations **MUST** only be accepted from the `wp-content/languages` directory.
    The accepted formats are:

    -   `.po` and `.mo` files for core WordPress translations (e.g., `en_US.po`, `de_DE.mo`)
    -   Plugin-specific translations in subdirectories (e.g., `plugins/akismet-en_US.po`)
    -   Theme-specific translations in subdirectories (e.g., `themes/twentytwentythree-de_DE.mo`)
    -   A ZIP archive containing translation files in the appropriate structure

    For more details on WordPress localization, see [the WordPress localization documentation](https://developer.wordpress.org/plugins/internationalization/localization/).

-   Fonts **MUST** only be accepted from the `wp-content/uploads/fonts` directory.
    The accepted formats are:
    -   `*.woff2`: A Web Open Font Format 2.0 font file
    -   `*.woff`: A Web Open Font Format font file
    -   `*.ttf`: A TrueType font file
    -   `*.otf`: An OpenType font file
-   General content files **MUST** only be accepted from the `wp-content/content` directory. They **MUST** be encoded as UTF-8.
    The accepted formats are:
    -   `*.sql`: A MySQL dump with any set of valid SQL statements
    -   `*.xml`: A WordPress Extended RSS `*.xml` (WXR)
-   Post content files **MUST** only be accepted from the `wp-content/content/posts/<POST TYPE>` directories.
    The accepted formats are:
    -   `post-type.json`: A JSON document describing the post type. See [Appendix A](appendix-A-blueprint-v2-schema.ts)
        for the schema details.
    -   Static document formats supported by the Data Liberation importer – to be defined in a separate proposal. They **MUST** be encoded as UTF-8.
-   Media files **MUST** only be accepted from the `wp-content/uploads` directory. The
    accepted formats are all formats allowed by the WordPress Media Library at the
    time of importing. For more details on WordPress media, see
    [the WordPress Uploading Files documentation](https://codex.wordpress.org/Uploading_Files).

While this measure may seem restrictive, it ensures all Blueprints follow the same
standard structure which ultimately makes them easier to create, debug, statically
analyze, and run.

### Blueprint Execution Context

A Blueprint Execution Context is the direct parent of the blueprint.json file.

The meaning of a "direct parent" depends on how the Blueprint is loaded.

| Blueprint Source | Example                                                 | Execution Context                              |
| ---------------- | ------------------------------------------------------- | ---------------------------------------------- |
| Local Path       | `/Users/user/blueprints/my-blueprint.json`              | `/Users/user/blueprints`                       |
| ZIP Bundle       | `blueprint.zip` containing `blueprint.json` at the root | The root directory of the extracted ZIP        |
| Git Repository   | `https://github.com/user/repo.git`                      | The root directory of the cloned repository    |
| URL              | `https://example.com/blueprints/my-blueprint.json`      | `https://example.com/blueprints/`              |
| URL              | `https://example.com/blueprints/my-blueprint`           | `https://example.com/blueprints/`              |
| URL              | `https://example.com/blueprints/my-blueprint/`          | `https://example.com/blueprints/my-blueprint/` |

Note how, in case of URLs, the execution context is resolved according the [WHATWG URL Standard](https://url.spec.whatwg.org/),
assuming the URL is `./` and the base URL is the URL of the Blueprint.

Blueprints may refer to files and directories within the Execution Context using
relative paths – see the `ExecutionContextPath` type defined in [Appendix B](appendix-B-data-sources.ts).

For example, this Blueprint:

```
{
	"plugins": [
		"./wp-content/plugins/akismet.zip",
		"./wp-content/plugins/classic-editor"
	]
}
```

Will install the Akismet plugin from the `wp-content/plugins/akismet.zip` file
in the Execution Context and the Classic Editor plugin from the
`wp-content/plugins/classic-editor` directory in the Execution Context.

#### Execution Context security

As specified in [Appendix B](appendix-B-data-sources.ts), it is not possible
to escape the Blueprint Execution Context via "../" sequences, ensuring that all file
operations remain within the intended security boundary.

Furthermore, only the Blueprint.json file and the static files shipped within
the local Execution Context are allowed to reference other files within the
Execution Context. Nothing downloaded from a remote URL, git repository etc.
can refer to the local Execution Context. This is strictly a disambiguation
measure to prevent accidental errors. It does not prevent malicious Blueprints
from accessing arbitrary local files as that can also be done via steps such
as `runPHP`, `installPlugin`, etc.

As an extra layer of security, Blueprint runners **MUST** require an explicit
user consent to access local files via relative paths. In CLI runners, it
could be a `--allow=read-local-fs` CLI flag, while for UI runners, it
could be a checkbox. Whenever a Blueprint tried to access a local path
without the explicit consent, the runner **MUST** fail with a clear error message.

### Using bundled files

The Blueprint runner **MUST** only process the blueprint.json file and ignore
everything else in the ZIP file. The Blueprint author is responsible for
explicitly referencing every bundled file required to build the site.

The purpose of this approach is to:

-   Reduce errors – explicit references make it impossible to ship a Blueprint
-   Have a single source of truth – the Blueprint file says everything there is
-   Support explicit configuration options and the `additionalStepsAfterExecution` syntax.
-   Enable shipping a `blueprint.json` file in a git repository without automatically
    treating every file in that repository as a WordPress site artifact.

The downside of this approach is exposing the Blueprint author to the tedium
of maintaining a synchronization between the Blueprint and the bundle. To
make that process easier, Blueprint runners MAY provide a CLI command to
automatically backfill the Blueprint JSON document with any unreferenced files
in the bundle.

### Static content files

Blueprints can declare posts, pages, and other content types.

The runner **MUST** use the Data Liberation importers to process the content files:

https://github.com/Automattic/php-toolkit/tree/trunk/components/DataLiberation.

The details of the import process are up for the Data Liberation to define and
largely are out of scope of this WSP. One aspect that remains relevant is the
content URL rewriting.

#### Example 1: Importing posts and pages from a Bundle

To import content from files shipped with a Blueprint Bundle, use the following
directory layout:

```
wp-content/
└─── content/
     └─── posts/
          └─── posts/
               └─── 2025-05-02-launching-a-new-website.html
          └─── pages/
               └─── about-us.html
```

And reference the bundled files from `blueprint.json`:

```json
{
	"content": [
		{
			"type": "posts",
			"source": ["./wp-content/content/posts/posts/2025-05-02-launching-a-new-website.html", "./wp-content/content/posts/pages/about-us.html"]
		}
	]
}
```

The exact format of the content files is out of scope of this document and will
be defined in a separate proposal.

#### Example 2: Importing posts and pages inline

To import content inline, use the following JSON syntax:

```json
{
	"content": [
		{
			"type": "posts",
			"source": [
				{
					"title": "Hello World!",
					"content": "<!-- wp:paragraph --><p>Welcome to our new site.</p><!-- /wp:paragraph -->",
					"post_type": "post",
					"post_status": "publish"
				},
				{
					"title": "About Us",
					"content": "<!-- wp:paragraph --><p>We build bikes and dreams.</p><!-- /wp:paragraph -->",
					"post_type": "page",
					"post_status": "publish",
					"meta": {
						"_yoast_wpseo_focuskw": "bikes",
						"_yoast_wpseo_metadesc": "We build bikes and dreams."
					}
				}
			]
		}
	]
}
```

In this scenario, the content **MUST** BE in the block markup format – exactly like
the content found in the `post_content` column of the `wp_posts` table.

For more information on the JSON schema of the `content` property, consult [Appendix A](./appendix-A-blueprint-v2-schema.ts).

### Content URL rewriting

The URLs found in the static content are inspected and, optionally, rewritten
to keep them working after the site is created.

The importer **MUST** search for URLs in the following locations:

-   Post metadata
-   HTML attributes
-   Block attributes
-   Inline URLs detected within stretches of text

Any content not bundled in the Block Markup format **MUST** be first transformed
into Block Markup and then inspected for URLs.

The content URLs are categorized and processed accordingly as follows:

**Remote URLs** starting with `http://` or `https://`. They are preserved as-is unless the
Blueprint specifies an explicit mapping. See the `content` schema section for more details.

**Local paths** such as `/wp-content/content/posts/another-post.html` or `./another-post.html`.
They are resolved against the Blueprint Execution Context and rewritten to point
to the correct URL. Local paths MUST use forward slashes as directory separators
regardless of the operating system where the Blueprint is being executed.

For example, the following `homepage.html`:

```
Welcome to the bike shop! Learn more about our [bikes](./about-bikes.html).
```

Could be rewritten as:

```
Welcome to the bike shop! Learn more about our [bikes](/2025/05/02/about-bikes.html).
```

Static content files MAY use:

-   Relative paths – e.g. `./about-bikes.html` or `../pages/about-bikes.html`.
-   Absolute paths – e.g. `/wp-content/content/posts/about-bikes.html`. Absolute paths

Paths pointing to bundled files are only considered for content loaded
from bundled static files. The runner MUST NOT use the Blueprint Bundle
to resolve URLs found in non-bundled static files.

## Blueprint Execution Algorithm

Blueprint execution consists, at minimum, of the following steps:

1. Accept Execution Configuration
2. Validate the Blueprint
3. Resolve the Execution Target
4. Create the Execution Plan
5. Run the Execution Plan

Blueprint runners MAY also support additional semantics such as additional
validation, shorthand options that ease achieving specific goals, etc.

### Accept Execution Configuration

Execution Configuration is a set of operational choices that the Blueprint Runner
**MUST** accept from the user.

Execution Configuration contains information such as:

-   Execution Target – Are we creating a new site? Or are we updating an existing site?
-   Database Connection – Are we using MySQL or SQLite? How do we connect to the database?
-   Content Import Behavior – Are we appending new posts to the site? Or updating the existing ones?
    Or maybe we're replacing the existing data with the new content?

For details about the full set of Execution Configuration Options, see [Appendix C](./appendix-C-runner-configuration.ts).

### Validate the Blueprint

Before execution, the Blueprint Runner **MUST** validate the provided Blueprint document by performing the following checks in order:

1.  **UTF-8 Encoding:** Assert the Blueprint input is UTF-8 encoded.
2.  **JSON Validity:** Assert the input is a valid JSON document.
3.  **Schema Conformance:** Assert the JSON document conforms to the schema defined in [Appendix A](./appendix-A-blueprint-v2-schema.ts).
    This validates the structure, data types, and allowed values for all properties.
4.  **Plugin/Theme Reference Check (WordPress.org):**
    -   The validator **MAY** assert that plugin and theme slugs and version references pointing to the WordPress.org
        directory correspond to existing releases.
    -   Alternatively, this check **MAY** be deferred until the specific execution step that installs the relevant plugin or theme.
5.  **Bundle Path Validation (If validating a Bundle):**
    -   If the Blueprint is part of a Bundle, the validator **MAY** assert that all relative and absolute file paths referenced
        within the `blueprint.json` (e.g., in `plugins`, `themes`, `content` sources) point to files actually included within the bundle.
    -   A Bundle validator **MAY** also assert that all files shipped within the bundle _are_ referenced somewhere in the
        `blueprint.json` file (to detect unused files).

**Failure Handling:**

If any validation assertion fails, the validator **MUST**:

-   Stop the Blueprint execution immediately.
-   Provide a clear, human-readable error message pinpointing the issue and offering guidance on how to resolve it.

Bad error message example:

```
Invalid blueprint: value of tag "step" **MUST** be in oneOf at /additionalStepsAfterExecution/0
```

Good error message example:

```
"intallPlugi" defined in additionalStepsAfterExecution[0] is not one of supported Blueprint steps.

Did you mean "installPlugin"? See the list of supported Blueprint steps at
https://wordpress.github.io/wordpress-playground/blueprints/steps/
```

### Resolve the Execution Target

An Execution Target is the WordPress site that the Blueprint will be applied to. The process for
determining this target depends heavily on the `executionMode` specified in the
[Runner Configuration](./appendix-C-runner-configuration.ts):

-   **If `executionMode` is `'apply-to-existing-site'`: (Applying to an Existing Site)**

    -   The runner **MUST** verify that the provided `targetSiteRef` points to a directory containing a valid WordPress installation (e.g., by checking for the presence of `wp-load.php`), as required by the Runner Configuration. If not, the process stops with an error.
    -   This existing site becomes the Execution Target.
    -   The runner **MUST** verify that the WordPress version of this existing site is compatible with the `wordpressVersion` specified in the Blueprint. If not, the process stops with an error.
    -   The runner **MUST** verify that the existing site's database engine matches the `databaseEngine` specified in the Runner Configuration. If not, the process stops with an error.
    -   The runner **MUST** verify that the PHP version specified in the Blueprint (`phpVersion`, if present) is compatible with the execution environment's PHP version.

-   **If `executionMode` is `'create-new-site'`: (Creating a New Site)**
    -   The runner **MUST** verify that the provided `targetSiteRef` points to an **empty directory**, as required by the Runner Configuration. OS-specific files, such as `.DS_Store` and `Thumbs.db`, are tolerated. Other files, such as `.git` or `.svn`, are not allowed. If not, the process stops with an error.
    -   The runner **MUST** verify that valid `databaseCredentials` have been provided according to the selected `databaseEngine` in the Runner Configuration (e.g., MySQL credentials are required if `databaseEngine` is 'mysql'). If not, the process stops with an error.
    -   **Create WordPress Files:** The runner creates the standard WordPress directory structure within the `targetSiteRef` directory, downloading and placing the WordPress core files corresponding to the `wordpressVersion` from the Blueprint.
    -   **Run WordPress Installer:** The runner executes the WordPress installation process:
        -   Using the provided `databaseCredentials` and respecting the chosen `databaseEngine`.
        -   _(Note: If `databaseEngine` is 'sqlite', the runner **MUST** ensure the `sqlite-database-integration` plugin is installed and activated before database operations, as detailed in [Appendix C](./appendix-C-runner-configuration.ts)._
        -   Setting the administrator username to `admin` and password to `password`. The Blueprint may both specify a different password and the Blueprint runner may override this default with a randomly-generated secure password.
        -   Applying initial site settings like `siteLanguage` and `siteOptions.timezone` as defined in the Blueprint.
    -   The runner **MUST** verify that the installation completed successfully. If not, the process stops with an error.
    -   The runner **MUST** verify that the PHP version specified in the Blueprint (`phpVersion`, if present) is compatible with the execution environment's PHP version.
    -   This newly created site becomes the Execution Target.

Once these steps are completed successfully based on the `executionMode`, the identified or newly created site is the confirmed **Execution Target**.

### Create the Execution Plan

Blueprint execution plan is an ordered sequence of steps that transforms
an existing WordPress site from its current state into the state described
by the Blueprint.

The Blueprint runner implicitly translates declarative Blueprint properties
into imperative steps before execution. This ensures there is only one,
unambiguous way to execute every Blueprint.

For example, the Blueprint runner will translate the following Blueprint:

```
{
	"phpVersion": "8.1",
	"wordpressVersion": "6.4",
	"plugins": ["jetpack"],
	"constants": { "WP_DEBUG": true },
	"additionalStepsAfterExecution": [{ "step": "installPlugin", "slug": "akismet" }]
}
```

Into the following execution plan:

```
{
	"additionalStepsAfterExecution": [
		{ "step": "defineConstants", "constants": { "WP_DEBUG": true } },
		{ "step": "installPlugin", "slug": "jetpack", "activate": true },
		{ "step": "installPlugin", "slug": "akismet" }
	]
}
```

Note how the `phpVersion` and `wordpressVersion` properties were omitted from the execution plan. They were handled
by the runner at the [Validation stage](#validate-the-blueprint) and the [Resolve the Execution Target](#resolve-the-execution-target)
stage respectively and have no relevance to the execution plan.

##### Order of operations

Declarative properties are translated into imperative steps in the following order:

-   `constants` – defines constants in wp-config.php
-   `siteOptions`
-   `muPlugins` – installs mu-plugins in the declared order.
-   `themes` – installs themes in the declared order. Similarly to plugins, the parent theme declaration does not.
-   `activeTheme` – installs and activates the theme.
-   `plugins` – installs plugins in the declared order. The `Requires` plugin property is not considered for.
-   `fonts` – installs fonts in the declared order.
-   `media` – uploads media files to the WordPress Media Library.
-   `siteLanguage`
-   `roles` – creates a desired set of roles in the declared order.
-   `users` – creates a desired set of users in the declared order.
-   `postTypes` – creates a desired set of post types in the listed order. Requires the `secure-custom-fields` plugin to be included in the Blueprint.
-   `content` – imports content from the declared sources in the listed order. Uses the Data Liberation importers.
-   `additionalStepsAfterExecution` – imperative execution plan to execute after the declarative steps are completed.

##### Rationale for using a transpilation approach

This approach is inspired by:

-   Alex Kirk'x library of custom Blueprint steps: https://github.com/WordPress/blueprints-library/issues/118
-   Git. The low-level binary protocol is small and powerful. The CLI tool harnesses that power with an abundance of human-readable commands.

While the transpilation approach may initially seem weird, it has strong advantages:

-   Blueprint extenders can easily follow core and add their own declarative
    properties that will be transpiled into core steps.
-   Future extensions of the core Blueprint schema will require an adjusted
    transpilation pipeline, not multiple, versioned execution engines.
-   Supporting Blueprints outside of PHP requires implementing the steps,
    not the entire execution engine.
-   It is a forcing function – every future schema adjustment **MUST** cover the
    step execution order.
-   It ensures that everything expressed declaratively can also be expressed
    with steps. This is highly important in scenarios when the declarative
    approach falls short and you need to rewrite your Blueprint in a
    procedural way. Since core does that anyway, it can provide an automated
    tool for performing the conversion.
-   It makes developer tools easier to implement, e.g. a Blueprint editor that
    only understands steps will work without updates for any future version of
    the schema as long as the steps remain compatible.

### Run the Execution Plan

The Execution Plan is executed as follows:

1. **Remote assets resolution** The Blueprint runner is free to schedule the download
   in any way it wants. This WSP recommends using queue of n concurrent downloads,
   scheduling them in the order they will be needed to execute the Blueprint, and
   executing the plan in parallel. Whenever the runner needs to run a step that depends
   on a remote asset, it **MUST** wait until that asset is available.
2. **Step execution** The runner **MUST** execute the steps in the order defined by the Execution Plan.
   It **MUST** NOT parallelize step execution.
3. **Error handling** If a step fails, the runner **MUST** stop the execution of the Blueprint
   and report a meaningful error. The runner **MUST** NOT stop if the failed step explicitly
   declares that it is optional.

A Blueprint that failed to execute **MUST** NOT clean up any resources. The Execution Target
remains available for the developer to debug and restore any backups.

### Static content files

Blueprints can declare posts, pages, and other content types.

The runner **MUST** use the Data Liberation importers to process the content files:

https://github.com/Automattic/php-toolkit/tree/trunk/components/DataLiberation.

The details of the import process are up for the Data Liberation to define and
largely are out of scope of this WSP. One aspect that remains relevant is the
content URL rewriting.

#### Examples

##### 1. Importing posts and pages from a bundle

Assuming the Blueprint is shipped as a bundle with the following directory layout:

```
wp-content/
└─── content/
     └─── posts/
          └─── posts/
               └─── hello-world.html
          └─── pages/
               └─── about-us.html
```

Reference the bundled files from `blueprint.json`:

```json
{
	"content": [
		{
			"type": "posts",
			"source": ["./wp-content/content/posts/posts/hello-world.html", "./wp-content/content/posts/pages/about-us.html"]
		}
	]
}
```

##### 2. Importing posts and pages inline

Use the inline JSON syntax when you want to ship small amounts of content directly in the Blueprint:

```json
{
	"content": [
		{
			"type": "posts",
			"source": [
				{
					"title": "Hello World!",
					"content": "<!-- wp:paragraph --><p>Welcome to our new site.</p><!-- /wp:paragraph -->",
					"post_type": "post",
					"post_status": "publish"
				},
				{
					"title": "About Us",
					"content": "<!-- wp:paragraph --><p>We build bikes and dreams.</p><!-- /wp:paragraph -->",
					"post_type": "page",
					"post_status": "publish"
				}
			]
		}
	]
}
```

#### Path translation

Any path that begins with `/wordpress/` or `wordpress/` **MUST** be rewritten to a path relative to the WordPress document root. Inside inline PHP code such literals **MUST** be replaced by `getenv('DOCROOT') . '/<relative-path>'`.

#### Error handling summary

• **Invalid v1 Blueprint** → **FAIL** with validation error.  
• **Unknown resource type** → **FAIL** (`BlueprintExecutionException`).  
• **Unsupported step or option** → **WARNING**, step dropped, transpilation proceeds.

## Composing Blueprints

A process of applying multiple Blueprints to the same site is called **Composition**. This document recognizes two ways of composing Blueprints.

-   [Sequential execution](#sequential-execution)
-   [Merging Blueprints](#merging-blueprints)

A compliant Blueprint runner **MUST** support both.

### Sequential execution

The [Blueprint Execution Algorithm](#blueprint-execution-algorithm) supports running a Blueprint on
an existing site. Therefore, one way of applying multiple Blueprints to the same site is to execute
the first one, and then execute the second one on the same Execution Target.

### Merging Blueprints

When the runner is instructed to merge multiple Blueprints before the execution, it **MUST** run the merging algorithm described below. On a successful merge, the runner **MUST** execute the merged Blueprint instead of the original ones.

1.  **Initialization** – Create a `merge target` that is a new, empty Blueprint Bundle.
2.  **Validation** – Validate every input Blueprint (`input Blueprint`) using the [Validation Algorithm](#validate-the-blueprint). If validation fails, abort the merge and report the validation error.
3.  **Merge loop** – For every `input Blueprint` (and its associated Bundle), run the following steps:

    1.  **Property-by-Property merge**: Merge every property from `input Blueprint` into the `merge target` according to the rules below. If the `input Blueprint` is a Bundle, apply the rules to the bundled `/blueprint.json` file.

        -   **`version`** – assert the version of the `input Blueprint` is the same as the version of the `merge target`.
        -   **`blueprintMeta`, `$schema`** – ignore these properties.
        -   **`siteLanguage`, `activeTheme`** – assert that either:

            -   The value defined in neither the `input Blueprint` or `merge target` – in this case, ignore this property.
            -   The value defined in either the `input Blueprint` or `merge target` – in this case, use the available value.
            -   The value defined in both `input Blueprint` and `merge target` and they are the same – in this case, use that value.
            -   In any other case, abort the merge and report a conflict.

        -   **`constants`, `siteOptions`, `postTypes`, `fonts`**:

            -   Append the `input Blueprint` key-value pairs into `merge target`, fail on conflicting values for the same key.

        -   **`phpVersion`, `wordpressVersion`**:

            -   Normalize the version specifier in `input Blueprint` and `merge target` (if present) into number-based ranges.
            -   If `merge target` has no version set, adopt the normalized range from `input Blueprint`.
            -   If both have versions, calculate the intersection of the two ranges.
            -   If the intersection is empty, abort the merge and report a version conflict (e.g., "PHP version conflict: Blueprint A requires `"maxVersion": "8.0"`, but Blueprint B requires `"minVersion": "8.1"`").
            -   Update `merge target`'s version to the intersected range.

        -   **`plugins`, `themes`, `muPlugins`**:

            -   **Rule**: Merge lists by resource identifier (slug); intersect versions; fail on version conflicts or file collisions.
            -   Append resources from `input Blueprint` to `merge target`.
            -   If a resource with the same identifier (slug) exists in both `input Blueprint` and `merge target`:
                -   Assert their JSON definitions are identical.
                -   If definitions differ, abort the merge and report a resource definition conflict.

        -   **`additionalStepsAfterExecution`, `content`, `media`** – Append all items from the `input Blueprint` to the `merge target`.

        -   **`users`**:

            -   Append users from `input Blueprint` to `merge target`.
            -   When a user with the same `username` or `email` exists in both `input Blueprint` and `merge target`:
                -   Fail if `username`, `email`, or `role` are different.
                -   Merge `meta` key-value pairs, failing on conflicting values for the same key.

        -   **`roles`**:
            -   Append roles from `input Blueprint` to `merge target`.
            -   When a role with the same `name` exists in both `input Blueprint` and `merge target`:
                -   Merge `capabilities` key-value pairs, failing on conflicting values for the same key.

    2.  **File merge**:
        -   For `input Blueprint` that is a Bundle, copy all bundled files except `blueprint.json` to the `merge target`.
        -   If the file with the same path and a different content already exists in `merge target`, abort and report a file content conflict.

4.  **Output**:
    -   **On Success**: Return the final `merge target` bundle.
    -   **On Failure**: Return a detailed report listing all conflicts encountered during the merge process.

## Backwards compatibility with Blueprints v1

Blueprint v2 runner **MUST** be able to execute Blueprints v1. There is no formal specification of the
v1 format. The semantics are implied by the WordPress Playground codebase. The runners, at minimum,
**MUST**:

-   Treat any Blueprint without a `version` property as v1.
-   Validate the Blueprint v1 using the [JSON Schema defined in the WordPress Playground repository](https://github.com/WordPress/wordpress-playground/blob/c48317d9fd2f0d9cbd4da6f18ee411871ed63fd8/packages/playground/blueprints/public/blueprint-schema.json). On
    validation failure, the runner **MUST** stop the execution and report a meaningful error message.
-   Transpile the Blueprint v1 into a Blueprint v2 using the [v1 -> v2 transpilation algorithm](#v1-v2-transpilation).
-   Execute the resulting Blueprint v2.

### v1 -> v2 transpilation algorithm

General rules:

1.  **Emit `version = 2`.** The transpiler **MUST** set `version` to `2`.
2.  **Maintain order of side-effects.** All step re-writes **MUST** honour the original execution order of the v1 document.
3.  **Rewrite paths.** All VFS paths **MUST** be rewritten to replace the `/wordpress` and `wordpress` prefixes. See the [Path translation](#path-translation) section.

#### Top-level property mapping

| v1 property                | v2 destination                                          | Notes                                                                            |
| -------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `$schema`                  | `$schema`                                               | Copied verbatim.                                                                 |
| `constants`                | `additionalStepsAfterExecution[].defineConstants`       | Copied verbatim.                                                                 |
| `features.networking`      | `applicationOptions.wordpress-playground.networkAccess` | Copied verbatim.                                                                 |
| `landingPage`              | `applicationOptions.wordpress-playground.landingPage`   | Copied verbatim.                                                                 |
| `login`                    | `applicationOptions.wordpress-playground.login`         | Copied verbatim.                                                                 |
| `meta.title`               | `blueprintMeta.name`                                    |                                                                                  |
| `meta.description`         | `blueprintMeta.description`                             |                                                                                  |
| `meta.categories`          | `blueprintMeta.tags`                                    | Array preserved.                                                                 |
| `meta.author`              | `blueprintMeta.authors`                                 | Wrapped into a one-element array.                                                |
| `phpExtensionBundles`      | **MUST** be dropped with a warning.                     |
| `plugins` (array of slugs) | `additionalStepsAfterExecution[].installPlugin`         | Each entry becomes its own `installPlugin` step with `source` equal to the slug. |
| `preferredVersions.wp`     | `wordpressVersion`                                      | Omitted when the value is `"latest"`.                                            |
| `preferredVersions.php`    | `phpVersion`                                            | Omitted when the value is `"latest"`.                                            |
| `steps`                    | `additionalStepsAfterExecution`                         | Copied verbatim.                                                                 |
| `siteOptions`              | `additionalStepsAfterExecution[].setSiteOptions`        | Copied verbatim.                                                                 |

#### Step mapping

Every object inside `steps[]` **MUST** be rewritten as follows. Unsupported options inside a recognised step **MUST** be discarded with a warning.

| v1 `step`                              | v2 rewrite                                                                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `activatePlugin`                       | `activatePlugin` (rename `pluginPath → pluginPath`, propagate `humanReadableName`).                                                              |
| `activateTheme`                        | `activateTheme` (`themeFolderName → themeDirectoryName`).                                                                                        |
| `cp` / `mv` / `mkdir` / `rm` / `rmDir` | Direct one-to-one rewrite, but paths **MUST** be stripped of the `/wordpress` and `wordpress` prefixes.                                          |
| `defineWpConfigConsts`                 | `defineConstants { constants }`.                                                                                                                 |
| `defineSiteUrl`                        | **MUST** be dropped with a warning. Use runner configuration instead.                                                                            |
| `enableMultisite`                      | **MUST** be dropped with a warning.                                                                                                              |
| `importFile`                           | `importWxr` (legacy alias).                                                                                                                      |
| `importWxr`                            | `importContent` with a single source of type `"wxr"`.                                                                                            |
| `installPlugin`                        | `installPlugin` (`pluginZipFile` or `pluginData` → `source`). `options.activate` → `active`, `options.targetFolderName` → `targetDirectoryName`. |
| `installTheme`                         | `installTheme` (`themeZipFile` or `themeData` → `source`, propagate `importStarterContent`, `active`, `targetFolderName`).                       |
| `importThemeStarterContent`            | `importThemeStarterContent` (`themeZipFile` or `themeData` → `source`, propagate `importStarterContent`, `active`, `targetFolderName`).          |
| `importWordPressFiles`                 | **MUST** convert `wordPressFilesZip` to the top-level `wordpressVersion` property and be dropped.                                                |
| `login`                                | Map to top-level `applicationOptions.wordpress-playground.login` property.                                                                       |
| `request`                              | **MUST** be dropped with a warning.                                                                                                              |
| `resetData`                            | `runPHP` step that truncates core tables (see reference implementation).                                                                         |
| `runPHP`                               | `runPHP` quoting the PHP code as an inline file (`filename = "script.php"`).                                                                     |
| `runSQL`                               | `runSQL` with an inline SQL file (`filename = "script.sql"`).                                                                                    |
| `runWpInstallationWizard`              | **MUST** be dropped with a warning.                                                                                                              |
| `setSiteLanguage`                      | `setSiteLanguage`.                                                                                                                               |
| `setSiteOptions`                       | `setSiteOptions`.                                                                                                                                |
| `unzip`                                | `unzip` (`zipPath` or `zipFile` → `zipFile`, `extractToPath` rewritten as for file-system steps).                                                |
| `updateUserMeta`                       | `runPHP` step that loops over `meta` and calls `update_user_meta`.                                                                               |
| `writeFile`                            | `writeFile`                                                                                                                                      |
| `writeFiles`                           | `writeFiles`                                                                                                                                     |
| `wp-cli`                               | `wp-cli` (command string **MUST** have the `/wordpress` prefix removed).                                                                         |

All rewritten steps **MUST** be appended, in their original order, to `additionalStepsAfterExecution`.

#### Resource -> Data Reference conversion

During transpilation every reference that points to a plugin, theme, ZIP archive, SQL dump, or any other file **MUST** be rewritten into the canonical v2 data reference format. Two resource shapes are recognised and must be handled separately.

##### 1. String shorthand (primitive JSON string)

The value is a bare string such as `"jetpack"` or `"wp-content/plugins/foo.zip"`. The transpiler **MUST** evaluate the string in the following order and emit the corresponding v2 reference:

a. **Absolute URL** – if the string contains the `://` sequence, treat it as a fully-qualified URL and copy it verbatim.

b. **Bundle-relative path** – otherwise, if the string contains a `/` character, treat it as a path inside the Blueprint bundle. Pre-pend `./` unless the string already starts with `./` or `/` so that the execution context is explicit. The path **MUST NOT** be normalised in any other way.

c. **WordPress.org slug** – if the value refers to a plugin or a theme, treat the string as a WordPress.org slug and copy it verbatim.

Values that cannot be matched to any of the above cases **MUST** stop the transpilation and report an error.

##### 2. Object form (`{"resource": …}`)

When the value is an object with the `resource` discriminator, the transpiler **MUST** inspect the discriminator and produce the v2 output shown in the table below. Any key not explicitly mentioned **MUST** be ignored during transpilation and preserved for later execution.

| `resource` value                                  | Action – emit …                                                                                 |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `literal`                                         | InlineFile – `{ "filename": <name>, "content": <contents> }`.                                   |
| `literal:directory`                               | InlineDirectory – `{ "directoryName": <name>, "files": <files> }`.                              |
| `wordpress.org/plugins` or `wordpress.org/themes` | the `slug` string.                                                                              |
| `url`                                             | the `url` string verbatim.                                                                      |
| `bundled`                                         | a bundle-relative path; **prepend `./` when the path does not start with `./` or `/`.**         |
| `vfs`                                             | the path prefixed with `"site:"`, e.g. `"site:/wp-content/mu-plugins/loader.php"`.              |
| `git:directory`                                   | GitDirectoryReference – `{ "gitRepository": <url>, "pathInRepository": <path>, "ref": <ref> }`. |

Examples:

| v1 object                                                                           | v2 reference                                                    |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `{ "resource": "literal", "name": "hello.php", "contents": "<?php echo 'Hi'; ?>" }` | `{ "filename": "hello.php", "content": "<?php echo 'Hi'; ?>" }` |
| `{ "resource": "url", "url": "https://example.com/theme.zip" }`                     | `"https://example.com/theme.zip"`                               |
| `{ "resource": "vfs", "path": "/wp-content/mu-plugins/loader.php" }`                | `"site:/wp-content/mu-plugins/loader.php"`                      |
| `{ "resource": "bundled", "path": "wp-content/themes/my-child" }`                   | `"./wp-content/themes/my-child"`                                |

The transpiler **MUST NOT** attempt to download, unzip, or otherwise dereference any of the above resources – it only rewrites descriptors. Retrieval is handled later by the runner.

#### Path translation

Any path that both:

-   Refers to a VFS location (NOT a remote resource or a bundled file), and
-   Starts with `/wordpress/` or `wordpress/`

**MUST** be rewritten to a path relative to the WordPress document root.

PHP code provided via the `runPHP` step and `writeFile`/`writeFiles` steps **MUST** be parsed (e.g. with `token_get_all`). All paths starting with `/wordpress/` or `wordpress/` **MUST** be rewritten as `getenv('DOCROOT') . '/<relative-path>'`.

Any other paths **MUST** be left unchanged. There is no reliable way of identifying all possible ways of embedding a path in a Blueprint v1 and inferring too much could lead to unexpected errors.

## Areas intentionally not covered by this proposal

-   Multisite configuration – it may require a separate schema and is left for a future iteration of the Blueprint specification.
-   Content import format – it is a separate, nuanced topic that warrants a dedicated proposal.
