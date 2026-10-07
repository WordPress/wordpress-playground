---
title: પ્લેગ્રાઉન્ડમાં PHP ફ્રેમવર્ક ચલાવો
slug: /guides/php-frameworks
description: વર્ડપ્રેસ સિવાયના ફ્રેમવર્ક અને એપ્સ માટે વર્ડપ્રેસ પ્લેગ્રાઉન્ડનો બ્રાઉઝર-આધારિત PHP રનટાઇમ તરીકે ઉપયોગ કરો.
sidebar_class_name: navbar-build-item
---

import { PhpCodeSnippetExample } from '@site/src/components/PhpCodeSnippetLiveExample';

<!--
# Run PHP frameworks in Playground
-->

# પ્લેગ્રાઉન્ડમાં PHP ફ્રેમવર્ક ચલાવો

<!--
WordPress Playground is also a browser-based PHP runtime. WordPress is the
most common app it boots, but a Blueprint can skip the WordPress download,
write any PHP files into the virtual filesystem, and run a framework such as
Symfony.
-->

વર્ડપ્રેસ પ્લેગ્રાઉન્ડ એક બ્રાઉઝર-આધારિત PHP રનટાઇમ (runtime) પણ છે. તે સૌથી વધુ વર્ડપ્રેસ જ શરૂ કરે છે, પરંતુ બ્લુપ્રિન્ટ (Blueprint) વર્ડપ્રેસનું ડાઉનલોડ છોડી શકે છે, વર્ચ્યુઅલ ફાઇલસિસ્ટમ (filesystem) માં કોઈપણ PHP ફાઇલો લખી શકે છે અને Symfony જેવું ફ્રેમવર્ક ચલાવી શકે છે.

<!--
This guide shows the shape of that setup. Use it when you want a shareable demo,
a docs example, or a quick compatibility check for a PHP app that does not need
a server, database, Node.js, Sass, or a local Composer install.
-->

આ માર્ગદર્શિકા એ સેટઅપનું સ્વરૂપ બતાવે છે. જ્યારે તમને શેર કરી શકાય તેવો ડેમો, દસ્તાવેજીકરણ માટેનું ઉદાહરણ, અથવા એવી PHP એપ માટે ઝડપી સુસંગતતા (compatibility) તપાસ જોઈતી હોય કે જેને સર્વર, ડેટાબેઝ, Node.js, Sass અથવા સ્થાનિક Composer ઇન્સ્ટોલની જરૂર ન હોય, ત્યારે તેનો ઉપયોગ કરો.

<!--
## What changes when you skip WordPress
-->

## વર્ડપ્રેસ છોડો ત્યારે શું બદલાય છે

<!--
Set `preferredVersions.wp` to `false` in a Blueprint, or `wp="none"` on a
`<php-snippet>`. Playground still downloads PHP, mounts a writable filesystem,
runs Blueprint steps, and supports networking when `features.networking` is
`true`. It just does not download or boot WordPress.
-->

બ્લુપ્રિન્ટમાં `preferredVersions.wp` ને `false` પર સેટ કરો, અથવા `<php-snippet>` પર `wp="none"` લખો. પ્લેગ્રાઉન્ડ તેમ છતાં PHP ડાઉનલોડ કરે છે, લખી શકાય તેવી ફાઇલસિસ્ટમ માઉન્ટ (mount) કરે છે, બ્લુપ્રિન્ટના સ્ટેપ્સ ચલાવે છે, અને `features.networking` `true` હોય ત્યારે નેટવર્કિંગને સપોર્ટ કરે છે. ફક્ત તે વર્ડપ્રેસ ડાઉનલોડ કે શરૂ કરતું નથી.

<!--
That makes Playground useful for generic PHP examples:
-->

આના કારણે પ્લેગ્રાઉન્ડ સામાન્ય PHP ઉદાહરણો માટે ઉપયોગી બને છે:

<!--
- PHP libraries that need a real filesystem.
- Framework demos that can run behind `public/index.php`.
- Documentation snippets that should execute in the browser.
- Reproducible bug reports for PHP code that is not WordPress-specific.
-->

- એવી PHP લાઇબ્રેરીઓ જેને વાસ્તવિક ફાઇલસિસ્ટમની જરૂર હોય.
- ફ્રેમવર્ક ડેમો જે `public/index.php` પાછળ ચાલી શકે.
- દસ્તાવેજીકરણના સ્નિપેટ્સ (snippets) જે બ્રાઉઝરમાં ચાલવા જોઈએ.
- એવા PHP કોડ માટે ફરીથી ચલાવી શકાય તેવા બગ રિપોર્ટ જે ફક્ત વર્ડપ્રેસ માટે નથી.

<!--
## Try a Symfony app
-->

## Symfony એપ અજમાવો

