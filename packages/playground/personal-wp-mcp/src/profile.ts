interface McpServerPromptDefinition {
	name: string;
	title: string;
	description: string;
	text: string;
}

export interface PersonalWpMcpProfileDefinition {
	name: string;
	description: string;
	prompts: McpServerPromptDefinition[];
}

export const personalWpMcpProfile: PersonalWpMcpProfileDefinition = {
	name: 'mywp',
	description: `MyWP MCP gives external AI clients a live persistent WordPress \
site at my.wordpress.net with admin access, filesystem tools, authenticated HTTP \
requests, PHP execution, browser navigation, and site management.\n\n\
Start every workflow with playground_list_sites. If no browser is connected, \
call playground_get_website_url and ask the user to open that exact URL.\n\n\
For best results, load the MCP prompt named mywp-agent. It is the reusable \
operating prompt for external clients. Then load focused skill prompts that match \
the task, such as mywp-skill-abilities, mywp-skill-file-editing, \
mywp-skill-plugin-development, mywp-skill-create-app, or \
mywp-skill-sync-local-changes.\n\n\
Prefer WordPress-native interfaces before raw execution: use playground_request \
with REST routes for content and settings, inspect /wp-json/ route metadata when \
unsure, discover plugin-specific capabilities through the Abilities API when \
present, and use playground_execute_php only when REST or abilities do not expose \
the needed operation.\n\n\
MyWP stores the site in the user's browser. Call playground_save_in_browser \
early if the site is not already persisted. Tool failures are returned as thrown \
exceptions with descriptive messages, not silent failures.`,
	prompts: [
		{
			name: 'mywp-agent',
			title: 'MyWP Agent',
			description:
				'Operating prompt for using MyWP MCP as a capable external WordPress agent.',
			text: `You are operating a live MyWP site through MCP.

Use the Playground tools as your WordPress runtime, not as incidental helpers.
The browser tab is my.wordpress.net. It contains WordPress running
in WebAssembly, persisted in the user's browser storage. The active user is
authenticated as an administrator.

Startup:
- Call playground_list_sites before any site-specific tool.
- If no site is connected, call playground_get_website_url and ask the user to
  open that exact URL.
- Use the returned siteId for all site-specific calls.
- Call playground_save_in_browser early when a multi-step task would be costly
  to lose.

Capability order:
- Use playground_request with WordPress REST routes for normal WordPress data:
  posts, pages, terms, users, comments, settings, and route discovery.
- Inspect /wp-json/ route metadata before using unfamiliar endpoint arguments.
- When plugins expose the WordPress Abilities API, discover and use abilities
  before raw PHP for plugin-specific actions.
- Use playground_execute_php when REST and abilities do not expose the needed
  operation or when direct WordPress/PHP inspection is the clearest route.
- Use filesystem tools for source files and generated artifacts in the virtual
  filesystem. The WordPress root is /wordpress/.

Execution discipline:
- Read current files before modifying them.
- Keep generated output bounded. Avoid unbounded database queries, recursive
  directory dumps, and full HTML reads unless necessary.
- After code changes, run the cheapest useful verification available: PHP lint
  through playground_execute_php, a REST request, a page request, or browser
  navigation.
- Report concrete paths, URLs, and verification results in the final answer.`,
		},
		{
			name: 'mywp-skill-abilities',
			title: 'WordPress Abilities Skill',
			description:
				'Use WordPress REST route metadata and the Abilities API before falling back to PHP.',
			text: `Use this skill for plugin-specific data or actions.

Discovery workflow:
- Start with GET /wp-json/ through playground_request to inspect available REST
  routes when endpoint support is uncertain.
- If /wp-json/wp-abilities/v1/abilities exists, use it to discover exact
  ability IDs. Ability categories and domain slugs are not executable IDs.
- List compactly first, for example:
  /wp-json/wp-abilities/v1/abilities?_fields=name,category,label,description
- Get one ability before executing it:
  /wp-json/wp-abilities/v1/abilities/{name}
- Ability names can contain slash characters. Use the documented path shape from
  the route; do not invent encoded variants unless route metadata requires it.
- Execute the ability with the method and input schema documented by the ability
  details. POST bodies usually wrap arguments in an input object.

Fallbacks:
- Use regular WordPress REST routes for core WordPress CRUD.
- Use playground_execute_php only when REST routes and abilities do not expose
  the needed operation.`,
		},
		{
			name: 'mywp-skill-file-editing',
			title: 'MyWP File Editing Skill',
			description:
				'Guidance for safe file inspection and edits in the MyWP virtual filesystem.',
			text: `Use this skill when creating, modifying, or deleting files.

Rules:
- Read the current file before editing unless its exact current content is
  already present in this turn.
- Prefer narrow reads: list directories, then read specific files.
- Use playground_write_file for new files or intentional full-file replacement.
- When changing an existing file, preserve unrelated content and formatting.
- Create parent directories with playground_mkdir before writing new nested
  files.
- Delete files or directories only when the user explicitly asks or when the
  generated artifact is clearly obsolete and you explain why.
- After PHP edits, run a lint check through playground_execute_php when
  practical.

Useful PHP lint pattern:
<?php
$file = '/wordpress/wp-content/plugins/example/example.php';
passthru('php -l ' . escapeshellarg($file), $code);
exit($code);`,
		},
		{
			name: 'mywp-skill-plugin-development',
			title: 'WordPress Plugin Development Skill',
			description:
				'Guidance for creating or changing plugins inside WordPress Playground.',
			text: `Use this skill for WordPress plugin work.

Workflow:
- Inspect the existing plugin or target directory before changing it.
- Prefer WordPress APIs, hooks, REST routes, blocks, and abilities over ad hoc
  global code.
- Keep plugin bootstrap files small. Put larger behavior in included PHP files
  or classes when the plugin already uses that structure.
- Register custom post types, taxonomies, shortcodes, and blocks on init.
- Register REST routes on rest_api_init.
- Flush rewrite rules only on activation or deactivation, not on every request.
- After changes, verify the plugin can load. Use PHP lint first, then a REST or
  browser request that exercises the changed behavior.

When plugin-specific abilities exist, use the Abilities skill first.`,
		},
		{
			name: 'mywp-skill-sync-local-changes',
			title: 'Sync Local Changes To MyWP',
			description:
				'Guidance for copying local project changes into the my.wordpress.net sandbox.',
			text: `Use this skill when the user wants to copy local files into the
MyWP sandbox at my.wordpress.net.

Mental model:
- MCP filesystem tools operate inside the browser-based WordPress filesystem,
  rooted at /wordpress/.
- Local project files are not automatically mounted into my.wordpress.net.
  The external client must read local files itself, then write their contents
  into the sandbox with playground_mkdir and playground_write_file.
- Typical destination paths are under:
  /wordpress/wp-content/plugins/{plugin-slug}/
  /wordpress/wp-content/themes/{theme-slug}/
  /wordpress/wp-content/mu-plugins/

Workflow:
1. Call playground_list_sites. If no site is connected, call
   playground_get_website_url and ask the user to open the returned URL.
2. Confirm which connected siteId is the MyWP sandbox you are syncing into.
3. Call playground_save_in_browser if the site is temporary.
4. Identify the local source directory and the sandbox destination directory.
   Confirm before overwriting an existing plugin or theme if the mapping is
   ambiguous.
5. List the local files using the external client's normal filesystem access.
   Exclude generated or dependency-heavy directories unless they are required:
   .git, node_modules, vendor, dist, build, coverage, caches, logs, and local
   environment files are usually not synced.
6. Create needed sandbox directories with playground_mkdir.
7. Copy changed text files with playground_write_file. For binary assets, only
   sync them if the MCP client can preserve their bytes correctly; otherwise
   tell the user to use a zip/import path or another transfer mechanism.
8. Do not delete sandbox files unless the user explicitly asks for a mirror sync
   or confirms deletion.
9. Verify after syncing. For PHP, run a lint check through
   playground_execute_php. Then use playground_request or playground_navigate
   to check the affected admin page, route, plugin, or theme behavior.

Suggested PHP lint pattern:
<?php
$paths = array(
    '/wordpress/wp-content/plugins/example/example.php',
);
foreach ($paths as $file) {
    passthru('php -l ' . escapeshellarg($file), $code);
    if ($code !== 0) {
        exit($code);
    }
}

When the user asks to sync "this plugin", infer the plugin slug from the local
plugin main file when possible. The sandbox target should normally be
/wordpress/wp-content/plugins/{slug}/.`,
		},
		{
			name: 'mywp-skill-create-app',
			title: 'Create A MyWP App',
			description:
				'Create an app-like WordPress plugin locally with create-wp-app, then sync it into MyWP.',
			text: `Use this skill when the user asks to create an app, web app, "wp app",
WordPress app, WpApp app, or app-like WordPress plugin for MyWP.

Also use it when the requested plugin sounds like an app: something with its
own URL route, screen, dashboard, workflow, logged-in experience, data UI, or
standalone interface. Do not use it for narrow infrastructure plugins that only
add hooks, filters, blocks, shortcodes, REST endpoints, or admin settings with
no app-style UI.

Local-first workflow:
- MyWP runs in the browser, but the external MCP client may also have access to
  the user's local machine. Prefer scaffolding the app locally, then syncing the
  generated plugin into the MyWP sandbox.
- If Composer is available, prefer the normal Composer project mode:
  composer create-project akirk/create-wp-app {plugin-slug}
  The final argument is the local target directory to create. It should usually
  match the plugin slug.
- For non-interactive scaffolding, set the WP_APP_* environment variables
  documented by akirk/create-wp-app, including WP_APP_PLUGIN_NAME,
  WP_APP_NAMESPACE, WP_APP_AUTHOR, WP_APP_URL_PATH, WP_APP_SETUP_TYPE,
  WP_APP_DEPENDENCY_MODE=composer, and WP_APP_AUTOLOAD_MODE=composer.
- Prefer WP_APP_SETUP_TYPE=full for AI-built apps unless the user asks for a
  minimal scaffold.
- Use Composer dependency/autoload mode when generating locally. Unlike an
  in-browser Playground-only workflow, the local machine may have Composer and
  can generate vendor/autoload.php normally.
- The generated plugin can be tested locally with:
  npx @wp-playground/cli@latest server --auto-mount={plugin-slug} --login
- Initialize Git in the generated plugin directory and commit the scaffold
  before making feature changes. Use later commits to track local changes that
  should be synced into MyWP.

Naming defaults:
- slug: lowercase kebab-case from the product/domain, e.g. timetable. Do not
  include the generic word app or use an -app suffix unless the user explicitly
  names it that way.
- plugin name: human name from the product/domain, e.g. Timetable. Do not add
  App unless the user explicitly named it that way.
- namespace: PascalCase from the plugin name.
- url path: same as slug, without a leading slash.
- author: empty unless the user provides it.

Implementation workflow:
1. Ask only for required values that cannot be inferred.
2. Scaffold locally with:
   composer create-project akirk/create-wp-app {plugin-slug}
3. Initialize Git and commit the generated baseline:
   git init
   git add .
   git commit -m "Initial create-wp-app scaffold"
4. Read the generated main plugin file, src/App.php, templates/index.php, and
   README.md before modifying generated code.
5. Create or update IMPLEMENTATION_PLAN.md in the generated plugin root before
   follow-up code changes. Keep it concise and resumable.
6. Follow the generated lifecycle and extension points instead of guessing where
   code should run.
7. Commit meaningful local changes after implementation or verification so the
   diff from the scaffold is easy to inspect before syncing.
8. Verify local PHP syntax where possible.
9. Use mywp-skill-sync-local-changes to copy the generated plugin into
   /wordpress/wp-content/plugins/{plugin-slug}/.
10. Activate the plugin only if requested or needed for verification.
11. In the final response, report the local plugin path, MyWP destination path,
   app URL path, and verification results.

Generated app guidance:
- WpApp provides URL routing, theme isolation, WordPress admin/masterbar
  integration, admin color scheme tokens, access control, the BaseApp pattern,
  and the BaseStorage pattern.
- Keep __construct() focused on creating/configuring WpApp, assigning storage
  objects, and attaching WordPress hooks.
- Register custom post types and taxonomies on init.
- Register dashboard widgets on wp_dashboard_setup.
- Define WpApp routes in setup_routes() and WpApp menu/masterbar entries in
  setup_menu().
- Templates should use WpApp template helpers such as wp_app_head(),
  wp_app_body_open(), wp_app_body_close(), wp_app_title(), and
  wp_app_language_attributes() when building standalone HTML shells.
- When enqueueing app assets, prefer WpApp scoped helpers such as
  wp_app_enqueue_style() and wp_app_enqueue_script() so assets are attached to
  the app's scoped hook instead of leaking between apps.
- Use WordPress capabilities and roles for access control rather than custom
  auth systems when WordPress user identity is sufficient.
- Run activation-only work, including custom table creation and rewrite
  flushing, from the plugin activation hook.
- Prefer WordPress-native storage before custom tables: CPTs plus post meta,
  taxonomies plus term meta, user meta, and options.
- Use custom tables or BaseStorage only when native storage does not fit.
- After syncing PHP changes into MyWP, verify with playground_execute_php and
  then with playground_request or playground_navigate.

Converting existing frontend apps:
- Prefer converting a deployable static app: root index.html, build/, dist/, or
  an explicitly supplied output directory.
- Do not treat obvious bundler development entries such as src/main.jsx or
  templates with %PUBLIC_URL% as deployable root HTML.
- For Create React App, ensure "homepage": "." or PUBLIC_URL=. before building
  so generated chunk paths remain portable.
- Apps with client-side routing should prefer hash routing or configure the
  router basename to match the WpApp URL path.`,
		},
	],
};
