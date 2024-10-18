<?php

use PHPUnit\Framework\TestCase;

class WPRewriteUrlsTests extends TestCase {

	/**
	 *
	 * @dataProvider provider_test_wp_rewrite_urls
	 */
	public function test_wp_rewrite_urls(
		$original_markup,
		$expected_markup,
		$current_site_url,
		$new_site_url
	) {
		$result = wp_rewrite_urls( array(
			'block_markup' => $original_markup,
			'current-site-url' => $current_site_url,
			'new-site-url' => $new_site_url,
		) );
		$this->assertEquals( $expected_markup, $result, 'Failed to migrate the URLs in the block markup' );
	}

	static public function provider_test_wp_rewrite_urls() {
		return [
			'Domain in a block attribute' => [ 
				'<!-- wp:image {"src": "http://legacy-blog.com/image.jpg"} -->',
				'<!-- wp:image {"src":"https:\/\/modern-webstore.org\/image.jpg"} -->',
				'https://legacy-blog.com',
				'https://modern-webstore.org'
			],
			'Domain in a block attribute expressed with JSON UTF-8 escape sequences' => [ 
				'<!-- wp:image {"src": "https:\/\/\u006c\u0065\u0067\u0061\u0063y-bl\u006fg.\u0063\u006fm/wp-content/image.png"} -->',
				'<!-- wp:image {"src":"https:\/\/modern-webstore.org\/wp-content\/image.png"} -->',
				'https://legacy-blog.com',
				'https://modern-webstore.org'
			],
			'Domain in an HTML attribute semantically expressing a URL' => [ 
				<<<HTML
				<a href="https://legacy-blog.com/contact-us/">Contact us</a>
				<img src="https://legacy-blog.com/wp-content/assets/image.jpg">
				<link rel="stylesheet" href="https://legacy-blog.com/style.css">
				<script src="https://legacy-blog.com/main.js"></script>
				HTML,
				<<<HTML
				<a href="https://modern-webstore.org/contact-us/">Contact us</a>
				<img src="https://modern-webstore.org/wp-content/assets/image.jpg">
				<link rel="stylesheet" href="https://modern-webstore.org/style.css">
				<script src="https://modern-webstore.org/main.js"></script>
				HTML,
				'https://legacy-blog.com',
				'https://modern-webstore.org'
			],
			'Path in an HTML attribute semantically expressing a URL – source path has no trailing slash' => [ 
				'<a href="/~jappleseed/1997.10.1/nuclear-fusion/">Nuclear fusion</a>',
				'<a href="/blog/nuclear-fusion/">Nuclear fusion</a>',
				'https://legacy-blog.com/~jappleseed/1997.10.1',
				'https://modern-webstore.org/blog/'
			],
			'Path in an HTML attribute semantically expressing a URL – source path has a trailing slash' => [ 
				'<a href="/~jappleseed/1997.10.1/nuclear-fusion/">Nuclear fusion</a>',
				'<a href="/blog/nuclear-fusion/">Nuclear fusion</a>',
				'https://legacy-blog.com/~jappleseed/1997.10.1/',
				'https://modern-webstore.org/blog/'
			],
			'Domain in an HTML attribute – encoded using HTML entities' => [ 
				'<a href="&#104;&#116;tps://&#108;&#101;g&#97;&#99;&#121;&#45;&#98;&#108;&#111;&#103;.&#99;&#111;&#109;/pages/contact-us">Contact us</a>',
				'<a href="https://modern-webstore.org/pages/contact-us">Contact us</a>',
				'https://legacy-blog.com',
				'https://modern-webstore.org'
			],
			// 'Domain in an HTML attribute semantically expressing text' => [  
			// 	'<img alt="Johnny Appleseed, the founder of https://legacy-blog.com/">',
			// 	'<img alt="Johnny Appleseed, the founder of https://modern-webstore.org/">',
			// 	'https://legacy-blog.com',
			// 	'https://modern-webstore.org'
			// ],
			// @TODO Is that actually a thing? Can we distinguish between "special tokens"
			//       (such as CSS classes) and "text" (such as the alt attribute)?
			// 'Ignores domains in HTML attributes semantically expressing data different that text or URLs' => [ 
			// 	'<h1 class="https://legacy-blog.com/">CSS quirks – anything can be a class</h1>',
			// 	'<h1 class="https://legacy-blog.com/">CSS quirks – anything can be a class</h1>',
			// 	'https://legacy-blog.com',
			// 	'https://modern-webstore.org'
			// ],
			"Domain in a regular text snippet – preceeded by a protocol" => [ 
				'Join the team at https://legacy-blog.com/we-are-hiring',
				'Join the team at https://modern-webstore.org/we-are-hiring',
				'https://legacy-blog.com',
				'https://modern-webstore.org'
			],
			"Domain in a regular text snippet – not preceeded by a protocol" => [ 
				'Join the team at legacy-blog.com/we-are-hiring',
				'Join the team at modern-webstore.org/we-are-hiring',
				'https://legacy-blog.com',
				'https://modern-webstore.org'
			],
			'Domain in a regular text snippet – preceeded by a protocol – encoded using HTML entities' => [ 
				'Join the team at https://&#108;&#101;g&#97;&#99;&#121;&#45;&#98;&#108;&#111;&#103;.&#99;&#111;&#109;/pages/contact-us',
				'Join the team at https://modern-webstore.org/pages/contact-us',
				'https://legacy-blog.com',
				'https://modern-webstore.org'
			],
			'Domain in a regular text snippet – no protocol – encoded using HTML entities' => [ 
				'Join the team at &#108;&#101;g&#97;&#99;&#121;&#45;&#98;&#108;&#111;&#103;.&#99;&#111;&#109;/pages/contact-us',
				'Join the team at modern-webstore.org/pages/contact-us',
				'https://legacy-blog.com',
				'https://modern-webstore.org'
			],
			"Ignores lookalikes: retains legacy-blog.comdot in a regular text snippet when migrating legacy-blog.com" => [
				'Join the team at legacy-blog.comdot/we-are-hiring',
				'Join the team at legacy-blog.comdot/we-are-hiring',
				'https://legacy-blog.com',
				'https://modern-webstore.org'
			],
		];
	}


	/**
	 *
	 * @dataProvider provider_diverse_domains
	 */
	public function test_wp_rewrite_url_migrates_domains_in_a_href(
		$domain_for_markup,
		$domain_for_lookup = null
	) {
		$current_site_url = $domain_for_lookup ? "https://$domain_for_lookup" : "https://$domain_for_markup";
		$new_site_url = "https://wordpress.org";
		$result = wp_rewrite_urls( array(
			'block_markup' => "<a href=\"$current_site_url/about-us/\"></a>",
			'current-site-url' => $current_site_url,
			'new-site-url' => $new_site_url,
		) );
		$this->assertEquals( "<a href=\"$new_site_url/about-us/\"></a>", $result, 'Failed to migrate the domain found in <a href=""></a>' );
	}

	static public function provider_diverse_domains() {
		return [
			"Regular ascii" => [ 'rocket-science.com' ],
			"Prefixed with an emoji" => [ '🚀-science.com' ],
			"Emoji-only – lookup by emoji notation" => [ '🚀.com', '🚀.com' ],
			"Emoji-only – lookup by punycode notation" => [ '🚀.com', 'xn---science-7f85g.com' ],
			"Punycode-encoded – lookup by punycode notation" => [ 'xn---science-7f85g.com', 'xn---science-7f85g.com' ],
			"Punycode-encoded – lookup by emoji notation" => [ 'xn---science-7f85g.com', '🚀.com' ],
		];
	}
}
