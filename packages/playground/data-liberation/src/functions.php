<?php

/**
 * Migrate URLs in post content. See WPRewriteUrlsTests for
 * specific examples. TODO: A better description.
 *
 * Example:
 *
 * ```php
 * php > wp_rewrite_urls('<!-- wp:image {"src": "http://legacy-blog.com/image.jpg"} -->')
 * <!-- wp:image {"src":"https:\/\/modern-webstore.org\/image.jpg"} -->
 * ```
 *
 * @TODO Use a proper JSON parser and encoder to:
 * * Support UTF-16 characters
 * * Gracefully handle recoverable encoding issues
 * * Avoid changing the whitespace in the same manner as
 *   we do in WP_HTML_Tag_Processor
 */
function wp_rewrite_urls( $options ) {
	if ( empty( $options['base_url'] ) ) {
		$options['base_url'] = $options['current-site-url'];
	}

	$current_site_url = WP_URL::parse( $options['current-site-url'] );
	if($current_site_url->pathname[strlen($current_site_url->pathname) - 1] === '/') {
		$current_site_url->pathname = substr($current_site_url->pathname, 0, strlen($current_site_url->pathname) - 1);
	}

	$new_site_url     = WP_URL::parse( $options['new-site-url'] );
	if($new_site_url->pathname[strlen($new_site_url->pathname) - 1] === '/') {
		$new_site_url->pathname = substr($new_site_url->pathname, 0, strlen($new_site_url->pathname) - 1);
	}	

	$p         = new WP_Block_Markup_Url_Processor( $options['block_markup'], $options['base_url'] );
	$generator = iterate_urls( $p, $options['current-site-url'] );
	foreach ( $generator as $p ) {
		$raw_url = $p->get_raw_url();
		$is_relative = (
			! str_starts_with($raw_url, 'http://') && 
			! str_starts_with($raw_url, 'https://')
		);
		
		$parsed_matched_url = $p->get_parsed_url();
		$parsed_matched_url->protocol = $new_site_url->protocol;
		$parsed_matched_url->hostname = $new_site_url->hostname;
		$decoded_matched_pathname     = urldecode( $parsed_matched_url->pathname );

		// Update the pathname if needed.
		if ( '/' !== $current_site_url->pathname ) {
			// The matched URL starts with $current_site_name->pathname.
			$parsed_matched_url->pathname =
				$new_site_url->pathname .
				substr(
					$decoded_matched_pathname,
					strlen( urldecode( $current_site_url->pathname ) )
				);
		}

		/*
		 * Stylistic choice – if the matched URL has no trailing slash,
		 * do not add it to the new URL. The WHATWG URL parser will
		 * add one automatically if the path is empty, so we have to
		 * explicitly remove it.
		 */
		$new_raw_url     = $parsed_matched_url->toString();
		$raw_matched_url = $p->get_raw_url();
		if (
			$raw_matched_url[ strlen( $raw_matched_url ) - 1 ] !== '/' &&
			$parsed_matched_url->pathname === '/' &&
			$parsed_matched_url->search === '' &&
			$parsed_matched_url->hash === ''
		) {
			$new_raw_url = rtrim( $new_raw_url, '/' );
		}
		if ( $new_raw_url ) {
			if($is_relative) {
				$new_relative_url = $parsed_matched_url->pathname;
				if($parsed_matched_url->search !== '') {
					$new_relative_url .= $parsed_matched_url->search;
				}
				if($parsed_matched_url->hash !== '') {
					$new_relative_url .= $parsed_matched_url->hash;
				}
				$p->set_raw_url( $new_relative_url );
			} else {
				$p->set_raw_url( $new_raw_url );
			}
		}
	}
	return $p->get_updated_html();
}

/**
 *
 * @return Generator
 */
function iterate_urls( $p, $current_site_url ) {
	$parsed_current_site_url       = WP_URL::parse( $current_site_url );
	$current_pathname_no_trailing_slash = urldecode( $parsed_current_site_url->pathname );
	if($current_pathname_no_trailing_slash[strlen($current_pathname_no_trailing_slash) - 1] === '/') {
		$current_pathname_no_trailing_slash = substr($current_pathname_no_trailing_slash, 0, strlen($current_pathname_no_trailing_slash) - 1);
	}
	$current_pathname_with_trailing_slash = $current_pathname_no_trailing_slash . '/';

	while ( $p->next_url() ) {
		$parsed_matched_url = $p->get_parsed_url();
		if ( $parsed_matched_url->hostname === $parsed_current_site_url->hostname ) {
			$matched_pathname_decoded = urldecode( $parsed_matched_url->pathname );
			$pathname_matches =
				// Direct match
				$matched_pathname_decoded === $current_pathname_no_trailing_slash ||
				$matched_pathname_decoded === $current_pathname_with_trailing_slash ||
				// Pathname is a "child" of the old site pathname
				// e.g. old site pathname and found pathname = /blog/article.
				str_starts_with($matched_pathname_decoded, $current_pathname_with_trailing_slash)
			;
			if ( ! $pathname_matches ) {
				continue;
			}

			// It's a match!
			yield $p;
		}
	}
	return $p->get_updated_html();
}

function wp_list_urls_in_block_markup( $options ) {
	$block_markup = $options['block_markup'];
	$base_url     = $options['base_url'] ?? 'https://playground.internal';
	$p            = new WP_Block_Markup_Url_Processor( $block_markup, $base_url );
	while ( $p->next_url() ) {
		// Skip empty relative URLs.
		if ( ! trim( $p->get_raw_url() ) ) {
			continue;
		}
		echo '* ';
		switch ( $p->get_token_type() ) {
			case '#tag':
				echo 'In <' . $p->get_tag() . '> tag attribute "' . $p->get_inspected_attribute_name() . '": ';
				break;
			case '#block-comment':
				echo 'In a ' . $p->get_block_name() . ' block attribute "' . $p->get_block_attribute_key() . '": ';
				break;
			case '#text':
				echo 'In #text: ';
				break;
		}
		echo $p->get_raw_url() . "\n";
	}
}
