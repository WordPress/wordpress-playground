import type {
	BlueprintV1Declaration,
	BlueprintBundle,
	StepDefinition,
	BlueprintV1,
} from '@wp-playground/client';
import {
	getBlueprintDeclaration,
	isBlueprintBundle,
	resolveRemoteBlueprint,
} from '@wp-playground/client';
import { parseBlueprint } from './router';
import { OverlayFilesystem, InMemoryFilesystem } from '@wp-playground/storage';
import { RecommendedPHPVersion } from '@wp-playground/common';

export type BlueprintSource =
	| {
			type: 'remote-url';
			url: string;
	  }
	| {
			type: 'inline-string';
	  }
	| {
			type: 'none';
	  };

export type ResolvedBlueprint = {
	blueprint: BlueprintV1;
	source: BlueprintSource;
};

export async function resolveBlueprintFromURL(
	url: URL,
	defaultBlueprint?: string
): Promise<ResolvedBlueprint> {
	const query = url.searchParams;
	const fragment = decodeURI(url.hash || '#').substring(1);

	/**
	 * If the URL has no parameters or fragment, and a default blueprint is provided,
	 * use the default blueprint.
	 */
	if (
		window.self === window.top &&
		!query.size &&
		!fragment.length &&
		defaultBlueprint
	) {
		const content = `<!-- wp:cover {"url":"https://raw.githubusercontent.com/wordpress/blueprints/refs/heads/trunk/blueprints/welcome/assets/imgs/cover-image-playground.webp","id":77,"dimRatio":0,"isUserOverlayColor":true,"minHeight":850,"minHeightUnit":"px","isDark":false,"sizeSlug":"full","align":"full","layout":{"type":"constrained","contentSize":"1120px"}} -->
<div class="wp-block-cover alignfull is-light" style="min-height:800px"><img class="wp-block-cover__image-background wp-image-77 size-full" alt="" src="https://raw.githubusercontent.com/wordpress/blueprints/refs/heads/trunk/blueprints/welcome/assets/imgs/cover-image-playground.webp" style="object-position:50% 0%" data-object-fit="cover"/><span aria-hidden="true" class="wp-block-cover__background has-background-dim-0 has-background-dim"></span><div class="wp-block-cover__inner-container"><!-- wp:columns {"align":"wide"} -->
<div class="wp-block-columns alignwide"><!-- wp:column {"width":"50%"} -->
<div class="wp-block-column" style="flex-basis:50%"><!-- wp:heading {"textAlign":"left","level":1,"fontSize":"xx-large"} -->
<h1 class="wp-block-heading has-text-align-left has-xx-large-font-size">Hello from <mark style="background-color:rgba(0, 0, 0, 0);color:#3858e9" class="has-inline-color">WordPress Playground!</mark></h1>
<!-- /wp:heading -->

<!-- wp:group {"layout":{"type":"constrained"}} -->
<div class="wp-block-group"><!-- wp:paragraph {"align":"left","style":{"layout":{"selfStretch":"fixed","flexSize":"70%"}},"fontSize":"large"} -->
<p class="has-text-align-left has-large-font-size">This is Playground, a WordPress that runs client-side in your browser. It's perfect for training, demonstrating plugins and themes, and for testing purposes. </p>
<!-- /wp:paragraph -->

<!-- wp:paragraph {"align":"left","style":{"layout":{"selfStretch":"fixed","flexSize":"70%"}},"fontSize":"large"} -->
<p class="has-text-align-left has-large-font-size"><mark style="background-color:#f6e38f" class="has-inline-color">Note that you are logged-in as admin!</mark><br>Thus, you can modify this site as you like: edit content, install plugins and play around.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph {"align":"left","style":{"layout":{"selfStretch":"fixed","flexSize":"70%"}},"fontSize":"large"} -->
<p class="has-text-align-left has-large-font-size">To start over, simply reload the page!</p>
<!-- /wp:paragraph --></div>
<!-- /wp:group -->

<!-- wp:buttons {"layout":{"type":"flex","justifyContent":"left"}} -->
<div class="wp-block-buttons"><!-- wp:button {"style":{"border":{"radius":"0px"},"color":{"background":"#3858e9"},"typography":{"textTransform":"uppercase"}}} -->
<div class="wp-block-button"><a class="wp-block-button__link has-background wp-element-button" href="https://wordpress.github.io/wordpress-playground/" style="border-radius:0px;background-color:#3858e9;text-transform:uppercase" target="_blank" rel="noopener noreferrer">Discover the mission behind Playground</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons --></div>
<!-- /wp:column -->

<!-- wp:column {"width":"50%"} -->
<div class="wp-block-column" style="flex-basis:50%"></div>
<!-- /wp:column --></div>
<!-- /wp:columns --></div></div>
<!-- /wp:cover -->

<!-- wp:group {"metadata":{"categories":["about"],"name":"About","patternName":"assembler/about-1","patternCategory":"about","remotePatternId":13552},"align":"full","style":{"spacing":{"margin":{"top":"0","bottom":"var:preset|spacing|60"},"padding":{"top":"var:preset|spacing|60","bottom":"var:preset|spacing|60","left":"var:preset|spacing|40","right":"var:preset|spacing|40"},"blockGap":"var:preset|spacing|60"},"elements":{"link":{"color":{"text":"var:preset|color|base"}}}},"backgroundColor":"contrast","textColor":"base","layout":{"type":"constrained","justifyContent":"center","contentSize":"1120px"}} -->
<div class="wp-block-group alignfull has-base-color has-contrast-background-color has-text-color has-background has-link-color" id="about-section" style="margin-top:0;margin-bottom:var(--wp--preset--spacing--60);padding-top:var(--wp--preset--spacing--60);padding-right:var(--wp--preset--spacing--40);padding-bottom:var(--wp--preset--spacing--60);padding-left:var(--wp--preset--spacing--40)"><!-- wp:columns -->
<div class="wp-block-columns"><!-- wp:column {"width":"50%"} -->
<div class="wp-block-column" style="flex-basis:50%"><!-- wp:html -->
<iframe width="560" height="315" src="https://www.youtube.com/embed/HWPSYWGY0YA?si=EFEzzWw3YI8vNSbd" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen style="aspect-ratio: 16 / 9; max-height: 100%; max-width: 100%;"></iframe>
<!-- /wp:html --></div>
<!-- /wp:column -->

<!-- wp:column {"width":"50%"} -->
<div class="wp-block-column" style="flex-basis:50%"><!-- wp:group {"layout":{"type":"constrained"}} -->
<div class="wp-block-group"><!-- wp:heading -->
<h2 class="wp-block-heading">What is WordPress Playground?</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>WordPress Playground allows users to experiment and build websites directly within a browser, eliminating the need for local setup. </p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>By leveraging WebAssembly (WASM), it offers a seamless and secure environment that replicates a traditional hosting experience and streamlining workflows.</p>
<!-- /wp:paragraph --></div>
<!-- /wp:group --></div>
<!-- /wp:column --></div>
<!-- /wp:columns --></div>
<!-- /wp:group -->

<!-- wp:group {"metadata":{"name":"Blueprints Gallery","patternCategory":"general","remotePatternId":"14727-general"},"align":"full","style":{"spacing":{"margin":{"top":"0","bottom":"var:preset|spacing|60"},"padding":{"top":"var:preset|spacing|20","bottom":"var:preset|spacing|20","left":"var:preset|spacing|20","right":"var:preset|spacing|20"},"blockGap":"var:preset|spacing|40"}},"layout":{"type":"constrained","justifyContent":"center","contentSize":"1120px"}} -->
<div class="wp-block-group alignfull" id="blueprints-gallery" style="margin-top:0;margin-bottom:var(--wp--preset--spacing--60);padding-top:var(--wp--preset--spacing--20);padding-right:var(--wp--preset--spacing--20);padding-bottom:var(--wp--preset--spacing--20);padding-left:var(--wp--preset--spacing--20)"><!-- wp:group {"align":"wide","style":{"spacing":{"padding":{"right":"24px"}}},"layout":{"type":"default"}} -->
<div class="wp-block-group alignwide" style="padding-right:24px"><!-- wp:heading {"align":"wide"} -->
<h2 class="wp-block-heading alignwide">Explore Blueprints Gallery</h2>
<!-- /wp:heading -->

<!-- wp:paragraph {"align":"left","style":{"layout":{"selfStretch":"fixed","flexSize":"70%"}}} -->
<p class="has-text-align-left">With Blueprints you can run a WordPress instance with a pre-defined content. The following examples displays what you can achieve with WordPress Playground + Blueprints.</p>
<!-- /wp:paragraph --></div>
<!-- /wp:group -->

<!-- wp:columns {"verticalAlignment":"center","align":"wide","style":{"spacing":{"blockGap":{"top":"var:preset|spacing|60","left":"32px"}}}} -->
<div class="wp-block-columns alignwide are-vertically-aligned-center"><!-- wp:column {"verticalAlignment":"center","width":"33.33%"} -->
<div class="wp-block-column is-vertically-aligned-center" style="flex-basis:33.33%"><!-- wp:image {"lightbox":{"enabled":false},"sizeSlug":"large","linkDestination":"custom"} -->
<figure class="wp-block-image size-large"><a href="https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/WordPress/blueprints/refs/heads/trunk/blueprints/stylish-press/blueprint.json" target="_blank" rel="noopener noreferrer"><img src="https://raw.githubusercontent.com/WordPress/blueprints/refs/heads/trunk/blueprints/welcome/assets/imgs/thumbnail-playground-1.webp" alt="handyman tools and equipment arranged neatly on a workbench, with a professional and approachable look"/></a><figcaption class="wp-element-caption"><a href="https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/WordPress/blueprints/refs/heads/trunk/blueprints/stylish-press/blueprint.json" target="_blank" rel="noopener noreferrer">StylishPress</a></figcaption></figure>
<!-- /wp:image --></div>
<!-- /wp:column -->

<!-- wp:column {"verticalAlignment":"center","width":"33.33%"} -->
<div class="wp-block-column is-vertically-aligned-center" style="flex-basis:33.33%"><!-- wp:image {"lightbox":{"enabled":false},"sizeSlug":"large","linkDestination":"custom"} -->
<figure class="wp-block-image size-large"><a href="https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/WordPress/blueprints/refs/heads/trunk/blueprints/woo-shipping/blueprint.json" target="_blank" rel="noopener noreferrer"><img src="https://raw.githubusercontent.com/WordPress/blueprints/refs/heads/trunk/blueprints/welcome/assets/imgs/thumbnail-playground-2.webp" alt="ecommerce store concept, showcasing online shopping with cart, products, and digital elements"/></a><figcaption class="wp-element-caption"><a href="https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/WordPress/blueprints/refs/heads/trunk/blueprints/woo-shipping/blueprint.json" target="_blank" rel="noopener noreferrer">Woocommerce Store</a></figcaption></figure>
<!-- /wp:image --></div>
<!-- /wp:column -->

<!-- wp:column {"verticalAlignment":"center","width":"33.33%"} -->
<div class="wp-block-column is-vertically-aligned-center" style="flex-basis:33.33%"><!-- wp:image {"lightbox":{"enabled":false},"sizeSlug":"large","linkDestination":"custom"} -->
<figure class="wp-block-image size-large"><a href="https://playground.wordpress.net/?blank" target="_blank" rel="noopener noreferrer"><img src="https://raw.githubusercontent.com/WordPress/blueprints/refs/heads/trunk/blueprints/welcome/assets/imgs/thumbnail-playground-3.webp" alt="a white room with a canvas displaying a drawing of a website wireframe, representing a blank canvas website concept"/></a><figcaption class="wp-element-caption"><a href="https://playground.wordpress.net/?blank" target="_blank" rel="noopener noreferrer">Blank Canvas</a></figcaption></figure>
<!-- /wp:image --></div>
<!-- /wp:column --></div>
<!-- /wp:columns -->

<!-- wp:paragraph {"align":"center","style":{"layout":{"selfStretch":"fixed","flexSize":"70%"}}} -->
<p class="has-text-align-center">The Playground community created a directory of blueprint examples, from making posts with <code>wp-cli</code> to showcasing plugins with media. Check out the link below to learn more.</p>
<!-- /wp:paragraph -->

<!-- wp:buttons {"layout":{"type":"flex","justifyContent":"center"}} -->
<div class="wp-block-buttons"><!-- wp:button {"style":{"border":{"radius":"0px"},"color":{"background":"#3858e9"},"typography":{"textTransform":"uppercase"}}} -->
<div class="wp-block-button"><a class="wp-block-button__link has-background wp-element-button" href="https://blueprintlibrary.wordpress.com/" style="border-radius:0px;background-color:#3858e9;text-transform:uppercase" target="_blank" rel="noopener noreferrer">Blueprints Library</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons --></div>
<!-- /wp:group -->

<!-- wp:group {"metadata":{"categories":["about"],"name":"Playground Users","patternName":"assembler/about-1","patternCategory":"about","remotePatternId":13552},"align":"full","style":{"spacing":{"margin":{"top":"0","bottom":"var:preset|spacing|60"},"padding":{"top":"var:preset|spacing|60","bottom":"var:preset|spacing|60","left":"var:preset|spacing|40","right":"var:preset|spacing|40"},"blockGap":"var:preset|spacing|60"},"elements":{"link":{"color":{"text":"var:preset|color|base"}}}},"backgroundColor":"contrast","textColor":"base","layout":{"type":"constrained","justifyContent":"center","contentSize":"1120px"}} -->
<div class="wp-block-group alignfull has-base-color has-contrast-background-color has-text-color has-background has-link-color" id="playground-users" style="margin-top:0;margin-bottom:var(--wp--preset--spacing--60);padding-top:var(--wp--preset--spacing--60);padding-right:var(--wp--preset--spacing--40);padding-bottom:var(--wp--preset--spacing--60);padding-left:var(--wp--preset--spacing--40)"><!-- wp:group {"layout":{"type":"constrained"}} -->
<div class="wp-block-group"><!-- wp:heading {"textAlign":"center"} -->
<h2 class="wp-block-heading has-text-align-center">How Can WordPress Playground Be Useful to Me?</h2>
<!-- /wp:heading -->

<!-- wp:paragraph {"align":"center"} -->
<p class="has-text-align-center">You've heard about WordPress Playground, but you’re still not sure how it can benefit you? Let’s find out together!</p>
<!-- /wp:paragraph -->

<!-- wp:details {"showContent":true,"align":"wide","fontSize":"large"} -->
<details class="wp-block-details alignwide has-large-font-size" open><summary>I’m a Theme Author</summary><!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading">Showcase</h3>
<!-- /wp:heading -->

<!-- wp:paragraph {"fontSize":"medium"} -->
<p class="has-medium-font-size">As a theme author, WordPress Playground provides a platform to showcase your themes effortlessly. Visitors can experience your design in a live environment without needing a separate installation, which makes it easier for you to attract potential users.</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading">Test</h3>
<!-- /wp:heading -->

<!-- wp:paragraph {"placeholder":"Type / to add a hidden block","fontSize":"medium"} -->
<p class="has-medium-font-size">You can test your theme's responsiveness and compatibility across different devices and WordPress versions. WordPress Playground allows you to make adjustments in real-time and see how your theme looks and behaves with various settings and plugins.</p>
<!-- /wp:paragraph --></details>
<!-- /wp:details -->

<!-- wp:separator {"align":"wide"} -->
<hr class="wp-block-separator alignwide has-alpha-channel-opacity"/>
<!-- /wp:separator -->

<!-- wp:details {"align":"wide","fontSize":"large"} -->
<details class="wp-block-details alignwide has-large-font-size"><summary>I’m a Plugin Author</summary><!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading">Showcase</h3>
<!-- /wp:heading -->

<!-- wp:paragraph {"fontSize":"medium"} -->
<p class="has-medium-font-size">If you're developing or maintaining plugins, WordPress Playground can help you showcase your plugin, allowing you to convince future users to choose your plugin by trying it out without you having to maintain any infrastructure.</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading">Test</h3>
<!-- /wp:heading -->

<!-- wp:paragraph {"placeholder":"Type / to add a hidden block","fontSize":"medium"} -->
<p class="has-medium-font-size">You can spin up your plugin in different environments to figure out how it interacts with other plugins, confirm and try your onboarding flow, or use Playwright for end-to-end testing of your plugin.</p>
<!-- /wp:paragraph --></details>
<!-- /wp:details -->

<!-- wp:separator {"align":"wide"} -->
<hr class="wp-block-separator alignwide has-alpha-channel-opacity"/>
<!-- /wp:separator -->

<!-- wp:details {"align":"wide","fontSize":"large"} -->
<details class="wp-block-details alignwide has-large-font-size"><summary>I’m a WordPress Site Owner</summary><!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading">Experiment</h3>
<!-- /wp:heading -->

<!-- wp:paragraph {"fontSize":"medium"} -->
<p class="has-medium-font-size">As a WordPress site owner, WordPress Playground lets you experiment with new features, themes, and plugins in a risk-free environment. You can explore enhancements without fear of breaking your live site, giving you the confidence to try new ideas.</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading">Validate</h3>
<!-- /wp:heading -->

<!-- wp:paragraph {"placeholder":"Type / to add a hidden block","fontSize":"medium"} -->
<p class="has-medium-font-size">You can validate changes or updates before applying them to your live site, ensuring that everything works as intended. Whether it’s testing a new plugin or trying out a new theme, WordPress Playground helps you make informed decisions.</p>
<!-- /wp:paragraph --></details>
<!-- /wp:details -->

<!-- wp:separator {"align":"wide"} -->
<hr class="wp-block-separator alignwide has-alpha-channel-opacity"/>
<!-- /wp:separator -->

<!-- wp:details {"align":"wide","fontSize":"large"} -->
<details class="wp-block-details alignwide has-large-font-size"><summary>I’m a WordPress User</summary><!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading">Learn</h3>
<!-- /wp:heading -->

<!-- wp:paragraph {"fontSize":"medium"} -->
<p class="has-medium-font-size">If you're exploring WordPress for the first time or looking to enhance your skills, the WordPress Playground is an excellent learning tool. You can practice working with WordPress like trying the Site Editor and gain hands-on experience, all without any risk to a live site.</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading">Build</h3>
<!-- /wp:heading -->

<!-- wp:paragraph {"placeholder":"Type / to add a hidden block","fontSize":"medium"} -->
<p class="has-medium-font-size">Create a personal demo site to experiment with widgets, settings, and layouts. This sandbox environment allows you to get comfortable with WordPress, helping you understand how to make the most of the platform for your own projects. You can then export your site to share it with others.</p>
<!-- /wp:paragraph --></details>
<!-- /wp:details --></div>
<!-- /wp:group --></div>
<!-- /wp:group -->

<!-- wp:group {"metadata":{"name":"Playground CLI","patternCategory":"general","remotePatternId":"14727-general"},"align":"full","style":{"spacing":{"margin":{"top":"0","bottom":"var:preset|spacing|60"},"padding":{"top":"var:preset|spacing|20","bottom":"var:preset|spacing|20","left":"var:preset|spacing|20","right":"var:preset|spacing|20"},"blockGap":"var:preset|spacing|40"}},"layout":{"type":"constrained","justifyContent":"center","contentSize":"1120px"}} -->
<div class="wp-block-group alignfull" id="playground-cli" style="margin-top:0;margin-bottom:var(--wp--preset--spacing--60);padding-top:var(--wp--preset--spacing--20);padding-right:var(--wp--preset--spacing--20);padding-bottom:var(--wp--preset--spacing--20);padding-left:var(--wp--preset--spacing--20)"><!-- wp:group {"align":"wide","style":{"spacing":{"padding":{"right":"var:preset|spacing|60","top":"var:preset|spacing|60","bottom":"var:preset|spacing|60","left":"var:preset|spacing|60"}},"color":{"background":"#f6f6f6"}},"layout":{"type":"default"}} -->
<div class="wp-block-group alignwide has-background" style="background-color:#f6f6f6;padding-top:var(--wp--preset--spacing--60);padding-right:var(--wp--preset--spacing--60);padding-bottom:var(--wp--preset--spacing--60);padding-left:var(--wp--preset--spacing--60)"><!-- wp:heading {"align":"wide"} -->
<h2 class="wp-block-heading alignwide">Run Playground in your terminal</h2>
<!-- /wp:heading -->

<!-- wp:paragraph {"align":"left","style":{"layout":{"selfStretch":"fixed","flexSize":"70%"}}} -->
<p class="has-text-align-left">Beyond the browser, WordPress Playground is also available as a <a href="https://www.npmjs.com/package/@wp-playground/cli" target="_blank" rel="noopener noreferrer">local CLI tool</a> for developers to build their plugins, themes, and run test automations.</p>
<!-- /wp:paragraph -->

<!-- wp:code {"style":{"elements":{"link":{"color":{"text":"var:preset|color|accent-4"}}}},"backgroundColor":"accent-5","textColor":"accent-4"} -->
<pre class="wp-block-code has-accent-4-color has-accent-5-background-color has-text-color has-background has-link-color"><code>$ npx @wp-playground/cli@latest server</code></pre>
<!-- /wp:code -->

<!-- wp:buttons -->
<div class="wp-block-buttons"><!-- wp:button {"style":{"border":{"radius":"0px"},"color":{"background":"#3858e9"},"typography":{"textTransform":"uppercase"}}} -->
<div class="wp-block-button"><a class="wp-block-button__link has-background wp-element-button" href="https://wordpress.github.io/wordpress-playground/developers/local-development/wp-playground-cli" style="border-radius:0px;background-color:#3858e9;text-transform:uppercase" target="_blank" rel="noreferrer noopener">Learn More</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons --></div>
<!-- /wp:group --></div>
<!-- /wp:group -->

<!-- wp:cover {"url":"https://raw.githubusercontent.com/wordpress/blueprints/refs/heads/trunk/blueprints/welcome/assets/imgs/cover-image-playground-2.webp","id":80,"dimRatio":0,"overlayColor":"base","isUserOverlayColor":true,"isDark":false,"sizeSlug":"full","align":"full","style":{"spacing":{"margin":{"top":"0","bottom":"0"},"padding":{"top":"0","bottom":"0"}}},"layout":{"type":"constrained","contentSize":"1120px"}} -->
<div class="wp-block-cover alignfull is-light" style="margin-top:0;margin-bottom:0;padding-top:0;padding-bottom:0" id="php-playground"><img class="wp-block-cover__image-background wp-image-80 size-full" alt="" src="https://raw.githubusercontent.com/wordpress/blueprints/refs/heads/trunk/blueprints/welcome/assets/imgs/cover-image-playground-2.webp" data-object-fit="cover"/><span aria-hidden="true" class="wp-block-cover__background has-base-background-color has-background-dim-0 has-background-dim"></span><div class="wp-block-cover__inner-container"><!-- wp:columns {"align":"wide"} -->
<div class="wp-block-columns alignwide"><!-- wp:column -->
<div class="wp-block-column"></div>
<!-- /wp:column -->

<!-- wp:column {"width":"40%"} -->
<div class="wp-block-column" style="flex-basis:40%"><!-- wp:heading {"textAlign":"right"} -->
<h2 class="wp-block-heading has-text-align-right">Test Our Brand New<br><em><mark style="background-color:rgba(0, 0, 0, 0);color:#3858e9" class="has-inline-color">PHP Playground</mark></em></h2>
<!-- /wp:heading -->

<!-- wp:paragraph {"align":"right"} -->
<p class="has-text-align-right">This sandbox lets you write, test, and debug code directly from the client-side, which enables instant, shareable, and safe code prototyping in a way that wasn't previously possible.</p>
<!-- /wp:paragraph -->

<!-- wp:buttons {"layout":{"type":"flex","justifyContent":"right"}} -->
<div class="wp-block-buttons"><!-- wp:button {"style":{"border":{"radius":"0px"},"color":{"background":"#3858e9"},"typography":{"textTransform":"uppercase"}}} -->
<div class="wp-block-button"><a class="wp-block-button__link has-background wp-element-button" href="https://playground.wordpress.net/php-playground.html" style="border-radius:0px;background-color:#3858e9;text-transform:uppercase" target="_blank" rel="noopener noreferrer">Go to PHP playground</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons --></div>
<!-- /wp:column --></div>
<!-- /wp:columns --></div></div>
<!-- /wp:cover -->

<!-- wp:html -->
<style>
#wp-block-post-title,
.wp-block-post-title { display: none; }
main.wp-block-group { margin-top: 0px !important; padding-top: 0px !important; }

@font-face {
    font-family: 'EB Garamond';
    src: url('https://raw.githubusercontent.com/WordPress/blueprints/refs/heads/trunk/blueprints/welcome/assets/fonts/ebgaramond-regular.ttf') format('truetype');
    font-weight: normal;
    font-style: normal;
}

@font-face {
    font-family: 'Inter';
    src: url('https://raw.githubusercontent.com/WordPress/blueprints/refs/heads/trunk/blueprints/welcome/assets/fonts/inter-regular.ttf') format('truetype');
    font-weight: normal;
    font-style: normal;
}

.wp-site-blocks > main {
    color: var(--wp--preset--color--accent-4) !important;
    font-style: normal !important;
    font-weight: 300 !important;
    font-size: var(--wp--preset--font-size--medium) !important;
    letter-spacing: 0px !important;
    font-family: "Inter" !important;
    line-height: 1.5 !important;

	.wp-block-button__link {
		border-radius: 2px !important;
		font-family: var(--wp--preset--font-family--manrope) !important;
		text-transform: uppercase !important;
		font-style: normal !important;
		font-weight: 600 !important;
		background-color: #3858e9 !important;
	}

	button {
		background-color: #3858e9 !important;
		text-transform: none !important;
	}


	h1, h2, h3, h4, h5, h6 {
		font-style: normal !important;
		font-weight: 400 !important;
		font-family: "EB Garamond" !important;
		text-transform: none !important;
		line-height: 1.5 !important;
		letter-spacing: 0px !important;
	}

	#playground-cli .wp-block-heading,
	#blueprints-gallery .wp-block-heading {
		color: #000;
	}
}

.wp-block-button__link:hover {
    background-color: var(--wp--preset--color--contrast) !important;
    color: #3858e9 !important;
}

:where(.wp-site-blocks) > footer.wp-block-template-part {
    margin-block-start: 0 !important;
}

</style>
<!-- /wp:html -->`;

		return {
			blueprint: {
				steps: [
					{
						step: 'runPHPWithOptions',
						options: {
							code: `<?php 
							require_once '/wordpress/wp-load.php';
							$content = getenv('CONTENT');

							// Insert the post exactly as it is
							remove_all_filters('content_save_pre');
							remove_all_filters('content_filtered_save_pre');
							remove_all_filters('excerpt_save_pre');
							remove_all_filters('pre_comment_content');
							remove_all_filters('pre_user_description');

							$homepage_id = get_option('page_on_front');
							if ($homepage_id) {
								wp_update_post([
									'ID' => $homepage_id,
									'post_content' => $content,
									'post_title' => 'Hello from WordPress Playground!',
								]);
							} else {
								$homepage_id = wp_insert_post([
									'post_title' => 'Hello from WordPress Playground!',
									'post_content' => $content,
									'post_status' => 'publish',
									'post_type' => 'page',
								]);
								update_option('page_on_front', $homepage_id);
							}
							update_option('show_on_front', 'page');

							// @TODO: What if the homepage is not set, e.g. posts list?
							?>`,
							env: {
								CONTENT: content,
							},
						},
					},
				],
			}, //await resolveRemoteBlueprint(defaultBlueprint),
			source: {
				type: 'remote-url',
				url: defaultBlueprint,
			},
		};
	} else if (query.has('blueprint-url')) {
		/*
		 * Support passing blueprints via query parameter, e.g.:
		 * ?blueprint-url=https://example.com/blueprint.json
		 */
		return {
			blueprint: await resolveRemoteBlueprint(
				query.get('blueprint-url')!
			),
			source: {
				type: 'remote-url',
				url: query.get('blueprint-url')!,
			},
		};
	} else if (fragment.length) {
		/*
		 * Support passing blueprints in the URI fragment, e.g.:
		 * /#{"landingPage": "/?p=4"}
		 */
		return {
			blueprint: parseBlueprint(fragment),
			source: {
				type: 'inline-string',
			},
		};
	} else {
		const importWxrQueryArg =
			query.get('import-wxr') || query.get('import-content');

		// This Blueprint is intentionally missing most query args (like login).
		// They are added below to ensure they're also applied to Blueprints passed
		// via the hash fragment (#{...}) or via the `blueprint-url` query param.
		return {
			blueprint: {
				plugins: query.getAll('plugin'),
				steps: [
					importWxrQueryArg &&
						/^(http(s?)):\/\//i.test(importWxrQueryArg) &&
						({
							step: 'importWxr',
							file: {
								resource: 'url',
								url: importWxrQueryArg,
							},
						} as StepDefinition),
					query.get('import-site') &&
						/^(http(s?)):\/\//i.test(query.get('import-site')!) &&
						({
							step: 'importWordPressFiles',
							wordPressFilesZip: {
								resource: 'url',
								url: query.get('import-site')!,
							},
						} as StepDefinition),
					...query.getAll('theme').map(
						(theme, index, themes) =>
							({
								step: 'installTheme',
								themeData: {
									resource: 'wordpress.org/themes',
									slug: theme,
								},
								options: {
									// Activate only the last theme in the list.
									activate: index === themes.length - 1,
								},
								progress: { weight: 2 },
							} as StepDefinition)
					),
				].filter(Boolean),
			},
			source: {
				type: 'none',
			},
		};
	}
}

