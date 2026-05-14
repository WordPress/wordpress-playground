#!/usr/bin/env node
/**
 * Run a real Playground CLI static export and verify exported URL targets.
 *
 * This smoke intentionally uses the published Playground CLI by default so it
 * can run from sparse checkouts without installing the whole monorepo.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const pluginDir = path.join(__dirname, 'plugin');
const tempRoot = mkdtempSync(path.join(tmpdir(), 'ssgwp-playground-smoke-'));
const exportHostDir = path.join(tempRoot, 'exports');
const blueprintPath = path.join(tempRoot, 'blueprint.json');
const exportDir = path.join(exportHostDir, 'site');
const scopedExportDir = path.join(exportHostDir, 'scoped-site');
const cliZipPath = path.join(exportHostDir, 'cli-site.zip');
const cliExportDir = path.join(tempRoot, 'cli-site');
const wpVersion = process.env.SSGWP_SMOKE_WP_VERSION || '6.8';
const phpVersion = process.env.SSGWP_SMOKE_PHP_VERSION || '8.3';
const cliAttempts = Number.parseInt(
	process.env.SSGWP_SMOKE_CLI_ATTEMPTS || '3',
	10
);

let failed = false;
let currentExportDir = exportDir;

try {
	mkdirSync(exportHostDir, { recursive: true });
	writeFileSync(blueprintPath, JSON.stringify(createBlueprint(), null, '\t'));
	runPlaygroundCli();
	await verifyExport();
	await verifyScopedExport();
	verifyCliExport();
} catch (error) {
	failed = true;
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
} finally {
	if (failed || process.env.SSGWP_KEEP_SMOKE_OUTPUT) {
		console.error(`Smoke output kept at ${tempRoot}`);
	} else {
		rmSync(tempRoot, { force: true, recursive: true });
	}
}

function createBlueprint() {
	return {
		$schema: 'https://playground.wordpress.net/blueprint-schema.json',
		extraLibraries: ['wp-cli'],
		preferredVersions: {
			wp: wpVersion,
			php: phpVersion,
		},
		steps: [
			{
				step: 'activatePlugin',
				pluginPath: 'static-site-generator/static-site-generator.php',
			},
			{
				step: 'runPHP',
				code: createSmokePhp(),
			},
			{
				step: 'wp-cli',
				command:
					'wp static-site export --output=/exports/cli-site.zip --fetch-mode=internal --max-pages=90',
			},
		],
	};
}

function createSmokePhp() {
	return `<?php
require '/wordpress/wp-load.php';

$posts = get_posts(array(
	'numberposts' => -1,
	'post_type' => array('post', 'page'),
	'post_status' => 'any',
));

foreach ($posts as $post) {
	wp_delete_post($post->ID, true);
}

global $wp_rewrite;
$wp_rewrite->set_permalink_structure('/%postname%/');
$wp_rewrite->flush_rules();
kses_remove_filters();

$theme_dir = trailingslashit(get_theme_root()) . 'ssgwp-smoke-theme';
wp_mkdir_p($theme_dir);
file_put_contents(
	$theme_dir . '/style.css',
	"/*\\nTheme Name: SSGWP Smoke Theme\\n*/\\nbody{font-family:sans-serif}.smoke-theme-marker{color:#123456}"
);
file_put_contents(
	$theme_dir . '/theme-marker.css',
	'.smoke-theme-marker{border-bottom:3px solid #123456}'
);
file_put_contents(
	$theme_dir . '/functions.php',
	"<?php\\nadd_theme_support('title-tag');\\n"
);
file_put_contents(
	$theme_dir . '/header.php',
<<<'SSGWP_THEME'
<!doctype html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<link rel="stylesheet" href="<?php echo esc_url( get_stylesheet_directory_uri() . '/theme-marker.css' ); ?>">
	<?php wp_head(); ?>
</head>
<body <?php body_class( 'smoke-theme-marker' ); ?>>
SSGWP_THEME
);
file_put_contents(
	$theme_dir . '/footer.php',
<<<'SSGWP_THEME'
	<?php wp_footer(); ?>
</body>
</html>
SSGWP_THEME
);
file_put_contents(
	$theme_dir . '/index.php',
<<<'SSGWP_THEME'
<?php get_header(); ?>
<main data-smoke-template="home">
	<h1>Smoke Theme Home</h1>
	<p>Custom smoke theme homepage marker.</p>
	<?php if ( have_posts() ) : ?>
		<ul>
			<?php while ( have_posts() ) : the_post(); ?>
				<li><a class="archive-link" href="<?php the_permalink(); ?>"><?php the_title(); ?></a></li>
			<?php endwhile; ?>
		</ul>
	<?php endif; ?>
</main>
<?php get_footer(); ?>
SSGWP_THEME
);
file_put_contents(
	$theme_dir . '/single.php',
<<<'SSGWP_THEME'
<?php get_header(); ?>
<?php while ( have_posts() ) : the_post(); ?>
<main data-smoke-template="single">
	<h1><?php the_title(); ?></h1>
	<p>Smoke Theme Single</p>
	<?php the_content(); ?>
</main>
<?php endwhile; ?>
<?php get_footer(); ?>
SSGWP_THEME
);
file_put_contents(
	$theme_dir . '/page.php',
<<<'SSGWP_THEME'
<?php get_header(); ?>
<?php while ( have_posts() ) : the_post(); ?>
<main data-smoke-template="page">
	<h1><?php the_title(); ?></h1>
	<p>Smoke Theme Page</p>
	<?php the_content(); ?>
</main>
<?php endwhile; ?>
<?php get_footer(); ?>
SSGWP_THEME
);
switch_theme('ssgwp-smoke-theme');

$upload_dir = wp_upload_dir();
$asset_path = trailingslashit($upload_dir['basedir']) . 'ssgwp-smoke-asset.txt';
$asset_url = trailingslashit($upload_dir['baseurl']) . 'ssgwp-smoke-asset.txt';
file_put_contents($asset_path, 'static export smoke asset');
$captions_path = trailingslashit($upload_dir['basedir']) . 'ssgwp-smoke-captions.vtt';
$captions_url = trailingslashit($upload_dir['baseurl']) . 'ssgwp-smoke-captions.vtt';
file_put_contents($captions_path, "WEBVTT\\n\\n00:00.000 --> 00:01.000\\nCaption");

$manifest_dir = trailingslashit(WP_PLUGIN_DIR) . 'ssgwp-smoke-deps';
wp_mkdir_p($manifest_dir . '/icons');
wp_mkdir_p($manifest_dir . '/maps');
file_put_contents(
	$manifest_dir . '/manifest.json',
	wp_json_encode(array('icons' => array(
		array('src' => 'icon-192.png'),
		array('src' => 'icons/icon.png'),
	)))
);
file_put_contents($manifest_dir . '/icon-192.png', 'icon-192');
file_put_contents($manifest_dir . '/icons/icon.png', 'icon');
file_put_contents(
	$manifest_dir . '/filter.svg',
	'<svg><filter><feImage href="icons/filter.png"></feImage></filter></svg>'
);
file_put_contents(
	$manifest_dir . '/browserconfig.xml',
	'<browserconfig><msapplication><tile>'
		. '<square70x70logo src="icons/tile-small.png"/>'
		. '</tile></msapplication></browserconfig>'
);
file_put_contents($manifest_dir . '/player.json', wp_json_encode(array(
	'captions' => 'captions.vtt',
	'runtime' => 'runtime.wasm',
)));
file_put_contents(
	$manifest_dir . '/app.css',
	'.smoke{color:#123456}' . "\\n" . '/*# sourceMappingURL=maps/app.css.map */'
);
file_put_contents($manifest_dir . '/maps/app.css.map', '{"version":3,"sources":["app.scss"],"mappings":""}');
file_put_contents($manifest_dir . '/captions.vtt', "WEBVTT\\n\\n00:00.000 --> 00:01.000\\nPlugin");
file_put_contents($manifest_dir . '/runtime.wasm', 'wasm');
file_put_contents($manifest_dir . '/icons/filter.png', 'filter');
file_put_contents($manifest_dir . '/icons/tile-small.png', 'tile-small');
$manifest_url = content_url('plugins/ssgwp-smoke-deps/manifest.json');
$sourcemap_css_url = content_url('plugins/ssgwp-smoke-deps/app.css');
$filter_svg_url = content_url('plugins/ssgwp-smoke-deps/filter.svg');
$browserconfig_url = content_url('plugins/ssgwp-smoke-deps/browserconfig.xml');
$player_config_url = content_url('plugins/ssgwp-smoke-deps/player.json');

$first_post_id = wp_insert_post(array(
	'post_type' => 'post',
	'post_status' => 'publish',
	'post_title' => 'First Smoke Post',
	'post_name' => 'first-smoke-post',
	'post_content' => '<p>First smoke post unique body.</p>',
));

$second_post_id = wp_insert_post(array(
	'post_type' => 'post',
	'post_status' => 'publish',
	'post_title' => 'Second Smoke Post',
	'post_name' => 'second-smoke-post',
	'post_content' => '<p>Second smoke post unique body.</p>',
));

$about_page_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'About Export',
	'post_name' => 'about-export',
	'post_content' => '<p>About export page unique body.</p>',
));

$child_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Child Page',
	'post_name' => 'child-page',
	'post_content' => '<p>Child export target.</p>',
));

$parent_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Parent Page',
	'post_name' => 'parent-page',
	'post_content' => '<p>Parent export target.</p>',
));

$comments_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Comments',
	'post_name' => 'comments',
	'post_content' => '<p>Comments page export target.</p>',
));

$embed_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Embed Only',
	'post_name' => 'embed-only',
	'post_content' => '<p>Embed-only export target.</p>',
));

$deferred_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Deferred Link',
	'post_name' => 'deferred-link',
	'post_content' => '<p>Deferred data-href export target.</p>',
));

$citation_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Citation Source',
	'post_name' => 'citation-source',
	'post_content' => '<p>Citation URL export target.</p>',
));

$form_target_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Form Target',
	'post_name' => 'form-target',
	'post_content' => '<p>Form action export target.</p>',
));

$form_button_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Form Button',
	'post_name' => 'form-button',
	'post_content' => '<p>Button formaction export target.</p>',
));

$form_input_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Form Input',
	'post_name' => 'form-input',
	'post_content' => '<p>Input formaction export target.</p>',
));

$task_target_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Task Target',
	'post_name' => 'task-target',
	'post_content' => '<p>Pinned-site task export target.</p>',
));

$start_url_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Start URL',
	'post_name' => 'start-url',
	'post_content' => '<p>Pinned-site start URL export target.</p>',
));

$link_rel_about_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Link Relation About',
	'post_name' => 'link-rel-about',
	'post_content' => '<p>About link relation export target.</p>',
));

$link_rel_copyright_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Link Relation Copyright',
	'post_name' => 'link-rel-copyright',
	'post_content' => '<p>Copyright link relation export target.</p>',
));

$link_rel_glossary_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Link Relation Glossary',
	'post_name' => 'link-rel-glossary',
	'post_content' => '<p>Glossary link relation export target.</p>',
));

$link_rel_payment_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Link Relation Payment',
	'post_name' => 'link-rel-payment',
	'post_content' => '<p>Payment link relation export target.</p>',
));

$microdata_profile_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Microdata Profile',
	'post_name' => 'microdata-profile',
	'post_content' => '<p>Microdata link export target.</p>',
));

$microdata_significant_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Microdata Significant Link',
	'post_name' => 'microdata-significant',
	'post_content' => '<p>Microdata significant link export target.</p>',
));

$microdata_license_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Microdata License',
	'post_name' => 'microdata-license',
	'post_content' => '<p>Microdata license page export target.</p>',
));

$microdata_related_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Microdata Related Link',
	'post_name' => 'microdata-related',
	'post_content' => '<p>Microdata related link export target.</p>',
));

$microdata_breadcrumb_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Microdata Breadcrumb',
	'post_name' => 'microdata-breadcrumb',
	'post_content' => '<p>Microdata breadcrumb item export target.</p>',
));

$microdata_item_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Microdata Item',
	'post_name' => 'microdata-item',
	'post_content' => '<p>Microdata itemid export target.</p>',
));

$microdata_type_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Microdata Type',
	'post_name' => 'microdata-type',
	'post_content' => '<p>Microdata itemtype export target.</p>',
));

$microdata_secondary_type_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Microdata Secondary Type',
	'post_name' => 'microdata-secondary-type',
	'post_content' => '<p>Microdata secondary itemtype export target.</p>',
));

$rdfa_about_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'RDFa About',
	'post_name' => 'rdfa-about',
	'post_content' => '<p>RDFa about export target.</p>',
));

$rdfa_resource_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'RDFa Resource',
	'post_name' => 'rdfa-resource',
	'post_content' => '<p>RDFa resource export target.</p>',
));

$rdfa_vocab_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'RDFa Vocab',
	'post_name' => 'rdfa-vocab',
	'post_content' => '<p>RDFa vocab export target.</p>',
));

$svg_link_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'SVG Link',
	'post_name' => 'svg-link',
	'post_content' => '<p>SVG anchor export target.</p>',
));

$image_metadata_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Image Metadata',
	'post_name' => 'image-metadata',
	'post_content' => '<p>WordPress image metadata export target.</p>',
));

$schema_profile_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Schema Profile',
	'post_name' => 'schema-profile',
	'post_content' => '<p>Schema meta export target.</p>',
));

$schema_license_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Schema License',
	'post_name' => 'schema-license',
	'post_content' => '<p>Schema license export target.</p>',
));

$schema_breadcrumb_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Schema Breadcrumb',
	'post_name' => 'schema-breadcrumb',
	'post_content' => '<p>Schema breadcrumb item export target.</p>',
));

$schema_collection_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Schema Collection',
	'post_name' => 'schema-collection',
	'post_content' => '<p>Schema collection export target.</p>',
));

$schema_part_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Schema Part',
	'post_name' => 'schema-part',
	'post_content' => '<p>Schema part export target.</p>',
));

$schema_source_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Schema Source',
	'post_name' => 'schema-source',
	'post_content' => '<p>Schema source export target.</p>',
));

$schema_policy_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Publishing Principles',
	'post_name' => 'publishing-principles',
	'post_content' => '<p>Schema publishing principles export target.</p>',
));

$schema_author_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Schema Author',
	'post_name' => 'schema-author',
	'post_content' => '<p>Schema author export target.</p>',
));

$schema_publisher_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Schema Publisher',
	'post_name' => 'schema-publisher',
	'post_content' => '<p>Schema publisher export target.</p>',
));

