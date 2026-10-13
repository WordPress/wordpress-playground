<?php
/**
 * Seeds the import E2E source site. Runs under `wp eval-file`, so WordPress
 * is loaded. Prints a JSON manifest the test reads back over HTTP.
 *
 * The content is chosen for what a pull has to get right, not for volume:
 * absolute URLs in posts, serialized options and meta, shortcodes with
 * escaped URLs, generated thumbnails, a custom table, and non-ASCII paths.
 */

$site_url = rtrim(getenv('REPRINT_E2E_SITE_URL') ?: home_url(), '/');

require_once ABSPATH . 'wp-admin/includes/image.php';
require_once ABSPATH . 'wp-admin/includes/file.php';
require_once ABSPATH . 'wp-admin/includes/media.php';

// A generated JPEG so WordPress creates its thumbnail sizes on upload.
$image = imagecreatetruecolor(1200, 800);
imagefilledrectangle($image, 0, 0, 1199, 799, imagecolorallocate($image, 30, 90, 200));
imagefilledellipse($image, 600, 400, 500, 300, imagecolorallocate($image, 250, 200, 40));
ob_start();
imagejpeg($image, null, 85);
$upload = wp_upload_bits('hero.jpg', null, ob_get_clean());
if (!empty($upload['error'])) {
	fwrite(STDERR, "Upload failed: {$upload['error']}\n");
	exit(1);
}
$attachment_id = wp_insert_attachment(
	['post_mime_type' => 'image/jpeg', 'post_title' => 'Hero image', 'post_status' => 'inherit'],
	$upload['file']
);
wp_update_attachment_metadata(
	$attachment_id,
	wp_generate_attachment_metadata($attachment_id, $upload['file'])
);
$thumbnail_url = wp_get_attachment_image_url($attachment_id, 'thumbnail');
$uploads = wp_get_upload_dir();
/** Convert upload URLs to file paths for byte checks after the import. */
$relative = fn(string $url) => ltrim(str_replace($uploads['baseurl'], 'wp-content/uploads', $url), '/');

$editor = wp_insert_user([
	'user_login' => 'editor',
	'user_pass' => 'password',
	'user_email' => 'editor@example.com',
	'role' => 'editor',
	'display_name' => 'Zażółć Gęślą',
]);

$posts = [];
for ($i = 1; $i <= 24; $i++) {
	$posts[] = wp_insert_post([
		'post_title' => "Entry $i: coffee, mountains and other things",
		'post_name' => "entry-$i",
		'post_status' => 'publish',
		'post_author' => $i % 3 === 0 ? $editor : 1,
		'post_content' => "<!-- wp:paragraph --><p>Paragraph $i links to <a href=\"{$site_url}/?p=1\">the first entry</a> "
			. "and shows <img src=\"{$thumbnail_url}\" alt=\"hero\" /> inline.</p><!-- /wp:paragraph -->",
	]);
}

// wp_insert_post() unslashes its input, so slash it to keep the backslashes
// page builders such as WPBakery store inside shortcode attributes.
$hero_post = wp_insert_post(wp_slash([
	'post_title' => 'Hero post with an escaped shortcode URL',
	'post_name' => 'hero-post',
	'post_status' => 'publish',
	'post_content' => '[vc_row][vc_column width="1/2"][vc_video link="'
		. str_replace('/', '\\/', $site_url) . '\\/wp-content\\/uploads\\/video.mp4"][/vc_column][/vc_row]'
		. "\n<!-- wp:image --><figure class=\"wp-block-image\"><img src=\"{$thumbnail_url}\" /></figure><!-- /wp:image -->",
]));
set_post_thumbnail($hero_post, $attachment_id);
update_post_meta($hero_post, 'playground_e2e_gallery', [
	'cover' => wp_get_attachment_url($attachment_id),
	'sizes' => ['thumb' => $thumbnail_url],
]);

update_option('playground_e2e_settings', [
	'hero' => wp_get_attachment_url($attachment_id),
	'links' => ["{$site_url}/?p={$hero_post}", "{$site_url}/feed/"],
	'label' => 'Zażółć gęślą jaźń',
]);
set_theme_mod('custom_logo', $attachment_id);

global $wpdb;
$table = "{$wpdb->prefix}playground_e2e_notes";
$wpdb->query("CREATE TABLE $table (id bigint unsigned NOT NULL AUTO_INCREMENT, note text NOT NULL, url text NOT NULL, PRIMARY KEY (id))");
foreach (['first', 'second', 'third'] as $index => $note) {
	$wpdb->insert($table, ['note' => $note, 'url' => "{$site_url}/?p=" . ($index + 1)]);
}

// A file whose path is not ASCII, outside the year/month tree.
$unicode_dir = $uploads['basedir'] . '/zdjęcia';
wp_mkdir_p($unicode_dir);
file_put_contents($unicode_dir . '/ślimak-🐌.txt', "unicode path\n");

echo json_encode([
	'siteUrl' => $site_url,
	'heroPost' => $hero_post,
	'firstPost' => $posts[0],
	'attachment' => $attachment_id,
	'thumbnail' => $relative($thumbnail_url),
	'original' => $relative(wp_get_attachment_url($attachment_id)),
	'unicodeFile' => 'wp-content/uploads/zdjęcia/ślimak-🐌.txt',
	'notesTable' => $table,
	'postCount' => (int) wp_count_posts()->publish,
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), "\n";
