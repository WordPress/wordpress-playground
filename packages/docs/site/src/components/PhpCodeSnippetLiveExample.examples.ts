export const examples = {
	full: String.raw`<script id="product-card-blueprint" type="application/json">
{
  "steps": [
    {
      "step": "writeFile",
      "path": "/wordpress/wp-content/mu-plugins/product-cards.php",
      "data": "<?php\nfunction docs_render_product_card( array $product ): string {\n\treturn sprintf(\n\t\t'<article class=\"product-card\"><h3>%s</h3><p>$%0.2f</p></article>',\n\t\tesc_html( $product['name'] ),\n\t\t$product['price']\n\t);\n}\n"
    }
  ]
}
</script>

<php-snippet name="product-card.php" blueprint="product-card-blueprint">
  <script type="application/x-php">
<?php
require '/wordpress/wp-load.php';

$products = [
	[
		'name'  => 'Canvas Tote',
		'price' => 24,
	],
	[
		'name'  => 'Coffee & Code Mug',
		'price' => 16.5,
	],
];

foreach ( $products as $product ) {
	echo docs_render_product_card( $product ) . "\n";
}
  </script>
  <script type="text/expected-output">
<article class="product-card"><h3>Canvas Tote</h3><p>$24.00</p></article>
<article class="product-card"><h3>Coffee &amp; Code Mug</h3><p>$16.50</p></article>
  </script>
</php-snippet>`,
	hello: String.raw`<php-snippet name="hello.php">
  <script type="application/x-php">
<?php
echo 'Hello from PHP ' . phpversion();
  </script>
  <script type="text/expected-output">
Hello from PHP 8.4.x
  </script>
</php-snippet>`,
	htmlApi: String.raw`<php-snippet name="html-api.php">
  <script type="application/x-php">
<?php
require '/wordpress/wp-load.php';

$html = '<img src="hero.jpg" alt="Hero">';
$tags = new WP_HTML_Tag_Processor( $html );

if ( $tags->next_tag( 'img' ) ) {
	$tags->set_attribute( 'loading', 'lazy' );
}

echo $tags->get_updated_html();
  </script>
  <script type="text/expected-output">
<img src="hero.jpg" alt="Hero" loading="lazy">
  </script>
</php-snippet>`,
	sum: String.raw`<php-snippet name="sum.php" expected-output="42">&lt;?php echo 20 + 22;</php-snippet>`,
	siteTitle: String.raw`<php-snippet name="site-title.php">
  <script type="application/x-php">
<?php
require '/wordpress/wp-load.php';

update_option( 'blogname', 'Snippet Docs' );
echo get_bloginfo( 'name' );
  </script>
  <script type="text/expected-output">
Snippet Docs
  </script>
</php-snippet>`,
	purePhp: String.raw`<php-snippet name="pure-php.php" wp="none">
  <script type="application/x-php">
<?php
echo 'WordPress installed: ';
echo file_exists( '/wordpress/wp-load.php' ) ? 'yes' : 'no';
  </script>
  <script type="text/expected-output">
WordPress installed: no
  </script>
</php-snippet>`,
	scratch: String.raw`<php-snippet name="scratch.php">
  <script type="application/x-php">
<?php
$numbers = range( 1, 5 );
echo array_sum( $numbers );
  </script>
  <script type="text/expected-output">
15
 </script>
</php-snippet>`,
	readOnly: String.raw`<php-snippet name="reference.php" readonly>
  <script type="application/x-php">
<?php
echo 'This example can run, but the code is locked.';
  </script>
  <script type="text/expected-output">
This example can run, but the code is locked.
  </script>
</php-snippet>`,
	precomputed: String.raw`<php-snippet name="precomputed.php">
  <script type="application/x-php">
<?php
echo '2 + 2 = ' . ( 2 + 2 );
  </script>
  <script type="text/expected-output">
2 + 2 = 4
  </script>
</php-snippet>`,
	oneLine: String.raw`<php-snippet name="one-line.php" expected-output="Ready">
  <script type="application/x-php">
<?php
echo 'Ready';
  </script>
</php-snippet>`,
	greeting: String.raw`<script id="setup-blueprint-preview" type="application/json">
{
  "steps": [
    {
      "step": "writeFile",
      "path": "/wordpress/wp-content/mu-plugins/helpers.php",
      "data": "<?php\nfunction docs_greet( $name ) {\n\treturn 'Hello, ' . $name;\n}\n"
    }
  ]
}
</script>

<php-snippet name="greeting.php" blueprint="setup-blueprint-preview">
  <script type="application/x-php">
<?php
require '/wordpress/wp-load.php';
echo docs_greet( 'Ada' );
  </script>
  <script type="text/expected-output">
Hello, Ada
  </script>
</php-snippet>`,
	withSelector: String.raw`<script id="setup-blueprint-selector-preview" type="application/json">
{
  "steps": [
    {
      "step": "writeFile",
      "path": "/wordpress/wp-content/mu-plugins/helpers.php",
      "data": "<?php\nfunction docs_greet( $name ) {\n\treturn 'Hello, ' . $name;\n}\n"
    }
  ]
}
</script>

<php-snippet blueprint="#setup-blueprint-selector-preview" name="with-selector.php">
  <script type="application/x-php">
<?php
require '/wordpress/wp-load.php';
echo docs_greet( 'Grace' );
  </script>
  <script type="text/expected-output">
Hello, Grace
  </script>
</php-snippet>`,
	enum: String.raw`<php-snippet name="enum.php" php="8.4">
  <script type="application/x-php">
<?php
enum Status {
	case Draft;
	case Published;
}

echo Status::Published->name;
  </script>
  <script type="text/expected-output">
Published
  </script>
</php-snippet>`,
	wpVersion: String.raw`<php-snippet name="wp-version.php" wp="6.8">
  <script type="application/x-php">
<?php
require '/wordpress/wp-load.php';
echo get_bloginfo( 'version' );
  </script>
  <script type="text/expected-output">
6.8
  </script>
</php-snippet>`,
	symfonyBlueprint: String.raw`<script id="symfony-blueprint-preview" type="application/json">
{
  "features": {
    "networking": true
  },
  "steps": [
    {
      "step": "unzip",
      "zipFile": {
        "resource": "url",
        "url": "https://wordpress.github.io/blueprints/blueprints/symfony-package-radar/symfony-package-radar.zip?v=html-api-2026-06-08"
      },
      "extractToPath": "/app"
    }
  ]
}
</script>

<php-snippet name="run-symfony.php" wp="none" blueprint="symfony-blueprint-preview">
  <script type="application/x-php">
<?php
require '/app/symfony-package-radar/vendor/autoload.php';

use App\Kernel;
use Symfony\Component\HttpFoundation\Request;

$kernel = new Kernel('prod', false);
$request = Request::create('/');
$response = $kernel->handle($request);

$pageTitle = get_first_h1_text($response->getContent());

echo 'HTTP ' . $response->getStatusCode() . PHP_EOL;
echo 'Symfony page: ' . $pageTitle . PHP_EOL;
echo 'WordPress installed: ';
echo file_exists('/wordpress/wp-load.php') ? 'yes' : 'no';

$kernel->terminate($request, $response);

/**
 * The app's Composer dependencies include the WordPress HTML API, so the
 * snippet can read the <h1> with WP_HTML_Processor without installing or
 * booting WordPress.
 */
function get_first_h1_text(string $html): string
{
    $processor = WP_HTML_Processor::create_fragment($html);
    if (!$processor->next_tag('H1')) {
        return 'unknown';
    }

    $text = '';
    while ($processor->next_token()) {
        if ('H1' === $processor->get_tag() && $processor->is_tag_closer()) {
            break;
        }
        if ('#text' === $processor->get_token_type()) {
            $text .= $processor->get_modifiable_text();
        }
    }

    return trim($text);
}
  </script>
  <script type="text/expected-output">
HTTP 200
Symfony page: Symfony Playground
WordPress installed: no
  </script>
</php-snippet>`,
	illustration: String.raw`<php-snippet name="illustration.php" runnable="false">
  <script type="application/x-php">
<?php
// This fragment is shown for discussion, not execution.
add_filter( 'the_content', 'docs_filter_content' );
  </script>
</php-snippet>`,
} as const;

export type ExampleName = keyof typeof examples;