$schema_contributor_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Schema Contributor',
	'post_name' => 'schema-contributor',
	'post_content' => '<p>Schema contributor export target.</p>',
));

$schema_reviewer_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Schema Reviewer',
	'post_name' => 'schema-reviewer',
	'post_content' => '<p>Schema reviewer export target.</p>',
));

$schema_about_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Schema About',
	'post_name' => 'schema-about',
	'post_content' => '<p>Schema about export target.</p>',
));

$schema_main_entity_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Schema Main Entity',
	'post_name' => 'schema-main-entity',
	'post_content' => '<p>Schema main entity export target.</p>',
));

$schema_main_entity_page_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Schema Main Entity Page',
	'post_name' => 'schema-main-entity-page',
	'post_content' => '<p>Schema main entity page export target.</p>',
));

$schema_main_entity_link_page_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Schema Main Entity Link Page',
	'post_name' => 'schema-main-entity-link-page',
	'post_content' => '<p>Schema main entity link page export target.</p>',
));

$schema_mentions_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Schema Mentions',
	'post_name' => 'schema-mentions',
	'post_content' => '<p>Schema mentions export target.</p>',
));

$schema_subject_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Schema Subject',
	'post_name' => 'schema-subject',
	'post_content' => '<p>Schema subject export target.</p>',
));

$schema_citation_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Schema Citation',
	'post_name' => 'schema-citation',
	'post_content' => '<p>Schema citation export target.</p>',
));

$amp_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'AMP Companion',
	'post_name' => 'amp-companion',
	'post_content' => '<p>AMP companion export target.</p>',
));

$preloaded_document_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Preloaded Document',
	'post_name' => 'preloaded-document',
	'post_content' => '<p>Document preload export target.</p>',
));

wp_update_post(array(
	'ID' => $child_id,
	'post_parent' => $parent_id,
));

$child_url = get_permalink($child_id);
$first_post_url = get_permalink($first_post_id);
$second_post_url = get_permalink($second_post_id);
$about_page_url = get_permalink($about_page_id);
$comments_url = get_permalink($comments_id);
$embed_url = get_permalink($embed_id);
$deferred_url = get_permalink($deferred_id);
$citation_url = get_permalink($citation_id);
$form_target_url = get_permalink($form_target_id);
$form_button_url = get_permalink($form_button_id);
$form_input_url = get_permalink($form_input_id);
$task_target_url = get_permalink($task_target_id);
$start_url = get_permalink($start_url_id);
$link_rel_about_url = get_permalink($link_rel_about_id);
$link_rel_copyright_url = get_permalink($link_rel_copyright_id);
$link_rel_glossary_url = get_permalink($link_rel_glossary_id);
$link_rel_payment_url = get_permalink($link_rel_payment_id);
$microdata_profile_url = get_permalink($microdata_profile_id);
$microdata_significant_url = get_permalink($microdata_significant_id);
$microdata_license_url = get_permalink($microdata_license_id);
$microdata_related_url = get_permalink($microdata_related_id);
$microdata_breadcrumb_url = get_permalink($microdata_breadcrumb_id);
$microdata_item_url = get_permalink($microdata_item_id);
$microdata_type_url = get_permalink($microdata_type_id);
$microdata_secondary_type_url = get_permalink($microdata_secondary_type_id);
$rdfa_about_url = get_permalink($rdfa_about_id);
$rdfa_resource_url = get_permalink($rdfa_resource_id);
$rdfa_vocab_url = get_permalink($rdfa_vocab_id);
$svg_link_url = get_permalink($svg_link_id);
$image_metadata_url = get_permalink($image_metadata_id);
$schema_profile_url = get_permalink($schema_profile_id);
$schema_license_url = get_permalink($schema_license_id);
$schema_breadcrumb_url = get_permalink($schema_breadcrumb_id);
$schema_collection_url = get_permalink($schema_collection_id);
$schema_part_url = get_permalink($schema_part_id);
$schema_source_url = get_permalink($schema_source_id);
$schema_policy_url = get_permalink($schema_policy_id);
$schema_author_url = get_permalink($schema_author_id);
$schema_publisher_url = get_permalink($schema_publisher_id);
$schema_contributor_url = get_permalink($schema_contributor_id);
$schema_reviewer_url = get_permalink($schema_reviewer_id);
$schema_about_url = get_permalink($schema_about_id);
$schema_main_entity_url = get_permalink($schema_main_entity_id);
$schema_main_entity_page_url = get_permalink($schema_main_entity_page_id);
$schema_main_entity_link_page_url = get_permalink($schema_main_entity_link_page_id);
$schema_mentions_url = get_permalink($schema_mentions_id);
$schema_subject_url = get_permalink($schema_subject_id);
$schema_citation_url = get_permalink($schema_citation_id);
$amp_url = get_permalink($amp_id);
$preloaded_document_url = get_permalink($preloaded_document_id);
$protocol_child_url = preg_replace('/^https?:/', '', $child_url);
$rest_route_url = '/?rest_route=/wp/v2/posts';
$feed_query_url = '/?feed=rss2';
$oembed_query_url = '/?oembed=true&url=' . rawurlencode($child_url);
$semicolon_refresh_query = 'jump=one;two';
$static_content = '<p id="section">Static smoke page.</p>'
	. '<base href="' . esc_url(home_url('/')) . '">'
	. '<p><a class="first-post-link" href="' . esc_url($first_post_url) . '">First post</a></p>'
	. '<p><a class="second-post-link" href="' . esc_url($second_post_url) . '">Second post</a></p>'
	. '<p><a class="about-page-link" href="' . esc_url($about_page_url) . '">About export</a></p>'
	. '<p><a class="child-link" href="' . esc_url($child_url) . '">Child</a></p>'
	. '<p><a class="deferred-link" data-href="' . esc_url($deferred_url) . '">Deferred</a></p>'
	. '<p><button data-href="' . esc_url($asset_url . '?deferred=1') . '">Deferred asset</button></p>'
	. '<p><a class="generic-data-url" data-url="' . esc_url($child_url) . '">Generic data URL</a></p>'
	. '<p><button data-link="' . esc_url($asset_url . '?data-link=1') . '">Generic data asset</button></p>'
	. '<p><img class="wp-image-metadata" data-permalink="' . esc_url($image_metadata_url) . '"'
	. ' data-orig-file="' . esc_url($asset_url . '?orig=1') . '"'
	. ' data-medium-file="' . esc_url($asset_url . '?medium=1') . '"'
	. ' data-large-file="' . esc_url($asset_url . '?large=1') . '" alt=""></p>'
	. '<p><a class="ping-link" href="' . esc_url($child_url) . '" ping="/click-ping/ /wp-json/ping">Ping</a></p>'
	. '<blockquote cite="' . esc_url($citation_url) . '"><p>Cited source.</p></blockquote>'
	. '<p><q cite="' . esc_url($citation_url . '#quote') . '">Quoted source.</q></p>'
	. '<p><cite cite="' . esc_url($citation_url . '#inline') . '">Inline citation</cite></p>'
	. '<p><del cite="' . esc_url($citation_url . '#deleted') . '">Deleted citation</del></p>'
	. '<p><ins cite="' . esc_url($citation_url . '#inserted') . '">Inserted citation</ins></p>'
	. '<p><a class="relative-child-link" href="relative-child/">Relative child</a></p>'
	. '<p><img class="relative-parent-asset" src="../wp-content/uploads/ssgwp-smoke-asset.txt?relative=1" alt=""></p>'
	. '<table background="' . esc_url($asset_url . '?table-bg=1') . '"><tr>'
	. '<td background="' . esc_url($asset_url . '?cell-bg=1') . '">Legacy background</td>'
	. '</tr></table>'
	. '<form class="form-links" action="' . esc_url($form_target_url) . '">'
	. '<button formaction="' . esc_url($form_button_url) . '">Button</button>'
	. '<input type="submit" formaction="' . esc_url($form_input_url) . '">'
	. '</form>'
	. '<p><a class="comments-link" href="' . esc_url($comments_url) . '">Comments</a></p>'
	. '<p><a class="self-link" href="/static-page/#section">Self</a></p>'
	. '<p><a class="rest-route-link" href="' . esc_url($rest_route_url) . '">REST</a></p>'
	. '<p><a class="feed-query-link" href="' . esc_url($feed_query_url) . '">Feed query</a></p>'
	. '<p><a class="oembed-query-link" href="' . esc_url($oembed_query_url) . '">oEmbed query</a></p>'
	. '<link rel="alternate" type="application/json+oembed" href="' . esc_url($oembed_query_url) . '">'
	. '<meta http-equiv="refresh" content="0; url=\\''
	. esc_url('/static-page/?' . $semicolon_refresh_query . '#section')
	. '\\'; foo=bar">'
	. '<meta property="og:url" content="' . esc_url($child_url . '#meta') . '">'
	. '<meta property="al:web:url" content="' . esc_url($child_url) . '">'
	. '<meta property="og:image" content="' . esc_url($asset_url . '?meta=1') . '">'
	. '<meta property="og:audio" content="' . esc_url($asset_url . '?audio=1') . '">'
	. '<meta property="og:video" content="' . esc_url($asset_url . '?video=1') . '">'
	. '<meta name="msapplication-TileImage" content="' . esc_url($asset_url . '?tile=1') . '">'
	. '<meta name="msapplication-square70x70logo" content="' . esc_url($asset_url . '?tile-small=1') . '">'
	. '<meta name="msapplication-wide310x150logo" content="' . esc_url($asset_url . '?tile-wide=1') . '">'
	. '<meta name="msapplication-config" content="' . esc_url($browserconfig_url) . '">'
	. '<meta name="msapplication-starturl" content="' . esc_url($start_url) . '">'
	. '<meta name="msapplication-task" content="name=Docs;action-uri=' . esc_url($task_target_url) . ';icon-uri=' . esc_url($asset_url . '?task=1') . '">'
	. '<meta itemprop="contentUrl" content="' . esc_url($asset_url . '?schema=1') . '">'
	. '<meta itemprop="embedUrl" content="' . esc_url($child_url) . '">'
	. '<meta property="article:author" content="' . esc_url($child_url) . '">'
	. '<meta property="article:publisher" content="' . esc_url(get_permalink($parent_id)) . '">'
	. '<meta property="og:see_also" content="' . esc_url($child_url) . '">'
	. '<meta name="twitter:player" content="' . esc_url($child_url) . '">'
	. '<meta name="twitter:player:stream" content="' . esc_url($asset_url . '?stream=1') . '">'
	. '<meta itemprop="citation" content="' . esc_url($citation_url) . '">'
	. '<meta itemprop="sameAs" content="' . esc_url($schema_profile_url) . '">'
	. '<meta itemprop="mentions" content="' . esc_url($schema_mentions_url) . '">'
	. '<meta itemprop="license" content="' . esc_url($schema_license_url) . '">'
	. '<meta itemprop="item" content="' . esc_url($schema_breadcrumb_url) . '">'
	. '<meta itemprop="isPartOf" content="' . esc_url($schema_collection_url) . '">'
	. '<meta itemprop="isBasedOnUrl" content="' . esc_url($schema_source_url) . '">'
	. '<meta itemprop="url sameAs" content="' . esc_url($schema_profile_url) . '">'
	. '<meta itemprop="image thumbnailUrl" content="' . esc_url($asset_url . '?schema-token=1') . '">'
	. '<link itemprop="url sameAs" href="' . esc_url($microdata_profile_url) . '">'
	. '<link itemprop="about" href="' . esc_url($schema_about_url) . '">'
	. '<link itemprop="relatedLink" href="' . esc_url($microdata_related_url) . '">'
	. '<link itemprop="item" href="' . esc_url($microdata_breadcrumb_url) . '">'
	. '<link itemprop="hasPart" href="' . esc_url($schema_part_url) . '">'
	. '<link itemprop="publishingPrinciples" href="' . esc_url($schema_policy_url) . '">'
	. '<link itemprop="mainEntity" href="' . esc_url($schema_main_entity_url) . '">'
	. '<link itemprop="mainEntityOfPage" href="' . esc_url($schema_main_entity_link_page_url) . '">'
	. '<link itemprop="significantLinks" href="' . esc_url($microdata_significant_url) . '">'
	. '<link itemprop="acquireLicensePage" href="' . esc_url($microdata_license_url) . '">'
	. '<link itemprop="author" href="' . esc_url($schema_author_url) . '">'
	. '<link itemprop="citation" href="' . esc_url($citation_url) . '">'
	. '<meta itemprop="publisher" content="' . esc_url($schema_publisher_url) . '">'
	. '<link itemprop="contributor" href="' . esc_url($schema_contributor_url) . '">'
	. '<meta itemprop="reviewedBy" content="' . esc_url($schema_reviewer_url) . '">'
	. '<meta itemprop="subjectOf" content="' . esc_url($schema_subject_url) . '">'
	. '<meta itemprop="mainEntityOfPage" content="' . esc_url($schema_main_entity_page_url) . '">'
	. '<link itemprop="citation" href="' . esc_url($schema_citation_url) . '">'
	. '<link itemprop="contentUrl" href="' . esc_url($asset_url . '?schema-link=1') . '">'
	. '<article itemscope itemid="' . esc_url($microdata_item_url) . '" itemtype="'
	. esc_url($microdata_type_url) . ' https://schema.org/Article '
	. esc_url($microdata_secondary_type_url) . '">Microdata item</article>'
	. '<article about="' . esc_url($rdfa_about_url) . '" resource="' . esc_url($rdfa_resource_url) . '">RDFa item</article>'
	. '<section vocab="' . esc_url($rdfa_vocab_url) . '" typeof="schema:Thing">RDFa vocab</section>'
	. '<span vocab="https://schema.org/">External RDFa vocab</span>'
	. '<span about="[schema:Thing]" resource="_:local">RDFa CURIE</span>'
	. '<svg><a xlink:href="' . esc_url($svg_link_url) . '"><text>SVG link</text></a></svg>'
	. '<link rel="about" href="' . esc_url($link_rel_about_url) . '">'
	. '<link rel="copyright" href="' . esc_url($link_rel_copyright_url) . '">'
	. '<link rel="glossary" href="' . esc_url($link_rel_glossary_url) . '">'
	. '<link rel="payment" href="' . esc_url($link_rel_payment_url) . '">'
	. '<link rel="me" href="' . esc_url($schema_profile_url) . '">'
	. '<link rel="profile" href="' . esc_url($schema_profile_url) . '">'
	. '<head profile="' . esc_url($schema_profile_url) . '"></head>'
	. '<link rel="amphtml" href="' . esc_url($amp_url) . '">'
	. '<link rel="manifest" href="' . esc_url($manifest_url) . '">'
	. '<link rel="stylesheet" href="' . esc_url($sourcemap_css_url) . '">'
	. '<link rel="preload" as="document" href="' . esc_url($preloaded_document_url) . '">'
	. '<link rel="preload" as="fetch" href="' . esc_url($player_config_url) . '">'
	. '<link rel="preload" as="image" href="' . esc_url($asset_url) . '" imagesrcset="' . esc_url($asset_url) . ' 1x, ' . esc_url($asset_url . '?preload=2x') . ' 2x">'
	. '<video><track kind="captions" src="' . esc_url($captions_url . '?track=1') . '"></video>'
	. '<p><img class="asset-link" src="' . esc_url($asset_url) . '" alt=""></p>'
	. '<p><img class="longdesc-link" src="' . esc_url($asset_url . '?longdesc=1') . '" longdesc="' . esc_url($child_url) . '" alt=""></p>'
	. '<p><img class="svg-filter" src="' . esc_url($filter_svg_url) . '" alt=""></p>'
	. '<p><img class="mixed-srcset" srcset="data:image/gif;base64,R0lGODlhAQABAAAAACw= 1x, ' . esc_url($asset_url . '?mixed=2x') . ' 2x" alt=""></p>'
	. '<object data="' . esc_url($child_url) . '"></object>'
	. '<object data="' . esc_url($asset_url . '?object=1') . '"></object>'
	. '<object class="param-links"><param name="movie" value="' . esc_url($asset_url . '?param=1') . '"><param name="url" value="' . esc_url($child_url) . '"></object>'
	. '<iframe src="' . esc_url($embed_url) . '"></iframe>'
	. '<iframe class="longdesc-frame" src="' . esc_url($embed_url) . '" longdesc="' . esc_url($child_url) . '"></iframe>'
	. '<frame src="' . esc_url($embed_url) . '" longdesc="' . esc_url($child_url) . '">'
	. '<iframe data-src="' . esc_url($child_url) . '" data-lazy-src="' . esc_url($asset_url . '?lazy-frame=1') . '"></iframe>'
	. '<embed src="' . esc_url($embed_url) . '">'
	. '<embed src="' . esc_url($asset_url . '?embed=1') . '">'
	. '<embed data-src="' . esc_url($embed_url) . '" data-lazy-src="' . esc_url($asset_url . '?lazy-embed=1') . '">'
	. '<style>.hero{background-image:url("' . esc_url($asset_url) . '")}</style>'
	. '<style>.responsive{background-image:image-set("' . esc_url($asset_url . '?image-set=1') . '" 1x, type("text/plain"))}</style>'
	. '<iframe srcdoc="' . esc_attr(
		'<a href="' . esc_url($child_url) . '">Srcdoc child</a>'
		. '<img src="' . esc_url($asset_url . '?srcdoc=1') . '" alt="">'
		. '<script type="application/json">{"srcdocPage":"./relative-child/",'
			. '"srcdocEscaped":".\\/relative-child\\/",'
			. '"srcdocAsset":"../wp-content/uploads/ssgwp-smoke-asset.txt?srcdoc-script=1"}</script>'
	) . '"></iframe>'
	. '<script type="application/json">{"root":"\/parent-page\/child-page\/","rootAsset":"\/wp-content\/uploads\/ssgwp-smoke-asset.txt?root=1","plainRoot":"/static-page/","plainAsset":"/wp-content/uploads/ssgwp-smoke-asset.txt?plain=1"}</script>'
	. '<script type="application/json">{"protocolChild":"' . esc_url($protocol_child_url) . '","protocolEscaped":"' . str_replace('/', '\/', $protocol_child_url) . '"}</script>'
	. '<script type="application/json">{"relativePage":"./relative-child/","relativeEscaped":".\\/relative-child\\/","relativeAsset":"../wp-content/uploads/ssgwp-smoke-asset.txt?relative-script=1"}</script>'
	. '<script type="application/json">{"rest":"' . str_replace('/', '\/', esc_url($rest_route_url)) . '"}</script>'
	. '<script type="application/json">{"feedQuery":"' . str_replace('/', '\/', esc_url($feed_query_url)) . '"}</script>'
	. '<script type="application/json">{"oembedQuery":"' . str_replace('/', '\/', esc_url($oembed_query_url)) . '"}</script>'
	. '<script type="application/json">{"absoluteWildcard":"https:\/\/example.test\/wp-content\/uploads\/*","protocolWildcard":"\/\/example.test\/wp-content\/uploads\/*","absoluteTemplate":"https:\/\/example.test\/static-page\/{id}\/"}</script>'
	. '<script type="application/json">{"child":"' . esc_url($child_url) . '"}</script>';