export async function applyQueryOverrides(
	blueprint: BlueprintV1Declaration | BlueprintBundle,
	query: URLSearchParams
): Promise<BlueprintV1Declaration | BlueprintBundle> {
	/**
	 * Allow overriding PHP and WordPress versions defined in a Blueprint
	 * via query params.
	 */
	if (isBlueprintBundle(blueprint)) {
		let blueprintObject = await getBlueprintDeclaration(blueprint);
		blueprintObject = applyQueryOverridesToDeclaration(
			blueprintObject,
			query
		);
		return new OverlayFilesystem([
			new InMemoryFilesystem({
				'blueprint.json': JSON.stringify(blueprintObject),
			}),
			blueprint,
		]);
	} else {
		return applyQueryOverridesToDeclaration(blueprint, query);
	}
}

function applyQueryOverridesToDeclaration(
	blueprint: BlueprintV1Declaration,
	query: URLSearchParams
): BlueprintV1Declaration {
	/**
	 * Allow overriding PHP and WordPress versions defined in a Blueprint
	 * via query params.
	 */
	if (!blueprint.preferredVersions) {
		blueprint.preferredVersions = {} as any;
	}
	blueprint.preferredVersions!.php =
		(query.get('php') as any) ||
		blueprint.preferredVersions!.php ||
		RecommendedPHPVersion;
	blueprint.preferredVersions!.wp =
		query.get('wp') || blueprint.preferredVersions!.wp || 'latest';

	// Features
	if (!blueprint.features) {
		blueprint.features = {};
	}

	/**
	 * Networking is enabled by default, so we only need to disable it
	 * if the query param is explicitly set to something other than "yes".
	 */
	if (query.get('networking') && query.get('networking') !== 'yes') {
		blueprint.features['networking'] = false;
	}

	// Language
	if (query.get('language')) {
		if (
			!blueprint?.steps?.find(
				(step) => step && (step as any).step === 'setSiteLanguage'
			)
		) {
			blueprint.steps?.push({
				step: 'setSiteLanguage',
				language: query.get('language')!,
			});
		}
	}

	// Multisite
	if (query.get('multisite') === 'yes') {
		if (
			!blueprint?.steps?.find(
				(step) => step && (step as any).step === 'enableMultisite'
			)
		) {
			blueprint.steps?.push({
				step: 'enableMultisite',
			});
		}
	}

	// Login
	if (query.get('login') !== 'no') {
		blueprint.login = true;
	}

	// Landing page
	if (query.get('url')) {
		blueprint.landingPage = query.get('url')!;
	}

	/*
	 * The 6.3 release includes a caching bug where
	 * registered styles aren't enqueued when they
	 * should be. This isn't present in all environments
	 * but it does here in the Playground. For now,
	 * the fix is to define `WP_DEVELOPMENT_MODE = all`
	 * to bypass the style cache.
	 *
	 * @see https://core.trac.wordpress.org/ticket/59056
	 */
	if (blueprint.preferredVersions?.wp === '6.3') {
		blueprint.steps?.unshift({
			step: 'defineWpConfigConsts',
			consts: {
				WP_DEVELOPMENT_MODE: 'all',
			},
		});
	}

	if (query.has('core-pr')) {
		const prNumber = query.get('core-pr');
		blueprint.preferredVersions!.wp = `https://playground.wordpress.net/plugin-proxy.php?org=WordPress&repo=wordpress-develop&workflow=Test%20Build%20Processes&artifact=wordpress-build-${prNumber}&pr=${prNumber}`;
	}

	if (query.has('gutenberg-pr')) {
		const prNumber = query.get('gutenberg-pr');
		blueprint.steps = blueprint.steps || [];
		blueprint.steps.unshift(
			{
				step: 'mkdir',
				path: '/tmp/pr',
			},
			{
				step: 'writeFile',
				path: '/tmp/pr/pr.zip',
				data: {
					resource: 'url',
					url: `/plugin-proxy.php?org=WordPress&repo=gutenberg&workflow=Build%20Gutenberg%20Plugin%20Zip&artifact=gutenberg-plugin&pr=${prNumber}`,
					caption: `Downloading Gutenberg PR ${prNumber}`,
				},
			},
			/**
			 * GitHub CI artifacts are doubly zipped:
			 *
			 * pr.zip
			 *    gutenberg.zip
			 *       gutenberg.php
			 *       ... other files ...
			 *
			 * This step extracts the inner zip file so that we get
			 * access directly to gutenberg.zip and can use it to
			 * install the plugin.
			 */
			{
				step: 'unzip',
				zipPath: '/tmp/pr/pr.zip',
				extractToPath: '/tmp/pr',
			},
			{
				step: 'installPlugin',
				pluginData: {
					resource: 'vfs',
					path: '/tmp/pr/gutenberg.zip',
				},
			}
		);
	}

	return blueprint;
}