<!--
The example below uses a Blueprint to download and unzip a bundled Symfony app
into `/app`. Then a `<php-snippet>` boots the Symfony kernel and renders the
dashboard route. The app's Composer dependencies include the WordPress HTML API,
so the snippet can read the `<h1>` with `WP_HTML_Processor` without installing or
booting WordPress.
-->

નીચેનું ઉદાહરણ બ્લુપ્રિન્ટનો ઉપયોગ કરીને બંડલ કરેલી (bundled) Symfony એપને `/app` માં ડાઉનલોડ કરીને અનઝિપ (unzip) કરે છે. પછી `<php-snippet>` Symfony કર્નલ (kernel) શરૂ કરે છે અને ડેશબોર્ડ રૂટ (route) રેન્ડર કરે છે. એપની Composer ડિપેન્ડન્સીઝ (dependencies) માં વર્ડપ્રેસ HTML API શામેલ છે, તેથી સ્નિપેટ વર્ડપ્રેસ ઇન્સ્ટોલ કે શરૂ કર્યા વિના `WP_HTML_Processor` વડે `<h1>` વાંચી શકે છે.

<PhpCodeSnippetExample name="symfonyBlueprint" />

<!--
Here is the complete embed:
-->

અહીં સંપૂર્ણ એમ્બેડ (embed) કોડ છે:

<!-- prettier-ignore-start -->

```html
<script type="module" src="https://playground.wordpress.net/php-code-snippet.js"></script>

<script id="symfony-blueprint" type="application/json">
{
  "features": {
    "networking": true
  },
  "steps": [
    {
      "step": "unzip",
      "zipFile": {
        "resource": "url",
        "url": "https://wordpress.github.io/blueprints/blueprints/symfony-package-radar/symfony-package-radar.zip?v=wp-php-toolkit-html-2026-06-09"
      },
      "extractToPath": "/app"
    }
  ]
}
</script>

<php-snippet name="run-symfony.php" wp="none" blueprint="symfony-blueprint">
  <script type="application/x-php">
<?php
require '/app/symfony-package-radar/vendor/autoload.php';

use App\Kernel;
use Symfony\Component\HttpFoundation\Request;

$kernel = new Kernel( 'prod', false );
$request = Request::create( '/' );
$response = $kernel->handle( $request );

$page_title = get_first_h1_text( $response->getContent() );

echo 'HTTP ' . $response->getStatusCode() . PHP_EOL;
echo 'Symfony page: ' . $page_title . PHP_EOL;
echo 'WordPress installed: ';
echo file_exists( '/wordpress/wp-load.php' ) ? 'yes' : 'no';

$kernel->terminate( $request, $response );

/**
 * The app's Composer dependencies include the WordPress HTML API, so the
 * snippet can read the <h1> with WP_HTML_Processor without installing or
 * booting WordPress.
 */
function get_first_h1_text( string $html ): string {
	$processor = WP_HTML_Processor::create_fragment( $html );
	if ( ! $processor->next_tag( 'H1' ) ) {
		return 'unknown';
	}

	$text = '';
	while ( $processor->next_token() ) {
		if ( 'H1' === $processor->get_tag() && $processor->is_tag_closer() ) {
			break;
		}
		if ( '#text' === $processor->get_token_type() ) {
			$text .= $processor->get_modifiable_text();
		}
	}

	return trim( $text );
}
  </script>
  <script type="text/expected-output">
HTTP 200
Symfony page: Symfony Playground
WordPress installed: no
  </script>
</php-snippet>
```

<!-- prettier-ignore-end -->

<!--
The same app is also available as a full Playground page:
-->

આ જ એપ સંપૂર્ણ પ્લેગ્રાઉન્ડ પેજ તરીકે પણ ઉપલબ્ધ છે:

<!--
[Open the Symfony Package Radar demo](https://playground.wordpress.net/?blueprint-url=https%3A%2F%2Fwordpress.github.io%2Fblueprints%2Fblueprints%2Fsymfony-package-radar%2Fblueprint.json)
-->

[Symfony Package Radar ડેમો ખોલો](https://playground.wordpress.net/?blueprint-url=https%3A%2F%2Fwordpress.github.io%2Fblueprints%2Fblueprints%2Fsymfony-package-radar%2Fblueprint.json)

<!--
## Package the app as a ZIP
-->

## એપને ZIP તરીકે પેકેજ કરો

<!--
For framework demos, prefer a ZIP that already contains `vendor/`. That keeps
the Playground startup path short and avoids asking every visitor to wait for
Composer, Git, and package registry downloads. The Symfony demo uses that path to
bundle both Symfony and a Composer-installed copy of the WordPress HTML API; it
still does not include a WordPress install.
-->

ફ્રેમવર્ક ડેમો માટે, એવી ZIP પસંદ કરો જેમાં પહેલેથી `vendor/` હોય. આનાથી પ્લેગ્રાઉન્ડ ઝડપથી શરૂ થાય છે, અને દરેક મુલાકાતીને Composer, Git અને પેકેજ રજિસ્ટ્રીના ડાઉનલોડની રાહ જોવી પડતી નથી. Symfony ડેમો આ જ રીતે Symfony અને Composer વડે ઇન્સ્ટોલ કરેલી વર્ડપ્રેસ HTML API ની નકલ બંનેને બંડલ કરે છે; તેમ છતાં તેમાં વર્ડપ્રેસ ઇન્સ્ટોલ શામેલ નથી.

<!--
For snippets or CLI runs, a small Blueprint can install the app into `/app` with
one step:
-->

સ્નિપેટ્સ અથવા CLI રન માટે, એક નાની બ્લુપ્રિન્ટ ફક્ત એક સ્ટેપમાં એપને `/app` માં ઇન્સ્ટોલ કરી શકે છે:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/symfony-package-radar/public/index.php",
	"preferredVersions": {
		"php": "8.4",
		"wp": false
	},
	"features": {
		"networking": true
	},
	"steps": [
		{
			"step": "unzip",
			"zipFile": {
				"resource": "bundled",
				"path": "./symfony-package-radar.zip"
			},
			"extractToPath": "/app"
		}
	]
}
```

<!--
Use `bundled` resources when the ZIP ships next to `blueprint.json`, or use a
`url` resource when the ZIP is hosted separately. See [Blueprint bundles](/blueprints/bundles)
for packaging details.
-->

જ્યારે ZIP `blueprint.json` ની બાજુમાં જ હોય ત્યારે `bundled` રિસોર્સ વાપરો, અથવા ZIP અલગથી હોસ્ટ કરેલી હોય ત્યારે `url` રિસોર્સ વાપરો. પેકેજિંગની વિગતો માટે [બ્લુપ્રિન્ટ બંડલ્સ](/blueprints/bundles) જુઓ.

<!--
For a full-page Playground website, use a Blueprint like the gallery demo. It
adds a tiny router at the Playground document root so the Symfony `public/`
directory can respond to browser requests.
-->

સંપૂર્ણ પેજવાળી પ્લેગ્રાઉન્ડ વેબસાઇટ માટે, ગેલેરી ડેમો જેવી બ્લુપ્રિન્ટ વાપરો. તે પ્લેગ્રાઉન્ડના ડોક્યુમેન્ટ રૂટ (document root) પર એક નાનું રાઉટર (router) ઉમેરે છે, જેથી Symfony ની `public/` ડિરેક્ટરી બ્રાઉઝરની વિનંતીઓનો જવાબ આપી શકે.

<!--
## Keep the demo browser-friendly
-->

## ડેમોને બ્રાઉઝર-અનુકૂળ રાખો

<!--
A Playground-hosted framework demo works best when it:
-->

પ્લેગ્રાઉન્ડ પર ચાલતો ફ્રેમવર્ક ડેમો ત્યારે શ્રેષ્ઠ કામ કરે છે જ્યારે તે:

<!--
- Does not require a long-running background process.
- Stores generated files under the virtual filesystem.
- Avoids native extensions that are not compiled into PHP.wasm.
- Avoids frontend build steps at runtime.
- Keeps network calls optional or resilient, because browsers may require CORS
  proxying for third-party services.
-->

- લાંબા સમય સુધી ચાલતી બેકગ્રાઉન્ડ પ્રક્રિયા (background process) ની જરૂર ન રાખે.
- બનાવેલી ફાઇલો વર્ચ્યુઅલ ફાઇલસિસ્ટમમાં જ સાચવે.
- PHP.wasm માં કમ્પાઇલ ન થયેલા નેટિવ એક્સ્ટેન્શન્સ (native extensions) ટાળે.
- રનટાઇમ વખતે ફ્રન્ટએન્ડ બિલ્ડ સ્ટેપ્સ ટાળે.
- નેટવર્ક કૉલ્સને વૈકલ્પિક અથવા મજબૂત (resilient) રાખે, કારણ કે ત્રીજા પક્ષની સેવાઓ માટે બ્રાઉઝરને CORS પ્રોક્સીની જરૂર પડી શકે છે.

<!--
Those constraints still leave plenty of room for real framework behavior:
controllers, routing, dependency injection, templates, forms, HTTP clients, and
plain PHP libraries all work when their PHP dependencies are available.
-->

આ મર્યાદાઓ પછી પણ વાસ્તવિક ફ્રેમવર્ક માટે ઘણી જગ્યા રહે છે: કંટ્રોલર્સ, રાઉટિંગ, ડિપેન્ડન્સી ઇન્જેક્શન (dependency injection), ટેમ્પ્લેટ્સ, ફોર્મ્સ, HTTP ક્લાયન્ટ્સ અને સાદી PHP લાઇબ્રેરીઓ — જ્યારે તેમની PHP ડિપેન્ડન્સીઝ ઉપલબ્ધ હોય ત્યારે આ બધું કામ કરે છે.