$static_id = wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Static Page',
	'post_name' => 'static-page',
	'post_content' => $static_content,
));

wp_insert_post(array(
	'post_type' => 'page',
	'post_status' => 'publish',
	'post_title' => 'Relative Child',
	'post_name' => 'relative-child',
	'post_parent' => $static_id,
	'post_content' => '<p>Document-relative export target.</p>',
));

$exporter = new SSGWP_Static_Exporter();
$result = $exporter->export_to_directory('/exports/site', array(
	'url_mode' => 'relative',
	'max_pages' => 90,
	'copy_uploads' => true,
	'copy_theme' => true,
	'copy_plugins' => false,
	'copy_core_assets' => true,
	'crawl_links' => true,
	'fetch_mode' => 'internal',
));

if (!empty($result['warnings'])) {
	error_log(implode("\\n", $result['warnings']));
	throw new Exception('Static export completed with warnings.');
}

if ((int) $result['pages_exported'] < 5) {
	throw new Exception('Expected at least five exported pages.');
}

$scoped_home = 'https://playground.wordpress.net/scope:sad-quiet-school';

add_filter('home_url', function($url, $path) use ($scoped_home) {
	return trailingslashit($scoped_home) . ltrim($path, '/');
}, 10, 2);

add_filter('site_url', function($url, $path) use ($scoped_home) {
	return trailingslashit($scoped_home) . ltrim($path, '/');
}, 10, 2);

add_filter('content_url', function($url, $path) use ($scoped_home) {
	return trailingslashit($scoped_home) . 'wp-content/' . ltrim($path, '/');
}, 10, 2);

add_filter('includes_url', function($url, $path) use ($scoped_home) {
	return trailingslashit($scoped_home) . 'wp-includes/' . ltrim($path, '/');
}, 10, 2);

$scoped_child_url = get_permalink($child_id);
$scoped_first_post_url = get_permalink($first_post_id);
$scoped_second_post_url = get_permalink($second_post_id);
$scoped_about_page_url = get_permalink($about_page_id);
$scoped_comments_url = get_permalink($comments_id);
$scoped_embed_url = get_permalink($embed_id);
$scoped_deferred_url = get_permalink($deferred_id);
$scoped_citation_url = get_permalink($citation_id);
$scoped_form_target_url = get_permalink($form_target_id);
$scoped_form_button_url = get_permalink($form_button_id);
$scoped_form_input_url = get_permalink($form_input_id);
$scoped_task_target_url = get_permalink($task_target_id);
$scoped_start_url = get_permalink($start_url_id);
$scoped_link_rel_about_url = get_permalink($link_rel_about_id);
$scoped_link_rel_copyright_url = get_permalink($link_rel_copyright_id);
$scoped_link_rel_glossary_url = get_permalink($link_rel_glossary_id);
$scoped_link_rel_payment_url = get_permalink($link_rel_payment_id);
$scoped_microdata_profile_url = get_permalink($microdata_profile_id);
$scoped_microdata_significant_url = get_permalink($microdata_significant_id);
$scoped_microdata_license_url = get_permalink($microdata_license_id);
$scoped_microdata_related_url = get_permalink($microdata_related_id);
$scoped_microdata_breadcrumb_url = get_permalink($microdata_breadcrumb_id);
$scoped_microdata_item_url = get_permalink($microdata_item_id);
$scoped_microdata_type_url = get_permalink($microdata_type_id);
$scoped_microdata_secondary_type_url = get_permalink($microdata_secondary_type_id);
$scoped_rdfa_about_url = get_permalink($rdfa_about_id);
$scoped_rdfa_resource_url = get_permalink($rdfa_resource_id);
$scoped_rdfa_vocab_url = get_permalink($rdfa_vocab_id);
$scoped_svg_link_url = get_permalink($svg_link_id);
$scoped_image_metadata_url = get_permalink($image_metadata_id);
$scoped_schema_profile_url = get_permalink($schema_profile_id);
$scoped_schema_license_url = get_permalink($schema_license_id);
$scoped_schema_breadcrumb_url = get_permalink($schema_breadcrumb_id);
$scoped_schema_collection_url = get_permalink($schema_collection_id);
$scoped_schema_part_url = get_permalink($schema_part_id);
$scoped_schema_source_url = get_permalink($schema_source_id);
$scoped_schema_policy_url = get_permalink($schema_policy_id);
$scoped_schema_author_url = get_permalink($schema_author_id);
$scoped_schema_publisher_url = get_permalink($schema_publisher_id);
$scoped_schema_contributor_url = get_permalink($schema_contributor_id);
$scoped_schema_reviewer_url = get_permalink($schema_reviewer_id);
$scoped_schema_about_url = get_permalink($schema_about_id);
$scoped_schema_main_entity_url = get_permalink($schema_main_entity_id);
$scoped_schema_main_entity_page_url = get_permalink($schema_main_entity_page_id);
$scoped_schema_main_entity_link_page_url = get_permalink($schema_main_entity_link_page_id);
$scoped_schema_mentions_url = get_permalink($schema_mentions_id);
$scoped_schema_subject_url = get_permalink($schema_subject_id);
$scoped_schema_citation_url = get_permalink($schema_citation_id);
$scoped_amp_url = get_permalink($amp_id);
$scoped_preloaded_document_url = get_permalink($preloaded_document_id);
$scoped_protocol_child_url = preg_replace('/^https?:/', '', $scoped_child_url);
$scoped_rest_route_url = home_url('/?rest_route=/wp/v2/posts');
$scoped_feed_query_url = home_url('/?feed=rss2');
$scoped_oembed_query_url = home_url('/?oembed=true&url=' . rawurlencode($scoped_child_url));
$scoped_semicolon_refresh_query = 'jump=one;two';
$scoped_asset_url = trailingslashit(content_url('uploads')) . 'ssgwp-smoke-asset.txt';
$scoped_captions_url = trailingslashit(content_url('uploads')) . 'ssgwp-smoke-captions.vtt';
$scoped_manifest_url = content_url('plugins/ssgwp-smoke-deps/manifest.json');
$scoped_sourcemap_css_url = content_url('plugins/ssgwp-smoke-deps/app.css');
$scoped_filter_svg_url = content_url('plugins/ssgwp-smoke-deps/filter.svg');
$scoped_browserconfig_url = content_url('plugins/ssgwp-smoke-deps/browserconfig.xml');
$scoped_player_config_url = content_url('plugins/ssgwp-smoke-deps/player.json');
$scoped_child_path = wp_parse_url($scoped_child_url, PHP_URL_PATH);
$scoped_asset_path = wp_parse_url($scoped_asset_url, PHP_URL_PATH);
$scoped_static_content = '<p id="section">Static smoke page.</p>'
	. '<base href="' . esc_url(home_url('/')) . '">'
	. '<p><a class="first-post-link" href="' . esc_url($scoped_first_post_url) . '">First post</a></p>'
	. '<p><a class="second-post-link" href="' . esc_url($scoped_second_post_url) . '">Second post</a></p>'
	. '<p><a class="about-page-link" href="' . esc_url($scoped_about_page_url) . '">About export</a></p>'
	. '<p><a class="child-link" href="' . esc_url($scoped_child_url) . '">Child</a></p>'
	. '<p><a class="deferred-link" data-href="' . esc_url($scoped_deferred_url) . '">Deferred</a></p>'
	. '<p><button data-href="' . esc_url($scoped_asset_url . '?deferred=1') . '">Deferred asset</button></p>'
	. '<p><a class="generic-data-url" data-url="' . esc_url($scoped_child_url) . '">Generic data URL</a></p>'
	. '<p><button data-link="' . esc_url($scoped_asset_url . '?data-link=1') . '">Generic data asset</button></p>'
	. '<p><img class="wp-image-metadata" data-permalink="' . esc_url($scoped_image_metadata_url) . '"'
	. ' data-orig-file="' . esc_url($scoped_asset_url . '?orig=1') . '"'
	. ' data-medium-file="' . esc_url($scoped_asset_url . '?medium=1') . '"'
	. ' data-large-file="' . esc_url($scoped_asset_url . '?large=1') . '" alt=""></p>'
	. '<p><a class="ping-link" href="' . esc_url($scoped_child_url) . '" ping="/click-ping/ /wp-json/ping">Ping</a></p>'
	. '<blockquote cite="' . esc_url($scoped_citation_url) . '"><p>Cited source.</p></blockquote>'
	. '<p><q cite="' . esc_url($scoped_citation_url . '#quote') . '">Quoted source.</q></p>'
	. '<p><cite cite="' . esc_url($scoped_citation_url . '#inline') . '">Inline citation</cite></p>'
	. '<p><del cite="' . esc_url($scoped_citation_url . '#deleted') . '">Deleted citation</del></p>'
	. '<p><ins cite="' . esc_url($scoped_citation_url . '#inserted') . '">Inserted citation</ins></p>'
	. '<p><a class="relative-child-link" href="relative-child/">Relative child</a></p>'
	. '<p><img class="relative-parent-asset" src="../wp-content/uploads/ssgwp-smoke-asset.txt?relative=1" alt=""></p>'
	. '<table background="' . esc_url($scoped_asset_url . '?table-bg=1') . '"><tr>'
	. '<td background="' . esc_url($scoped_asset_url . '?cell-bg=1') . '">Legacy background</td>'
	. '</tr></table>'
	. '<form class="form-links" action="' . esc_url($scoped_form_target_url) . '">'
	. '<button formaction="' . esc_url($scoped_form_button_url) . '">Button</button>'
	. '<input type="submit" formaction="' . esc_url($scoped_form_input_url) . '">'
	. '</form>'
	. '<p><a class="comments-link" href="' . esc_url($scoped_comments_url) . '">Comments</a></p>'
	. '<p><a class="self-link" href="' . esc_url(home_url('/static-page/#section')) . '">Self</a></p>'
	. '<p><a class="rest-route-link" href="' . esc_url($scoped_rest_route_url) . '">REST</a></p>'
	. '<p><a class="feed-query-link" href="' . esc_url($scoped_feed_query_url) . '">Feed query</a></p>'
	. '<p><a class="oembed-query-link" href="' . esc_url($scoped_oembed_query_url) . '">oEmbed query</a></p>'
	. '<link rel="alternate" type="application/json+oembed" href="' . esc_url($scoped_oembed_query_url) . '">'
	. '<meta http-equiv="refresh" content="0; url=\\''
	. esc_url(home_url('/static-page/?' . $scoped_semicolon_refresh_query . '#section'))
	. '\\'; foo=bar">'
	. '<meta property="og:url" content="' . esc_url($scoped_child_url . '#meta') . '">'
	. '<meta property="al:web:url" content="' . esc_url($scoped_child_url) . '">'
	. '<meta name="twitter:image" content="' . esc_url($scoped_asset_url . '?meta=1') . '">'
	. '<meta property="og:audio:secure_url" content="' . esc_url($scoped_asset_url . '?audio=1') . '">'
	. '<meta property="og:video:secure_url" content="' . esc_url($scoped_asset_url . '?video=1') . '">'
	. '<meta name="msapplication-TileImage" content="' . esc_url($scoped_asset_url . '?tile=1') . '">'
	. '<meta name="msapplication-square70x70logo" content="' . esc_url($scoped_asset_url . '?tile-small=1') . '">'
	. '<meta name="msapplication-wide310x150logo" content="' . esc_url($scoped_asset_url . '?tile-wide=1') . '">'
	. '<meta name="msapplication-config" content="' . esc_url($scoped_browserconfig_url) . '">'
	. '<meta name="msapplication-starturl" content="' . esc_url($scoped_start_url) . '">'
	. '<meta name="msapplication-task" content="name=Docs;action-uri=' . esc_url($scoped_task_target_url) . ';icon-uri=' . esc_url($scoped_asset_url . '?task=1') . '">'
	. '<meta itemprop="contentUrl" content="' . esc_url($scoped_asset_url . '?schema=1') . '">'
	. '<meta itemprop="embedUrl" content="' . esc_url($scoped_child_url) . '">'
	. '<meta property="article:author" content="' . esc_url($scoped_child_url) . '">'
	. '<meta property="article:publisher" content="' . esc_url(get_permalink($parent_id)) . '">'
	. '<meta property="og:see_also" content="' . esc_url($scoped_child_url) . '">'
	. '<meta name="twitter:player" content="' . esc_url($scoped_child_url) . '">'
	. '<meta name="twitter:player:stream" content="' . esc_url($scoped_asset_url . '?stream=1') . '">'
	. '<meta itemprop="citation" content="' . esc_url($scoped_citation_url) . '">'
	. '<meta itemprop="sameAs" content="' . esc_url($scoped_schema_profile_url) . '">'
	. '<meta itemprop="mentions" content="' . esc_url($scoped_schema_mentions_url) . '">'
	. '<meta itemprop="license" content="' . esc_url($scoped_schema_license_url) . '">'
	. '<meta itemprop="item" content="' . esc_url($scoped_schema_breadcrumb_url) . '">'
	. '<meta itemprop="isPartOf" content="' . esc_url($scoped_schema_collection_url) . '">'
	. '<meta itemprop="isBasedOnUrl" content="' . esc_url($scoped_schema_source_url) . '">'
	. '<meta itemprop="url sameAs" content="' . esc_url($scoped_schema_profile_url) . '">'
	. '<meta itemprop="image thumbnailUrl" content="' . esc_url($scoped_asset_url . '?schema-token=1') . '">'
	. '<link itemprop="url sameAs" href="' . esc_url($scoped_microdata_profile_url) . '">'
	. '<link itemprop="about" href="' . esc_url($scoped_schema_about_url) . '">'
	. '<link itemprop="relatedLink" href="' . esc_url($scoped_microdata_related_url) . '">'
	. '<link itemprop="item" href="' . esc_url($scoped_microdata_breadcrumb_url) . '">'
	. '<link itemprop="hasPart" href="' . esc_url($scoped_schema_part_url) . '">'
	. '<link itemprop="publishingPrinciples" href="' . esc_url($scoped_schema_policy_url) . '">'
	. '<link itemprop="mainEntity" href="' . esc_url($scoped_schema_main_entity_url) . '">'
	. '<link itemprop="mainEntityOfPage" href="' . esc_url($scoped_schema_main_entity_link_page_url) . '">'
	. '<link itemprop="significantLinks" href="' . esc_url($scoped_microdata_significant_url) . '">'
	. '<link itemprop="acquireLicensePage" href="' . esc_url($scoped_microdata_license_url) . '">'
	. '<link itemprop="author" href="' . esc_url($scoped_schema_author_url) . '">'
	. '<link itemprop="citation" href="' . esc_url($scoped_citation_url) . '">'
	. '<meta itemprop="publisher" content="' . esc_url($scoped_schema_publisher_url) . '">'
	. '<link itemprop="contributor" href="' . esc_url($scoped_schema_contributor_url) . '">'
	. '<meta itemprop="reviewedBy" content="' . esc_url($scoped_schema_reviewer_url) . '">'
	. '<meta itemprop="subjectOf" content="' . esc_url($scoped_schema_subject_url) . '">'
	. '<meta itemprop="mainEntityOfPage" content="' . esc_url($scoped_schema_main_entity_page_url) . '">'
	. '<link itemprop="citation" href="' . esc_url($scoped_schema_citation_url) . '">'
	. '<link itemprop="contentUrl" href="' . esc_url($scoped_asset_url . '?schema-link=1') . '">'
	. '<article itemscope itemid="' . esc_url($scoped_microdata_item_url) . '" itemtype="'
	. esc_url($scoped_microdata_type_url) . ' https://schema.org/Article '
	. esc_url($scoped_microdata_secondary_type_url) . '">Microdata item</article>'
	. '<article about="' . esc_url($scoped_rdfa_about_url) . '" resource="' . esc_url($scoped_rdfa_resource_url) . '">RDFa item</article>'
	. '<section vocab="' . esc_url($scoped_rdfa_vocab_url) . '" typeof="schema:Thing">RDFa vocab</section>'
	. '<span vocab="https://schema.org/">External RDFa vocab</span>'
	. '<span about="[schema:Thing]" resource="_:local">RDFa CURIE</span>'
	. '<svg><a xlink:href="' . esc_url($scoped_svg_link_url) . '"><text>SVG link</text></a></svg>'
	. '<link rel="about" href="' . esc_url($scoped_link_rel_about_url) . '">'
	. '<link rel="copyright" href="' . esc_url($scoped_link_rel_copyright_url) . '">'
	. '<link rel="glossary" href="' . esc_url($scoped_link_rel_glossary_url) . '">'
	. '<link rel="payment" href="' . esc_url($scoped_link_rel_payment_url) . '">'
	. '<link rel="me" href="' . esc_url($scoped_schema_profile_url) . '">'
	. '<link rel="profile" href="' . esc_url($scoped_schema_profile_url) . '">'
	. '<head profile="' . esc_url($scoped_schema_profile_url) . '"></head>'
	. '<link rel="amphtml" href="' . esc_url($scoped_amp_url) . '">'
	. '<link rel="manifest" href="' . esc_url($scoped_manifest_url) . '">'
	. '<link rel="stylesheet" href="' . esc_url($scoped_sourcemap_css_url) . '">'
	. '<link rel="preload" as="document" href="' . esc_url($scoped_preloaded_document_url) . '">'
	. '<link rel="preload" as="fetch" href="' . esc_url($scoped_player_config_url) . '">'
	. '<link rel="preload" as="image" href="' . esc_url($scoped_asset_url) . '" imagesrcset="' . esc_url($scoped_asset_url) . ' 1x, ' . esc_url($scoped_asset_url . '?preload=2x') . ' 2x">'
	. '<p><a class="other-scope-link" href="https://playground.wordpress.net/scope:other-site/static-page/">Other scope</a></p>'
	. '<video><track kind="captions" src="' . esc_url($scoped_captions_url . '?track=1') . '"></video>'
	. '<p><img class="asset-link" src="' . esc_url($scoped_asset_url) . '" alt=""></p>'
	. '<p><img class="longdesc-link" src="' . esc_url($scoped_asset_url . '?longdesc=1') . '" longdesc="' . esc_url($scoped_child_url) . '" alt=""></p>'
	. '<p><img class="svg-filter" src="' . esc_url($scoped_filter_svg_url) . '" alt=""></p>'
	. '<p><img class="mixed-srcset" srcset="data:image/gif;base64,R0lGODlhAQABAAAAACw= 1x, ' . esc_url($scoped_asset_url . '?mixed=2x') . ' 2x" alt=""></p>'
	. '<p><img class="other-scope-asset" src="https://playground.wordpress.net/scope:other-site/wp-content/uploads/asset.txt" alt=""></p>'
	. '<object data="' . esc_url($scoped_child_url) . '"></object>'
	. '<object data="' . esc_url($scoped_asset_url . '?object=1') . '"></object>'
	. '<object class="param-links"><param name="movie" value="' . esc_url($scoped_asset_url . '?param=1') . '"><param name="url" value="' . esc_url($scoped_child_url) . '"></object>'
	. '<iframe src="' . esc_url($scoped_embed_url) . '"></iframe>'
	. '<iframe class="longdesc-frame" src="' . esc_url($scoped_embed_url) . '" longdesc="' . esc_url($scoped_child_url) . '"></iframe>'
	. '<frame src="' . esc_url($scoped_embed_url) . '" longdesc="' . esc_url($scoped_child_url) . '">'
	. '<iframe data-src="' . esc_url($scoped_child_url) . '" data-lazy-src="' . esc_url($scoped_asset_url . '?lazy-frame=1') . '"></iframe>'
	. '<embed src="' . esc_url($scoped_embed_url) . '">'
	. '<embed src="' . esc_url($scoped_asset_url . '?embed=1') . '">'
	. '<embed data-src="' . esc_url($scoped_embed_url) . '" data-lazy-src="' . esc_url($scoped_asset_url . '?lazy-embed=1') . '">'
	. '<style>.hero{background-image:url("' . esc_url($scoped_asset_url) . '")}</style>'
	. '<style>.responsive{background-image:image-set("' . esc_url($scoped_asset_url . '?image-set=1') . '" 1x, type("text/plain"))}</style>'
	. '<iframe srcdoc="' . esc_attr(
		'<a href="' . esc_url($scoped_child_url) . '">Srcdoc child</a>'
		. '<img src="' . esc_url($scoped_asset_url . '?srcdoc=1') . '" alt="">'
		. '<script type="application/json">{"srcdocPage":"./relative-child/",'
			. '"srcdocEscaped":".\\/relative-child\\/",'
			. '"srcdocAsset":"../wp-content/uploads/ssgwp-smoke-asset.txt?srcdoc-script=1"}</script>'
	) . '"></iframe>'
	. '<script type="application/json">{"root":"' . str_replace('/', '\/', $scoped_child_path) . '","rootAsset":"' . str_replace('/', '\/', $scoped_asset_path) . '?root=1"}</script>'
	. '<script type="application/json">{"protocolChild":"' . esc_url($scoped_protocol_child_url) . '","protocolEscaped":"' . str_replace('/', '\/', $scoped_protocol_child_url) . '"}</script>'
	. '<script type="application/json">{"relativePage":"./relative-child/","relativeEscaped":".\\/relative-child\\/","relativeAsset":"../wp-content/uploads/ssgwp-smoke-asset.txt?relative-script=1"}</script>'
	. '<script type="application/json">{"plainRootAsset":"/wp-content/uploads/ssgwp-smoke-asset.txt?outside=1","plainRootAssetEscaped":"\/wp-content\/uploads\/ssgwp-smoke-asset.txt?outside=2"}</script>'
	. '<script type="application/json">{"rest":"' . str_replace('/', '\/', esc_url($scoped_rest_route_url)) . '"}</script>'
	. '<script type="application/json">{"feedQuery":"' . str_replace('/', '\/', esc_url($scoped_feed_query_url)) . '"}</script>'
	. '<script type="application/json">{"oembedQuery":"' . str_replace('/', '\/', esc_url($scoped_oembed_query_url)) . '"}</script>'
	. '<script type="application/json">{"absoluteWildcard":"'
	. str_replace('/', '\/', $scoped_home . '/wp-content/uploads/*')
	. '","protocolWildcard":"\/\/playground.wordpress.net\/scope:sad-quiet-school\/wp-content\/uploads\/*","absoluteTemplate":"'
	. str_replace('/', '\/', $scoped_home . '/static-page/{id}/')
	. '"}</script>'
	. '<script type="application/json">{"child":"' . esc_url($scoped_child_url) . '"}</script>';

wp_update_post(array(
	'ID' => $static_id,
	'post_content' => $scoped_static_content,
));

$scoped_result = $exporter->export_to_directory('/exports/scoped-site', array(
	'url_mode' => 'relative',
	'max_pages' => 90,
	'copy_uploads' => true,
	'copy_theme' => true,
	'copy_plugins' => false,
	'copy_core_assets' => true,
	'crawl_links' => true,
	'fetch_mode' => 'internal',
));

if (!empty($scoped_result['warnings'])) {
	error_log(implode("\\n", $scoped_result['warnings']));
	throw new Exception('Scoped static export completed with warnings.');
}

if ((int) $scoped_result['pages_exported'] < 5) {
	throw new Exception('Expected at least five scoped exported pages.');
}
`;
}

function runPlaygroundCli() {
	const cliBin = process.env.PLAYGROUND_CLI_BIN || 'npx';
	const cliPrefix = process.env.PLAYGROUND_CLI_BIN
		? []
		: ['--yes', '@wp-playground/cli@latest'];
	const args = [
		...cliPrefix,
		'run-blueprint',
		`--mount=${pluginDir}:/wordpress/wp-content/plugins/static-site-generator`,
		`--mount=${exportHostDir}:/exports`,
		`--blueprint=${blueprintPath}`,
		`--wp=${wpVersion}`,
		`--php=${phpVersion}`,
		'--verbosity=normal',
	];

	let result;

	for (let attempt = 1; attempt <= cliAttempts; attempt++) {
		result = spawnSync(cliBin, args, {
			cwd: repoRoot,
			encoding: 'utf8',
			stdio: 'pipe',
		});

		if (result.status === 0) {
			break;
		}

		if (attempt < cliAttempts && isRetryableCliFailure(result)) {
			console.error(`Playground CLI fetch failed; retrying (${attempt + 1}/${cliAttempts}).`);
			continue;
		}

		break;
	}

	if (!result || result.status !== 0) {
		throw new Error(
			[
				'Playground CLI smoke export failed.',
				`Command: ${cliBin} ${args.join(' ')}`,
				`Exit status: ${result && result.status !== null ? result.status : 'unknown'}`,
				`Signal: ${result && result.signal ? result.signal : 'none'}`,
				`Spawn error: ${result && result.error ? result.error.message : 'none'}`,
				`STDOUT:\n${result && result.stdout ? result.stdout : ''}`,
				`STDERR:\n${result && result.stderr ? result.stderr : ''}`,
			].join('\n')
		);
	}

	if (result.stderr.trim()) {
		console.error(result.stderr);
	}
}

function isRetryableCliFailure(result) {
	const output = `${result.stdout}\n${result.stderr}`;

	return /(?:fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN)/i.test(output);
}

async function verifyExport() {
	currentExportDir = exportDir;
	assertFile('index.html');
	assertFile('first-smoke-post/index.html');
	assertFile('second-smoke-post/index.html');
	assertFile('about-export/index.html');
	assertFile('static-page/index.html');
	assertFile(`static-page-${shortHash('jump=one%3Btwo')}.html`);
	assertFile('static-page/relative-child/index.html');
	assertFile('comments/index.html');
	assertFile('citation-source/index.html');
	assertFile('deferred-link/index.html');
	assertFile('embed-only/index.html');
	assertFile('form-button/index.html');
	assertFile('form-input/index.html');
	assertFile('form-target/index.html');
	assertFile('task-target/index.html');
	assertFile('start-url/index.html');
	assertFile('link-rel-about/index.html');
	assertFile('link-rel-copyright/index.html');
	assertFile('link-rel-glossary/index.html');
	assertFile('link-rel-payment/index.html');
	assertFile('microdata-profile/index.html');
	assertFile('microdata-related/index.html');
	assertFile('microdata-breadcrumb/index.html');
	assertFile('microdata-significant/index.html');
	assertFile('microdata-license/index.html');
	assertFile('microdata-item/index.html');
	assertFile('microdata-type/index.html');
	assertFile('microdata-secondary-type/index.html');
	assertFile('rdfa-about/index.html');
	assertFile('rdfa-resource/index.html');
	assertFile('rdfa-vocab/index.html');
	assertFile('svg-link/index.html');
	assertFile('image-metadata/index.html');
	assertFile('schema-profile/index.html');
	assertFile('schema-license/index.html');
	assertFile('schema-breadcrumb/index.html');
	assertFile('schema-collection/index.html');
	assertFile('schema-part/index.html');
	assertFile('schema-source/index.html');
	assertFile('publishing-principles/index.html');
	assertFile('schema-author/index.html');
	assertFile('schema-publisher/index.html');
	assertFile('schema-contributor/index.html');
	assertFile('schema-reviewer/index.html');
	assertFile('schema-about/index.html');
	assertFile('schema-main-entity/index.html');
	assertFile('schema-main-entity-page/index.html');
	assertFile('schema-main-entity-link-page/index.html');
	assertFile('schema-mentions/index.html');
	assertFile('schema-subject/index.html');
	assertFile('schema-citation/index.html');
	assertFile('amp-companion/index.html');
	assertFile('preloaded-document/index.html');
	assertFile('parent-page/index.html');
	assertFile('parent-page/child-page/index.html');
	assertFile('wp-content/themes/ssgwp-smoke-theme/theme-marker.css');
	assertFile('wp-content/uploads/ssgwp-smoke-asset.txt');
	assertFile('wp-content/uploads/ssgwp-smoke-captions.vtt');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/manifest.json');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/icon-192.png');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/icons/icon.png');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/browserconfig.xml');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/player.json');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/app.css');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/maps/app.css.map');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/captions.vtt');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/runtime.wasm');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/filter.svg');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/icons/filter.png');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/icons/tile-small.png');
	assertFile('static-export.json');
	assertDistinctSmokeContent();

	const staticPage = readText('static-page/index.html');
	const semicolonRefreshTarget = `../static-page-${shortHash('jump=one%3Btwo')}.html#section`;
	const expectedTargets = [
		'../first-smoke-post/index.html',
		'../second-smoke-post/index.html',
		'../about-export/index.html',
		'../parent-page/child-page/index.html',
		'../parent-page/child-page/index.html#meta',
		'../parent-page/index.html',
		'../comments/index.html',
		'../citation-source/index.html',
		'../citation-source/index.html#quote',
		'../citation-source/index.html#inline',
		'../citation-source/index.html#deleted',
		'../citation-source/index.html#inserted',
		'../deferred-link/index.html',
		'../embed-only/index.html',
		'../form-button/index.html',
		'../form-input/index.html',
		'../form-target/index.html',
		'../task-target/index.html',
		'../start-url/index.html',
		'../link-rel-about/index.html',
		'../link-rel-copyright/index.html',
		'../link-rel-glossary/index.html',
		'../link-rel-payment/index.html',
		'../microdata-profile/index.html',
		'../microdata-related/index.html',
		'../microdata-breadcrumb/index.html',
		'../microdata-significant/index.html',
		'../microdata-license/index.html',
		'../microdata-item/index.html',
		'../microdata-type/index.html',
		'../microdata-secondary-type/index.html',
		'../rdfa-about/index.html',
		'../rdfa-resource/index.html',
		'../rdfa-vocab/index.html',
		'../svg-link/index.html',
		'../image-metadata/index.html',
		'../schema-profile/index.html',
		'../schema-license/index.html',
		'../schema-breadcrumb/index.html',
		'../schema-collection/index.html',
		'../schema-part/index.html',
		'../schema-source/index.html',
		'../publishing-principles/index.html',
		'../schema-author/index.html',
		'../schema-publisher/index.html',
		'../schema-contributor/index.html',
		'../schema-reviewer/index.html',
		'../schema-about/index.html',
		'../schema-main-entity/index.html',
		'../schema-main-entity-page/index.html',
		'../schema-main-entity-link-page/index.html',
		'../schema-mentions/index.html',
		'../schema-subject/index.html',
		'../schema-citation/index.html',
		'../amp-companion/index.html',
		'../preloaded-document/index.html',
		'relative-child/index.html',
		'index.html#section',
		semicolonRefreshTarget,
		'../wp-content/uploads/ssgwp-smoke-asset.txt?meta=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?audio=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?video=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?deferred=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?data-link=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?orig=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?medium=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?large=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?tile=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?tile-small=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?tile-wide=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?task=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?schema=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?schema-token=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?schema-link=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?stream=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?root=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?plain=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?relative=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?relative-script=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?table-bg=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?cell-bg=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?longdesc=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?mixed=2x',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?image-set=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?embed=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?lazy-embed=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?object=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?param=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?lazy-frame=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?srcdoc=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?srcdoc-script=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt',
		'../wp-content/uploads/ssgwp-smoke-captions.vtt?track=1',
		'../wp-content/plugins/ssgwp-smoke-deps/manifest.json',
		'../wp-content/plugins/ssgwp-smoke-deps/browserconfig.xml',
		'../wp-content/plugins/ssgwp-smoke-deps/player.json',
		'../wp-content/plugins/ssgwp-smoke-deps/app.css',
		'../wp-content/plugins/ssgwp-smoke-deps/filter.svg',
	];

	for (const target of expectedTargets) {
		assertIncludes(staticPage, target, `static-page/index.html references ${target}`);
		assertStaticTargetExists('static-page/index.html', target);
	}

	assertIncludes(
		staticPage,
		'imagesrcset="../wp-content/uploads/ssgwp-smoke-asset.txt 1x, ../wp-content/uploads/ssgwp-smoke-asset.txt?preload=2x 2x"',
		'static-page/index.html rewrites responsive image preload srcset'
	);
	assertIncludes(
		staticPage,
		'<base href="./">',
		'static-page/index.html anchors same-site base hrefs to the static document'
	);
	assertIncludes(
		staticPage,
		`content="0; url=&#039;${semicolonRefreshTarget}&#039;; foo=bar"`,
		'static-page/index.html rewrites quoted meta refresh URLs with suffixes'
	);
	assertIncludes(
		staticPage,
		'<meta property="al:web:url" content="../parent-page/child-page/index.html">',
		'static-page/index.html rewrites App Links web fallback URLs'
	);
	assertIncludes(
		staticPage,
		'data-href="../deferred-link/index.html"',
		'static-page/index.html rewrites deferred page data-href attributes'
	);
	assertIncludes(
		staticPage,
		'data-href="../wp-content/uploads/ssgwp-smoke-asset.txt?deferred=1"',
		'static-page/index.html rewrites deferred asset data-href attributes'
	);
	assertIncludes(
		staticPage,
		'data-url="../parent-page/child-page/index.html"',
		'static-page/index.html rewrites generic data-url page attributes'
	);
	assertIncludes(
		staticPage,
		'data-link="../wp-content/uploads/ssgwp-smoke-asset.txt?data-link=1"',
		'static-page/index.html rewrites generic data-link asset attributes'
	);
	assertIncludes(
		staticPage,
		'data-permalink="../image-metadata/index.html"',
		'static-page/index.html rewrites WordPress image metadata permalink attributes'
	);
	assertIncludes(
		staticPage,
		'data-orig-file="../wp-content/uploads/ssgwp-smoke-asset.txt?orig=1"',
		'static-page/index.html rewrites WordPress original image metadata asset attributes'
	);
	assertIncludes(
		staticPage,
		'xlink:href="../svg-link/index.html"',
		'static-page/index.html rewrites SVG anchor xlink href page targets'
	);
	assertIncludes(
		staticPage,
		'itemid="../microdata-item/index.html"',
		'static-page/index.html rewrites microdata itemid page targets'
	);
	assertIncludes(
		staticPage,
		'itemtype="../microdata-type/index.html https://schema.org/Article ../microdata-secondary-type/index.html"',
		'static-page/index.html rewrites same-site microdata itemtype URL tokens'
	);
	assertIncludes(
		staticPage,
		'about="../rdfa-about/index.html" resource="../rdfa-resource/index.html"',
		'static-page/index.html rewrites RDFa page identifiers'
	);
	assertIncludes(
		staticPage,
		'vocab="../rdfa-vocab/index.html"',
		'static-page/index.html rewrites same-site RDFa vocab URLs'
	);
	assertIncludes(
		staticPage,
		'vocab="https://schema.org/"',
		'static-page/index.html preserves external RDFa vocab URLs'
	);
	assertIncludes(
		staticPage,
		'<link itemprop="author" href="../schema-author/index.html">',
		'static-page/index.html rewrites schema.org author links'
	);
	assertIncludes(
		staticPage,
		'<meta itemprop="citation" content="../citation-source/index.html">',
		'static-page/index.html rewrites schema.org citation metadata'
	);
	assertIncludes(
		staticPage,
		'<link itemprop="citation" href="../citation-source/index.html">',
		'static-page/index.html rewrites schema.org citation links'
	);
	assertIncludes(
		staticPage,
		'<link itemprop="item" href="../microdata-breadcrumb/index.html">',
		'static-page/index.html rewrites schema.org breadcrumb item links'
	);
	assertIncludes(
		staticPage,
		'<meta itemprop="item" content="../schema-breadcrumb/index.html">',
		'static-page/index.html rewrites schema.org breadcrumb item metadata'
	);
	assertIncludes(
		staticPage,
		'<meta itemprop="url sameAs" content="../schema-profile/index.html">',
		'static-page/index.html rewrites schema.org meta itemprop page token lists'
	);
	assertIncludes(
		staticPage,
		'<meta itemprop="image thumbnailUrl" content="../wp-content/uploads/ssgwp-smoke-asset.txt?schema-token=1">',
		'static-page/index.html rewrites schema.org meta itemprop asset token lists'
	);
	assertIncludes(
		staticPage,
		'<meta itemprop="isPartOf" content="../schema-collection/index.html">',
		'static-page/index.html rewrites schema.org isPartOf metadata'
	);
	assertIncludes(
		staticPage,
		'<link itemprop="hasPart" href="../schema-part/index.html">',
		'static-page/index.html rewrites schema.org hasPart links'
	);
	assertIncludes(
		staticPage,
		'<meta itemprop="isBasedOnUrl" content="../schema-source/index.html">',
		'static-page/index.html rewrites schema.org isBasedOnUrl metadata'
	);
	assertIncludes(
		staticPage,
		'<link itemprop="publishingPrinciples" href="../publishing-principles/index.html">',
		'static-page/index.html rewrites schema.org publishingPrinciples links'
	);
	assertIncludes(
		staticPage,
		'<meta itemprop="publisher" content="../schema-publisher/index.html">',
		'static-page/index.html rewrites schema.org publisher metadata'
	);
	assertIncludes(
		staticPage,
		'<link itemprop="contributor" href="../schema-contributor/index.html">',
		'static-page/index.html rewrites schema.org contributor links'
	);
	assertIncludes(
		staticPage,
		'<meta itemprop="reviewedBy" content="../schema-reviewer/index.html">',
		'static-page/index.html rewrites schema.org reviewedBy metadata'
	);
	assertIncludes(
		staticPage,
		'<link itemprop="about" href="../schema-about/index.html">',
		'static-page/index.html rewrites schema.org about links'
	);
	assertIncludes(
		staticPage,
		'<link itemprop="mainEntity" href="../schema-main-entity/index.html">',
		'static-page/index.html rewrites schema.org mainEntity links'
	);
	assertIncludes(
		staticPage,
		'<link itemprop="mainEntityOfPage" href="../schema-main-entity-link-page/index.html">',
		'static-page/index.html rewrites schema.org mainEntityOfPage links'
	);
	assertIncludes(
		staticPage,
		'<meta itemprop="mainEntityOfPage" content="../schema-main-entity-page/index.html">',
		'static-page/index.html rewrites schema.org mainEntityOfPage metadata'
	);
	assertIncludes(
		staticPage,
		'<meta itemprop="mentions" content="../schema-mentions/index.html">',
		'static-page/index.html rewrites schema.org mentions metadata'
	);
	assertIncludes(
		staticPage,
		'<meta itemprop="subjectOf" content="../schema-subject/index.html">',
		'static-page/index.html rewrites schema.org subjectOf metadata'
	);
	assertIncludes(
		staticPage,
		'<link itemprop="citation" href="../schema-citation/index.html">',
		'static-page/index.html rewrites schema.org citation links'
	);
	assertIncludes(
		staticPage,
		'about="[schema:Thing]" resource="_:local"',
		'static-page/index.html preserves RDFa CURIE values'
	);
	assertIncludes(
		staticPage,
		'<link rel="about" href="../link-rel-about/index.html">',
		'static-page/index.html rewrites rel=about document links'
	);
	assertIncludes(
		staticPage,
		'<link rel="copyright" href="../link-rel-copyright/index.html">',
		'static-page/index.html rewrites rel=copyright document links'
	);
	assertIncludes(
		staticPage,
		'<link rel="glossary" href="../link-rel-glossary/index.html">',
		'static-page/index.html rewrites rel=glossary document links'
	);
	assertIncludes(
		staticPage,
		'<link rel="payment" href="../link-rel-payment/index.html">',
		'static-page/index.html rewrites rel=payment document links'
	);
	assertIncludes(
		staticPage,
		'<link rel="me" href="../schema-profile/index.html">',
		'static-page/index.html rewrites rel=me identity links'
	);
	assertIncludes(
		staticPage,
		'<link rel="profile" href="../schema-profile/index.html">',
		'static-page/index.html rewrites profile link relations'
	);
	assertIncludes(
		staticPage,
		'profile="../schema-profile/index.html"',
		'static-page/index.html rewrites metadata profile attributes'
	);
	assertIncludes(
		staticPage,
		'class="ping-link" href="../parent-page/child-page/index.html" ping="/click-ping/ /wp-json/ping"',
		'static-page/index.html leaves ping URLs dynamic'
	);
	assertIncludes(
		staticPage,
		'<form class="form-links" action="../form-target/index.html">',
		'static-page/index.html rewrites form action page targets'
	);
	assertIncludes(
		staticPage,
		'<button formaction="../form-button/index.html">',
		'static-page/index.html rewrites button formaction page targets'
	);
	assertIncludes(
		staticPage,
		'<input type="submit" formaction="../form-input/index.html">',
		'static-page/index.html rewrites input formaction page targets'
	);
	assertIncludes(
		staticPage,
		'data="../parent-page/child-page/index.html"',
		'static-page/index.html rewrites object page sources'
	);
	assertIncludes(
		staticPage,
		'<iframe src="../embed-only/index.html"></iframe>',
		'static-page/index.html rewrites iframe src page sources'
	);
	assertIncludes(
		staticPage,
		'<iframe class="longdesc-frame" src="../embed-only/index.html" longdesc="../parent-page/child-page/index.html"></iframe>',
		'static-page/index.html rewrites iframe longdesc page sources'
	);
	assertIncludes(
		staticPage,
		'<frame src="../embed-only/index.html" longdesc="../parent-page/child-page/index.html">',
		'static-page/index.html rewrites legacy frame page sources'
	);
	assertIncludes(
		staticPage,
		'class="longdesc-link" src="../wp-content/uploads/ssgwp-smoke-asset.txt?longdesc=1" longdesc="../parent-page/child-page/index.html"',
		'static-page/index.html rewrites image longdesc page sources'
	);
	assertIncludes(
		staticPage,
		'<embed src="../embed-only/index.html">',
		'static-page/index.html rewrites embed page sources'
	);
	assertIncludes(
		staticPage,
		'<embed src="../wp-content/uploads/ssgwp-smoke-asset.txt?embed=1">',
		'static-page/index.html rewrites embed media sources'
	);
	assertIncludes(
		staticPage,
		'<embed data-src="../embed-only/index.html" data-lazy-src="../wp-content/uploads/ssgwp-smoke-asset.txt?lazy-embed=1">',
		'static-page/index.html rewrites lazy embed sources'
	);
	assertIncludes(
		staticPage,
		'data="../wp-content/uploads/ssgwp-smoke-asset.txt?object=1"',
		'static-page/index.html rewrites object media sources'
	);
	assertIncludes(
		staticPage,
		'<param name="movie" value="../wp-content/uploads/ssgwp-smoke-asset.txt?param=1">',
		'static-page/index.html rewrites media object param values'
	);
	assertIncludes(
		staticPage,
		'<param name="url" value="../parent-page/child-page/index.html">',
		'static-page/index.html rewrites page object param values'
	);
	assertIncludes(
		staticPage,
		'data-src="../parent-page/child-page/index.html"',
		'static-page/index.html rewrites lazy iframe page sources'
	);
	assertIncludes(
		staticPage,
		'data-lazy-src="../wp-content/uploads/ssgwp-smoke-asset.txt?lazy-frame=1"',
		'static-page/index.html rewrites lazy iframe media sources'
	);
	assertDoesNotInclude(staticPage, 'href="/static-page/"');
	assertDoesNotInclude(staticPage, '"root":"\\/parent-page\\/child-page\\/"');
	assertDoesNotInclude(staticPage, '"plainRoot":"/static-page/"');
	assertDoesNotInclude(staticPage, '"protocolChild":"//');
	assertDoesNotInclude(staticPage, '"protocolEscaped":"\\/\\/');
	assertDoesNotInclude(staticPage, '"relativePage":"./relative-child/"');
	assertIncludes(
		staticPage,
		'"relativePage":"relative-child/index.html"',
		'static-page/index.html rewrites document-relative script page URLs'
	);
	assertIncludes(
		staticPage,
		'"relativeEscaped":"relative-child/index.html"',
		'static-page/index.html rewrites normalized escaped document-relative script page URLs'
	);
	assertIncludes(
		staticPage,
		'"relativeAsset":"../wp-content/uploads/ssgwp-smoke-asset.txt?relative-script=1"',
		'static-page/index.html rewrites parent-relative script asset URLs'
	);
	assertDoesNotInclude(staticPage, '&quot;srcdocPage&quot;:&quot;./relative-child/&quot;');
	assertIncludes(
		staticPage,
		'&quot;srcdocPage&quot;:&quot;relative-child/index.html&quot;',
		'static-page/index.html rewrites srcdoc script page URLs'
	);
	assertIncludes(
		staticPage,
		'&quot;srcdocEscaped&quot;:&quot;relative-child/index.html&quot;',
		'static-page/index.html rewrites escaped srcdoc script page URLs'
	);
	assertIncludes(
		staticPage,
		'&quot;srcdocAsset&quot;:&quot;../wp-content/uploads/ssgwp-smoke-asset.txt?srcdoc-script=1&quot;',
		'static-page/index.html rewrites srcdoc script asset URLs'
	);
	assertIncludes(
		staticPage,
		'href="/?rest_route=/wp/v2/posts"',
		'static-page/index.html leaves query-based REST API links untouched'
	);
	assertIncludes(
		staticPage,
		'"rest":"/?rest_route=/wp/v2/posts"',
		'static-page/index.html leaves query-based REST API JSON URLs untouched'
	);
	assertIncludes(
		staticPage,
		'href="/?feed=rss2"',
		'static-page/index.html leaves query-based feed links untouched'
	);
	assertIncludes(
		staticPage,
		'"feedQuery":"/?feed=rss2"',
		'static-page/index.html leaves query-based feed JSON URLs untouched'
	);
	assertIncludes(
		staticPage,
		'class="oembed-query-link" href="/?oembed=true',
		'static-page/index.html leaves query-based oEmbed links untouched'
	);
	assertIncludes(
		staticPage,
		'"oembedQuery":"/?oembed=true',
		'static-page/index.html leaves query-based oEmbed JSON URLs untouched'
	);
	assertIncludes(
		staticPage,
		'"absoluteWildcard":"https://example.test/wp-content/uploads/*"',
		'static-page/index.html leaves absolute wildcard asset patterns untouched'
	);
	assertIncludes(
		staticPage,
		'"protocolWildcard":"//example.test/wp-content/uploads/*"',
		'static-page/index.html leaves protocol-relative wildcard asset patterns untouched'
	);
	assertIncludes(
		staticPage,
		'"absoluteTemplate":"https://example.test/static-page/{id}/"',
		'static-page/index.html leaves absolute templated page patterns untouched'
	);
	assertStaticTargetExists(
		'wp-content/plugins/ssgwp-smoke-deps/manifest.json',
		'icon-192.png'
	);
	assertStaticTargetExists(
		'wp-content/plugins/ssgwp-smoke-deps/manifest.json',
		'icons/icon.png'
	);
	assertStaticTargetExists(
		'wp-content/plugins/ssgwp-smoke-deps/browserconfig.xml',
		'icons/tile-small.png'
	);
	assertIncludes(
		readText('wp-content/plugins/ssgwp-smoke-deps/player.json'),
		'captions.vtt',
		'copied JSON player configs rewrite WebVTT caption references'
	);
	assertStaticTargetExists(
		'wp-content/plugins/ssgwp-smoke-deps/player.json',
		'captions.vtt'
	);
	assertIncludes(
		readText('wp-content/plugins/ssgwp-smoke-deps/player.json'),
		'runtime.wasm',
		'copied JSON player configs rewrite WebAssembly module references'
	);
	assertStaticTargetExists(
		'wp-content/plugins/ssgwp-smoke-deps/player.json',
		'runtime.wasm'
	);
	assertIncludes(
		readText('wp-content/plugins/ssgwp-smoke-deps/app.css'),
		'sourceMappingURL=maps/app.css.map',
		'copied CSS assets preserve source map references'
	);
	assertStaticTargetExists(
		'wp-content/plugins/ssgwp-smoke-deps/app.css',
		'maps/app.css.map'
	);
	assertIncludes(
		readText('wp-content/plugins/ssgwp-smoke-deps/filter.svg'),
		'icons/filter.png',
		'copied SVG assets rewrite filter image references'
	);
	assertStaticTargetExists(
		'wp-content/plugins/ssgwp-smoke-deps/filter.svg',
		'icons/filter.png'
	);
	await assertAllLocalResourceTargetsExist();
}

async function verifyScopedExport() {
	currentExportDir = scopedExportDir;

	assertFile('index.html');
	assertFile('first-smoke-post/index.html');
	assertFile('second-smoke-post/index.html');
	assertFile('about-export/index.html');
	assertFile('static-page/index.html');
	assertFile(`static-page-${shortHash('jump=one%3Btwo')}.html`);
	assertFile('static-page/relative-child/index.html');
	assertFile('comments/index.html');
	assertFile('citation-source/index.html');
	assertFile('deferred-link/index.html');
	assertFile('embed-only/index.html');
	assertFile('form-button/index.html');
	assertFile('form-input/index.html');
	assertFile('form-target/index.html');
	assertFile('task-target/index.html');
	assertFile('start-url/index.html');
	assertFile('link-rel-about/index.html');
	assertFile('link-rel-copyright/index.html');
	assertFile('link-rel-glossary/index.html');
	assertFile('link-rel-payment/index.html');
	assertFile('microdata-profile/index.html');
	assertFile('microdata-related/index.html');
	assertFile('microdata-breadcrumb/index.html');
	assertFile('microdata-significant/index.html');
	assertFile('microdata-license/index.html');
	assertFile('microdata-item/index.html');
	assertFile('microdata-type/index.html');
	assertFile('microdata-secondary-type/index.html');
	assertFile('rdfa-about/index.html');
	assertFile('rdfa-resource/index.html');
	assertFile('rdfa-vocab/index.html');
	assertFile('svg-link/index.html');
	assertFile('image-metadata/index.html');
	assertFile('schema-profile/index.html');
	assertFile('schema-license/index.html');
	assertFile('schema-breadcrumb/index.html');
	assertFile('schema-collection/index.html');
	assertFile('schema-part/index.html');
	assertFile('schema-source/index.html');
	assertFile('publishing-principles/index.html');
	assertFile('amp-companion/index.html');
	assertFile('preloaded-document/index.html');
	assertFile('schema-contributor/index.html');
	assertFile('schema-reviewer/index.html');
	assertFile('schema-about/index.html');
	assertFile('schema-main-entity/index.html');
	assertFile('schema-main-entity-page/index.html');
	assertFile('schema-main-entity-link-page/index.html');
	assertFile('schema-mentions/index.html');
	assertFile('schema-subject/index.html');
	assertFile('schema-citation/index.html');
	assertFile('parent-page/child-page/index.html');
	assertFile('wp-content/themes/ssgwp-smoke-theme/theme-marker.css');
	assertFile('wp-content/uploads/ssgwp-smoke-asset.txt');
	assertFile('wp-content/uploads/ssgwp-smoke-captions.vtt');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/manifest.json');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/icon-192.png');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/icons/icon.png');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/browserconfig.xml');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/player.json');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/app.css');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/maps/app.css.map');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/captions.vtt');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/runtime.wasm');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/filter.svg');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/icons/filter.png');
	assertFile('wp-content/plugins/ssgwp-smoke-deps/icons/tile-small.png');
	assertFile('static-export.json');
	assertDistinctSmokeContent();

	const files = await listFiles(currentExportDir);
	const duplicatedScope = 'scope%3Asad-quiet-school/scope%3Asad-quiet-school';

	for (const file of files) {
		if (file.includes(duplicatedScope)) {
			throw new Error(`Duplicated Playground scope in exported path: ${file}`);
		}

		if (file.startsWith('scope%3Asad-quiet-school/')) {
			throw new Error(`Playground scope leaked into exported path: ${file}`);
		}
	}

	const staticPage = readText('static-page/index.html');
	const semicolonRefreshTarget = `../static-page-${shortHash('jump=one%3Btwo')}.html#section`;
	const expectedTargets = [
		'../first-smoke-post/index.html',
		'../second-smoke-post/index.html',
		'../about-export/index.html',
		'../parent-page/child-page/index.html',
		'../parent-page/child-page/index.html#meta',
		'../parent-page/index.html',
		'../comments/index.html',
		'../citation-source/index.html',
		'../citation-source/index.html#quote',
		'../citation-source/index.html#inline',
		'../citation-source/index.html#deleted',
		'../citation-source/index.html#inserted',
		'../deferred-link/index.html',
		'../embed-only/index.html',
		'../form-button/index.html',
		'../form-input/index.html',
		'../form-target/index.html',
		'../task-target/index.html',
		'../start-url/index.html',
		'../link-rel-about/index.html',
		'../link-rel-copyright/index.html',
		'../link-rel-glossary/index.html',
		'../link-rel-payment/index.html',
		'../microdata-profile/index.html',
		'../microdata-related/index.html',
		'../microdata-breadcrumb/index.html',
		'../microdata-significant/index.html',
		'../microdata-license/index.html',
		'../microdata-item/index.html',
		'../microdata-type/index.html',
		'../microdata-secondary-type/index.html',
		'../rdfa-about/index.html',
		'../rdfa-resource/index.html',
		'../rdfa-vocab/index.html',
		'../svg-link/index.html',
		'../image-metadata/index.html',
		'../schema-profile/index.html',
		'../schema-license/index.html',
		'../schema-breadcrumb/index.html',
		'../schema-collection/index.html',
		'../schema-part/index.html',
		'../schema-source/index.html',
		'../publishing-principles/index.html',
		'../schema-contributor/index.html',
		'../schema-reviewer/index.html',
		'../schema-about/index.html',
		'../schema-main-entity/index.html',
		'../schema-main-entity-page/index.html',
		'../schema-main-entity-link-page/index.html',
		'../schema-mentions/index.html',
		'../schema-subject/index.html',
		'../schema-citation/index.html',
		'../amp-companion/index.html',
		'../preloaded-document/index.html',
		'relative-child/index.html',
		'index.html#section',
		semicolonRefreshTarget,
		'../wp-content/uploads/ssgwp-smoke-asset.txt?meta=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?audio=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?video=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?deferred=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?data-link=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?orig=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?medium=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?large=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?tile=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?tile-small=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?tile-wide=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?task=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?schema=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?schema-link=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?stream=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?root=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?relative=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?relative-script=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?table-bg=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?cell-bg=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?longdesc=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?mixed=2x',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?image-set=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?embed=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?lazy-embed=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?object=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?param=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?lazy-frame=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?srcdoc=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt?srcdoc-script=1',
		'../wp-content/uploads/ssgwp-smoke-asset.txt',
		'../wp-content/uploads/ssgwp-smoke-captions.vtt?track=1',
		'../wp-content/plugins/ssgwp-smoke-deps/manifest.json',
		'../wp-content/plugins/ssgwp-smoke-deps/browserconfig.xml',
		'../wp-content/plugins/ssgwp-smoke-deps/player.json',
		'../wp-content/plugins/ssgwp-smoke-deps/app.css',
		'../wp-content/plugins/ssgwp-smoke-deps/filter.svg',
	];

	for (const target of expectedTargets) {
		assertIncludes(staticPage, target, `scoped static-page/index.html references ${target}`);
		assertStaticTargetExists('static-page/index.html', target);
	}

	assertIncludes(
		staticPage,
		'imagesrcset="../wp-content/uploads/ssgwp-smoke-asset.txt 1x, ../wp-content/uploads/ssgwp-smoke-asset.txt?preload=2x 2x"',
		'scoped static-page/index.html rewrites responsive image preload srcset'
	);
	assertIncludes(
		staticPage,
		'<base href="./">',
		'scoped static-page/index.html anchors same-site base hrefs to the static document'
	);
	assertIncludes(
		staticPage,
		`content="0; url=&#039;${semicolonRefreshTarget}&#039;; foo=bar"`,
		'scoped static-page/index.html rewrites quoted meta refresh URLs with suffixes'
	);
	assertIncludes(
		staticPage,
		'data-href="../deferred-link/index.html"',
		'scoped static-page/index.html rewrites deferred page data-href attributes'
	);
	assertIncludes(
		staticPage,
		'data-href="../wp-content/uploads/ssgwp-smoke-asset.txt?deferred=1"',
		'scoped static-page/index.html rewrites deferred asset data-href attributes'
	);
	assertIncludes(
		staticPage,
		'data-url="../parent-page/child-page/index.html"',
		'scoped static-page/index.html rewrites generic data-url page attributes'
	);
	assertIncludes(
		staticPage,
		'<meta property="al:web:url" content="../parent-page/child-page/index.html">',
		'scoped static-page/index.html rewrites App Links web fallback URLs'
	);
	assertIncludes(
		staticPage,
		'data-link="../wp-content/uploads/ssgwp-smoke-asset.txt?data-link=1"',
		'scoped static-page/index.html rewrites generic data-link asset attributes'
	);
	assertIncludes(
		staticPage,
		'data-permalink="../image-metadata/index.html"',
		'scoped static-page/index.html rewrites WordPress image metadata permalink attributes'
	);
	assertIncludes(
		staticPage,
		'data-orig-file="../wp-content/uploads/ssgwp-smoke-asset.txt?orig=1"',
		'scoped static-page/index.html rewrites WordPress original image metadata asset attributes'
	);
	assertIncludes(
		staticPage,
		'xlink:href="../svg-link/index.html"',
		'scoped static-page/index.html rewrites SVG anchor xlink href page targets'
	);
	assertIncludes(
		staticPage,
		'itemid="../microdata-item/index.html"',
		'scoped static-page/index.html rewrites microdata itemid page targets'
	);
	assertIncludes(
		staticPage,
		'itemtype="../microdata-type/index.html https://schema.org/Article ../microdata-secondary-type/index.html"',
		'scoped static-page/index.html rewrites same-site microdata itemtype URL tokens'
	);
	assertIncludes(
		staticPage,
		'about="../rdfa-about/index.html" resource="../rdfa-resource/index.html"',
		'scoped static-page/index.html rewrites RDFa page identifiers'
	);
	assertIncludes(
		staticPage,
		'vocab="../rdfa-vocab/index.html"',
		'scoped static-page/index.html rewrites same-site RDFa vocab URLs'
	);
	assertIncludes(
		staticPage,
		'vocab="https://schema.org/"',
		'scoped static-page/index.html preserves external RDFa vocab URLs'
	);
	assertIncludes(
		staticPage,
		'about="[schema:Thing]" resource="_:local"',
		'scoped static-page/index.html preserves RDFa CURIE values'
	);
	assertIncludes(
		staticPage,
		'<link itemprop="item" href="../microdata-breadcrumb/index.html">',
		'scoped static-page/index.html rewrites schema.org breadcrumb item links'
	);
	assertIncludes(
		staticPage,
		'<meta itemprop="citation" content="../citation-source/index.html">',
		'scoped static-page/index.html rewrites schema.org citation metadata'
	);
	assertIncludes(
		staticPage,
		'<link itemprop="citation" href="../citation-source/index.html">',
		'scoped static-page/index.html rewrites schema.org citation links'
	);
	assertIncludes(
		staticPage,
		'<meta itemprop="item" content="../schema-breadcrumb/index.html">',
		'scoped static-page/index.html rewrites schema.org breadcrumb item metadata'
	);
	assertIncludes(
		staticPage,
		'<meta itemprop="isPartOf" content="../schema-collection/index.html">',
		'scoped static-page/index.html rewrites schema.org isPartOf metadata'
	);
	assertIncludes(
		staticPage,
		'<link itemprop="hasPart" href="../schema-part/index.html">',
		'scoped static-page/index.html rewrites schema.org hasPart links'
	);
	assertIncludes(
		staticPage,
		'<meta itemprop="isBasedOnUrl" content="../schema-source/index.html">',
		'scoped static-page/index.html rewrites schema.org isBasedOnUrl metadata'
	);
	assertIncludes(
		staticPage,
		'<link itemprop="publishingPrinciples" href="../publishing-principles/index.html">',
		'scoped static-page/index.html rewrites schema.org publishingPrinciples links'
	);
	assertIncludes(
		staticPage,
		'<link itemprop="contributor" href="../schema-contributor/index.html">',
		'scoped static-page/index.html rewrites schema.org contributor links'
	);
	assertIncludes(
		staticPage,
		'<meta itemprop="reviewedBy" content="../schema-reviewer/index.html">',
		'scoped static-page/index.html rewrites schema.org reviewedBy metadata'
	);
	assertIncludes(
		staticPage,
		'<link itemprop="about" href="../schema-about/index.html">',
		'scoped static-page/index.html rewrites schema.org about links'
	);
	assertIncludes(
		staticPage,
		'<link itemprop="mainEntity" href="../schema-main-entity/index.html">',
		'scoped static-page/index.html rewrites schema.org mainEntity links'
	);
	assertIncludes(
		staticPage,
		'<link itemprop="mainEntityOfPage" href="../schema-main-entity-link-page/index.html">',
		'scoped static-page/index.html rewrites schema.org mainEntityOfPage links'
	);
	assertIncludes(
		staticPage,
		'<meta itemprop="mainEntityOfPage" content="../schema-main-entity-page/index.html">',
		'scoped static-page/index.html rewrites schema.org mainEntityOfPage metadata'
	);
	assertIncludes(
		staticPage,
		'<meta itemprop="mentions" content="../schema-mentions/index.html">',
		'scoped static-page/index.html rewrites schema.org mentions metadata'
	);
	assertIncludes(
		staticPage,
		'<meta itemprop="subjectOf" content="../schema-subject/index.html">',
		'scoped static-page/index.html rewrites schema.org subjectOf metadata'
	);
	assertIncludes(
		staticPage,
		'<link itemprop="citation" href="../schema-citation/index.html">',
		'scoped static-page/index.html rewrites schema.org citation links'
	);
	assertIncludes(
		staticPage,
		'<link rel="about" href="../link-rel-about/index.html">',
		'scoped static-page/index.html rewrites rel=about document links'
	);
	assertIncludes(
		staticPage,
		'<link rel="copyright" href="../link-rel-copyright/index.html">',
		'scoped static-page/index.html rewrites rel=copyright document links'
	);
	assertIncludes(
		staticPage,
		'<link rel="glossary" href="../link-rel-glossary/index.html">',
		'scoped static-page/index.html rewrites rel=glossary document links'
	);
	assertIncludes(
		staticPage,
		'<link rel="payment" href="../link-rel-payment/index.html">',
		'scoped static-page/index.html rewrites rel=payment document links'
	);
	assertIncludes(
		staticPage,
		'<link rel="me" href="../schema-profile/index.html">',
		'scoped static-page/index.html rewrites rel=me identity links'
	);
	assertIncludes(
		staticPage,
		'<link rel="profile" href="../schema-profile/index.html">',
		'scoped static-page/index.html rewrites profile link relations'
	);
	assertIncludes(
		staticPage,
		'profile="../schema-profile/index.html"',
		'scoped static-page/index.html rewrites metadata profile attributes'
	);
	assertIncludes(
		staticPage,
		'class="ping-link" href="../parent-page/child-page/index.html" ping="/click-ping/ /wp-json/ping"',
		'scoped static-page/index.html leaves ping URLs dynamic'
	);
	assertIncludes(
		staticPage,
		'<form class="form-links" action="../form-target/index.html">',
		'scoped static-page/index.html rewrites form action page targets'
	);
	assertIncludes(
		staticPage,
		'<button formaction="../form-button/index.html">',
		'scoped static-page/index.html rewrites button formaction page targets'
	);
	assertIncludes(
		staticPage,
		'<input type="submit" formaction="../form-input/index.html">',
		'scoped static-page/index.html rewrites input formaction page targets'
	);
	assertIncludes(
		staticPage,
		'data="../parent-page/child-page/index.html"',
		'scoped static-page/index.html rewrites object page sources'
	);
	assertIncludes(
		staticPage,
		'<iframe src="../embed-only/index.html"></iframe>',
		'scoped static-page/index.html rewrites iframe src page sources'
	);
	assertIncludes(
		staticPage,
		'<iframe class="longdesc-frame" src="../embed-only/index.html" longdesc="../parent-page/child-page/index.html"></iframe>',
		'scoped static-page/index.html rewrites iframe longdesc page sources'
	);
	assertIncludes(
		staticPage,
		'<frame src="../embed-only/index.html" longdesc="../parent-page/child-page/index.html">',
		'scoped static-page/index.html rewrites legacy frame page sources'
	);
	assertIncludes(
		staticPage,
		'class="longdesc-link" src="../wp-content/uploads/ssgwp-smoke-asset.txt?longdesc=1" longdesc="../parent-page/child-page/index.html"',
		'scoped static-page/index.html rewrites image longdesc page sources'
	);
	assertIncludes(
		staticPage,
		'<embed src="../embed-only/index.html">',
		'scoped static-page/index.html rewrites embed page sources'
	);
	assertIncludes(
		staticPage,
		'<embed src="../wp-content/uploads/ssgwp-smoke-asset.txt?embed=1">',
		'scoped static-page/index.html rewrites embed media sources'
	);
	assertIncludes(
		staticPage,
		'<embed data-src="../embed-only/index.html" data-lazy-src="../wp-content/uploads/ssgwp-smoke-asset.txt?lazy-embed=1">',
		'scoped static-page/index.html rewrites lazy embed sources'
	);
	assertIncludes(
		staticPage,
		'data="../wp-content/uploads/ssgwp-smoke-asset.txt?object=1"',
		'scoped static-page/index.html rewrites object media sources'
	);
	assertIncludes(
		staticPage,
		'<param name="movie" value="../wp-content/uploads/ssgwp-smoke-asset.txt?param=1">',
		'scoped static-page/index.html rewrites media object param values'
	);
	assertIncludes(
		staticPage,
		'<param name="url" value="../parent-page/child-page/index.html">',
		'scoped static-page/index.html rewrites page object param values'
	);
	assertIncludes(
		staticPage,
		'data-src="../parent-page/child-page/index.html"',
		'scoped static-page/index.html rewrites lazy iframe page sources'
	);
	assertIncludes(
		staticPage,
		'data-lazy-src="../wp-content/uploads/ssgwp-smoke-asset.txt?lazy-frame=1"',
		'scoped static-page/index.html rewrites lazy iframe media sources'
	);
	assertDoesNotInclude(staticPage, duplicatedScope);
	assertDoesNotInclude(staticPage, 'href="/scope:sad-quiet-school/static-page/"');
	assertDoesNotInclude(staticPage, 'href="scope%3Asad-quiet-school/');
	assertDoesNotInclude(
		staticPage,
		'"root":"\\/scope:sad-quiet-school\\/parent-page\\/child-page\\/"'
	);
	assertDoesNotInclude(staticPage, '"protocolChild":"//');
	assertDoesNotInclude(staticPage, '"protocolEscaped":"\\/\\/');
	assertDoesNotInclude(staticPage, '"relativePage":"./relative-child/"');
	assertIncludes(
		staticPage,
		'"relativePage":"relative-child/index.html"',
		'scoped static-page/index.html rewrites document-relative script page URLs'
	);
	assertIncludes(
		staticPage,
		'"relativeEscaped":"relative-child/index.html"',
		'scoped static-page/index.html rewrites normalized escaped document-relative script page URLs'
	);
	assertIncludes(
		staticPage,
		'"relativeAsset":"../wp-content/uploads/ssgwp-smoke-asset.txt?relative-script=1"',
		'scoped static-page/index.html rewrites parent-relative script asset URLs'
	);
	assertDoesNotInclude(staticPage, '&quot;srcdocPage&quot;:&quot;./relative-child/&quot;');
	assertIncludes(
		staticPage,
		'&quot;srcdocPage&quot;:&quot;relative-child/index.html&quot;',
		'scoped static-page/index.html rewrites srcdoc script page URLs'
	);
	assertIncludes(
		staticPage,
		'&quot;srcdocEscaped&quot;:&quot;relative-child/index.html&quot;',
		'scoped static-page/index.html rewrites escaped srcdoc script page URLs'
	);
	assertIncludes(
		staticPage,
		'&quot;srcdocAsset&quot;:&quot;../wp-content/uploads/ssgwp-smoke-asset.txt?srcdoc-script=1&quot;',
		'scoped static-page/index.html rewrites srcdoc script asset URLs'
	);
	assertIncludes(
		staticPage,
		'href="https://playground.wordpress.net/scope:sad-quiet-school/?rest_route=/wp/v2/posts"',
		'scoped static-page/index.html leaves query-based REST API links untouched'
	);
	assertIncludes(
		staticPage,
		'"rest":"https://playground.wordpress.net/scope:sad-quiet-school/?rest_route=/wp/v2/posts"',
		'scoped static-page/index.html leaves query-based REST API JSON URLs untouched'
	);
	assertIncludes(
		staticPage,
		'href="https://playground.wordpress.net/scope:sad-quiet-school/?feed=rss2"',
		'scoped static-page/index.html leaves query-based feed links untouched'
	);
	assertIncludes(
		staticPage,
		'"feedQuery":"https://playground.wordpress.net/scope:sad-quiet-school/?feed=rss2"',
		'scoped static-page/index.html leaves query-based feed JSON URLs untouched'
	);
	assertIncludes(
		staticPage,
		'class="oembed-query-link" href="https://playground.wordpress.net/scope:sad-quiet-school/?oembed=true',
		'scoped static-page/index.html leaves query-based oEmbed links untouched'
	);
	assertIncludes(
		staticPage,
		'"oembedQuery":"https://playground.wordpress.net/scope:sad-quiet-school/?oembed=true',
		'scoped static-page/index.html leaves query-based oEmbed JSON URLs untouched'
	);
	assertIncludes(
		staticPage,
		'"plainRootAsset":"/wp-content/uploads/ssgwp-smoke-asset.txt?outside=1"',
		'scoped static-page/index.html leaves root-level plain asset JSON outside the scope'
	);
	assertIncludes(
		staticPage,
		'"plainRootAssetEscaped":"/wp-content/uploads/ssgwp-smoke-asset.txt?outside=2"',
		'scoped static-page/index.html leaves root-level asset JSON outside the scope'
	);
	assertIncludes(
		staticPage,
		'"absoluteWildcard":"https://playground.wordpress.net/scope:sad-quiet-school/wp-content/uploads/*"',
		'scoped static-page/index.html leaves absolute wildcard asset patterns untouched'
	);
	assertIncludes(
		staticPage,
		'"protocolWildcard":"//playground.wordpress.net/scope:sad-quiet-school/wp-content/uploads/*"',
		'scoped static-page/index.html leaves protocol-relative wildcard asset patterns untouched'
	);
	assertIncludes(
		staticPage,
		'"absoluteTemplate":"https://playground.wordpress.net/scope:sad-quiet-school/static-page/{id}/"',
		'scoped static-page/index.html leaves absolute templated page patterns untouched'
	);
	assertIncludes(
		staticPage,
		'https://playground.wordpress.net/scope:other-site/static-page/',
		'scoped static-page/index.html leaves another scope page link untouched'
	);
	assertIncludes(
		staticPage,
		'https://playground.wordpress.net/scope:other-site/wp-content/uploads/asset.txt',
		'scoped static-page/index.html leaves another scope asset link untouched'
	);
	assertStaticTargetExists(
		'wp-content/plugins/ssgwp-smoke-deps/manifest.json',
		'icon-192.png'
	);
	assertStaticTargetExists(
		'wp-content/plugins/ssgwp-smoke-deps/manifest.json',
		'icons/icon.png'
	);
	assertStaticTargetExists(
		'wp-content/plugins/ssgwp-smoke-deps/browserconfig.xml',
		'icons/tile-small.png'
	);
	assertIncludes(
		readText('wp-content/plugins/ssgwp-smoke-deps/player.json'),
		'captions.vtt',
		'scoped copied JSON player configs rewrite WebVTT caption references'
	);
	assertStaticTargetExists(
		'wp-content/plugins/ssgwp-smoke-deps/player.json',
		'captions.vtt'
	);
	assertIncludes(
		readText('wp-content/plugins/ssgwp-smoke-deps/player.json'),
		'runtime.wasm',
		'scoped copied JSON player configs rewrite WebAssembly module references'
	);
	assertStaticTargetExists(
		'wp-content/plugins/ssgwp-smoke-deps/player.json',
		'runtime.wasm'
	);
	assertIncludes(
		readText('wp-content/plugins/ssgwp-smoke-deps/app.css'),
		'sourceMappingURL=maps/app.css.map',
		'copied scoped CSS assets preserve source map references'
	);
	assertStaticTargetExists(
		'wp-content/plugins/ssgwp-smoke-deps/app.css',
		'maps/app.css.map'
	);
	assertIncludes(
		readText('wp-content/plugins/ssgwp-smoke-deps/filter.svg'),
		'icons/filter.png',
		'scoped copied SVG assets rewrite filter image references'
	);
	assertStaticTargetExists(
		'wp-content/plugins/ssgwp-smoke-deps/filter.svg',
		'icons/filter.png'
	);
	await assertAllLocalResourceTargetsExist();
}

function verifyCliExport() {
	assertFileExists(cliZipPath, 'Missing WP-CLI static export ZIP.');
	mkdirSync(cliExportDir, { recursive: true });

	const result = spawnSync(
		'php',
		[
			'-r',
			[
				'$zip = new ZipArchive();',
				'$status = $zip->open(getenv("SSGWP_ZIP"));',
				'if (true !== $status) { fwrite(STDERR, "Could not open ZIP: " . $status . "\\n"); exit(1); }',
				'if (!$zip->extractTo(getenv("SSGWP_ZIP_OUT"))) { fwrite(STDERR, "Could not extract ZIP\\n"); exit(1); }',
				'$zip->close();',
			].join(' '),
		],
		{
			encoding: 'utf8',
			env: {
				...process.env,
				SSGWP_ZIP: cliZipPath,
				SSGWP_ZIP_OUT: cliExportDir,
			},
			stdio: 'pipe',
		}
	);

	if (result.status !== 0) {
		throw new Error(
			[
				'Could not inspect WP-CLI static export ZIP.',
				`Exit status: ${result.status === null ? 'unknown' : result.status}`,
				`Signal: ${result.signal || 'none'}`,
				`STDOUT:\n${result.stdout || ''}`,
				`STDERR:\n${result.stderr || ''}`,
			].join('\n')
		);
	}

	currentExportDir = cliExportDir;
	assertFile('static-export.json');
	assertDistinctSmokeContent();
}

function assertDistinctSmokeContent() {
	const home = readText('index.html');
	const firstPost = readText('first-smoke-post/index.html');
	const secondPost = readText('second-smoke-post/index.html');
	const aboutPage = readText('about-export/index.html');
	const staticPage = readText('static-page/index.html');

	assertIncludes(
		home,
		'data-smoke-template="home"',
		'homepage uses the custom smoke theme index template'
	);
	assertIncludes(
		home,
		'Custom smoke theme homepage marker.',
		'homepage contains the custom theme homepage marker'
	);
	assertIncludes(
		firstPost,
		'data-smoke-template="single"',
		'first post uses the custom smoke theme single template'
	);
	assertIncludes(
		firstPost,
		'First smoke post unique body.',
		'first post exports its own content'
	);
	assertDoesNotInclude(
		firstPost,
		'Custom smoke theme homepage marker.',
		'first post is not the homepage HTML'
	);
	assertIncludes(
		secondPost,
		'data-smoke-template="single"',
		'second post uses the custom smoke theme single template'
	);
	assertIncludes(
		secondPost,
		'Second smoke post unique body.',
		'second post exports its own content'
	);
	assertDoesNotInclude(
		secondPost,
		'Custom smoke theme homepage marker.',
		'second post is not the homepage HTML'
	);
	assertIncludes(
		aboutPage,
		'data-smoke-template="page"',
		'custom page uses the custom smoke theme page template'
	);
	assertIncludes(
		aboutPage,
		'About export page unique body.',
		'custom page exports its own content'
	);
	assertDoesNotInclude(
		aboutPage,
		'Custom smoke theme homepage marker.',
		'custom page is not the homepage HTML'
	);
	assertIncludes(
		staticPage,
		'Static smoke page.',
		'linked static page exports its own content'
	);
	assertStaticTargetExists(
		'index.html',
		'wp-content/themes/ssgwp-smoke-theme/theme-marker.css'
	);
}

function assertFile(relativePath) {
	const target = path.join(currentExportDir, relativePath);

	if (!existsSync(target)) {
		throw new Error(`Missing exported file: ${relativePath}`);
	}
}

function assertFileExists(target, message) {
	if (!existsSync(target)) {
		throw new Error(message);
	}
}

function readText(relativePath) {
	return readFileSync(path.join(currentExportDir, relativePath), 'utf8');
}

function assertIncludes(haystack, needle, message) {
	if (!haystack.includes(needle)) {
		throw new Error(`${message}. Missing ${JSON.stringify(needle)}.`);
	}
}

function assertDoesNotInclude(haystack, needle, message) {
	if (haystack.includes(needle)) {
		const prefix = message || 'Unexpected exported reference';
		throw new Error(`${prefix}. Unexpected ${JSON.stringify(needle)}.`);
	}
}

function assertStaticTargetExists(fromFile, targetUrl) {
	const target = resolveExportReference(fromFile, targetUrl);

	if (target && !existsSync(target)) {
		throw new Error(
			`Broken static export reference from ${fromFile}: ${targetUrl}`
		);
	}
}

async function listFiles(dir, prefix = '') {
	const entries = await readdir(dir, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const relative = path.join(prefix, entry.name);
		const absolute = path.join(dir, entry.name);

		if (entry.isDirectory()) {
			files.push(...(await listFiles(absolute, relative)));
		} else {
			files.push(relative);
		}
	}

	return files;
}

async function assertAllLocalResourceTargetsExist() {
	const files = await listFiles(currentExportDir);
	const htmlFiles = files.filter((file) => /\.html$/i.test(file));
	const cssQueue = [];
	const inspectedCss = new Set();

	for (const file of htmlFiles) {
		const text = readText(file);
		const refs = [
			...extractAttributeRefs(text),
			...extractSrcsetRefs(text),
			...extractHtmlCssRefs(text),
		];

		for (const ref of refs) {
			const target = resolveExportReference(file, ref);

			if (target && !existsSync(target)) {
				throw new Error(`Broken local reference in ${file}: ${ref}`);
			}

			if (target && /\.css$/i.test(target)) {
				cssQueue.push(path.relative(currentExportDir, target));
			}
		}
	}

	while (cssQueue.length > 0) {
		const file = cssQueue.shift();

		if (!file || inspectedCss.has(file)) {
			continue;
		}

		inspectedCss.add(file);

		const text = readText(file);

		for (const ref of extractCssUrlRefs(text)) {
			const target = resolveExportReference(file, ref);

			if (target && !existsSync(target)) {
				throw new Error(`Broken local reference in ${file}: ${ref}`);
			}

			if (target && /\.css$/i.test(target)) {
				cssQueue.push(path.relative(currentExportDir, target));
			}
		}
	}
}

function extractAttributeRefs(text) {
	const attributes = [
		'href',
		'src',
		'cite',
		'longdesc',
		'data-href',
		'data-link',
		'data-src',
		'data-lazy-src',
		'data-url',
		'data-permalink',
		'data-orig-file',
		'data-medium-file',
		'data-large-file',
		'data',
		'poster',
	];
	const pattern = new RegExp(
		`\\s(?:${attributes.join('|')})=["']([^"']+)["']`,
		'gi'
	);

	return [...text.matchAll(pattern)].map((match) => match[1]);
}

function extractSrcsetRefs(text) {
	const refs = [];

	for (const match of text.matchAll(/\ssrcset=["']([^"']+)["']/gi)) {
		for (const candidate of splitSrcsetCandidates(match[1])) {
			const [url] = candidate.trim().split(/\s+/);

			if (url) {
				refs.push(url);
			}
		}
	}

	return refs;
}

function splitSrcsetCandidates(srcset) {
	const candidates = [];
	let candidate = '';
	let urlStarted = false;
	let urlFinished = false;
	let dataUrlPrefix = false;

	for (let index = 0; index < srcset.length; index++) {
		const char = srcset[index];

		if (!urlStarted && !/\s/.test(char)) {
			urlStarted = true;
			dataUrlPrefix = srcset.slice(index, index + 5).toLowerCase() === 'data:';
		}

		if (urlStarted && !urlFinished && /\s/.test(char)) {
			urlFinished = true;
		}

		if (
			char === ',' &&
			(!dataUrlPrefix || urlFinished || /\s/.test(srcset[index + 1] || ''))
		) {
			candidates.push(candidate.trim());
			candidate = '';
			urlStarted = false;
			urlFinished = false;
			dataUrlPrefix = false;
			continue;
		}

		candidate += char;
	}

	if (candidate.trim()) {
		candidates.push(candidate.trim());
	}

	return candidates;
}

function shortHash(value) {
	return createHash('md5').update(value).digest('hex').slice(0, 8);
}

function extractCssUrlRefs(text) {
	return [
		...text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi),
		...text.matchAll(/image-set\(\s*["']([^"']+)["']/gi),
		...text.matchAll(/-webkit-image-set\(\s*["']([^"']+)["']/gi),
	].map(
		(match) => match[1]
	);
}

function extractHtmlCssRefs(text) {
	const css = [];

	for (const match of text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
		css.push(match[1]);
	}

	for (const match of text.matchAll(/\sstyle=["']([^"']+)["']/gi)) {
		css.push(match[1]);
	}

	return css.flatMap((chunk) => extractCssUrlRefs(chunk));
}

function resolveExportReference(fromFile, ref) {
	if (!ref || ref.startsWith('#') || ref.startsWith('//')) {
		return null;
	}

	if (/[?&](?:feed|oembed|rest_route)=/.test(ref)) {
		return null;
	}

	if (/^[a-z][a-z0-9+.-]*:/i.test(ref)) {
		return null;
	}

	const withoutHash = ref.split('#', 1)[0];
	const withoutQuery = withoutHash.split('?', 1)[0];

	if (!withoutQuery || withoutQuery.startsWith('data:')) {
		return null;
	}

	const base = withoutQuery.startsWith('/')
		? currentExportDir
		: path.dirname(path.join(currentExportDir, fromFile));
	const resolved = path.resolve(base, withoutQuery.replace(/^\/+/, ''));
	const exportRoot = path.resolve(currentExportDir);

	if (resolved !== exportRoot && !resolved.startsWith(exportRoot + path.sep)) {
		throw new Error(`Reference escapes export root from ${fromFile}: ${ref}`);
	}

	return resolved;
}
