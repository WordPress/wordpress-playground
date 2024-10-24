<?php

use Rowbot\URL\URL;

/**
 * Reports all the URLs in the imported post and enables rewriting them.
 */
class WP_Block_Markup_Url_Processor extends WP_Block_Markup_Processor {

	private $raw_url;
	/**
	 * @var URL
	 */
	private $parsed_url;
	private $base_url;
	private $url_in_text_processor;
	private $url_in_text_node_updated;
	private $inspected_url_attribute_idx = - 1;

	public function __construct( $html, $base_url = null ) {
		parent::__construct( $html );
		$this->base_url = $base_url;
	}

	public function get_updated_html(): string {
		if ( $this->url_in_text_node_updated ) {
			$this->set_modifiable_text( $this->url_in_text_processor->get_updated_text() );
			$this->url_in_text_node_updated = false;
		}

		return parent::get_updated_html();
	}

	public function get_raw_url() {
		return $this->raw_url;
	}

	public function get_parsed_url() {
		return $this->parsed_url;
	}

	public function next_token(): bool {
		$this->get_updated_html();

		$this->raw_url                     = null;
		$this->parsed_url                  = null;
		$this->inspected_url_attribute_idx = - 1;
		$this->url_in_text_processor       = null;
		// Do not reset url_in_text_node_updated – it's reset in get_updated_html() which
		// is called in parent::next_token().

		return parent::next_token();
	}

	public function next_url() {
		do {
			if ( $this->next_url_in_current_token() ) {
				return true;
			}
		} while ( $this->next_token() !== false );

		return false;
	}

	public function next_url_in_current_token() {
		$this->raw_url = null;
		switch ( parent::get_token_type() ) {
			case '#tag':
				return $this->next_url_attribute();
			case '#block-comment':
				return $this->next_url_block_attribute();
			case '#text':
				return $this->next_url_in_text_node();
			default:
				return false;
		}
	}

	private function next_url_in_text_node() {
		if ( $this->get_token_type() !== '#text' ) {
			return false;
		}

		if ( null === $this->url_in_text_processor ) {
			/*
			 * Use the base URL for URLs matched in text nodes. This is the only
			 * way to recognize a substring "WordPress.org" as a URL. We might
			 * get some false positives this way, e.g. in this string:
			 *
			 * > And that's how you build a theme.Now let's take a look at..."
			 *
			 * `theme.Now` would be recognized as a URL. It's up to the API consumer
			 * to filter out such false positives e.g. by checking the domain against
			 * a list of accepted domains, or the TLD against a list of public suffixes.
			 */
			$this->url_in_text_processor = new WP_URL_In_Text_Processor( $this->get_modifiable_text(), $this->base_url );
		}

		while ( $this->url_in_text_processor->next_url() ) {
			$this->raw_url    = WP_URL::ensure_protocol( $this->url_in_text_processor->get_raw_url() );
			$this->parsed_url = $this->url_in_text_processor->get_parsed_url();

			return true;
		}

		return false;
	}

	private function next_url_attribute() {
		$tag = $this->get_tag();
		if (
			! array_key_exists( $tag, self::URL_ATTRIBUTES ) &&
			$tag !== 'INPUT' // type=image => src,
		) {
			return false;
		}

		while ( ++$this->inspected_url_attribute_idx < count( self::URL_ATTRIBUTES[ $tag ] ) ) {
			$attr = self::URL_ATTRIBUTES[ $tag ][ $this->inspected_url_attribute_idx ];
			if ( false === $attr ) {
				return false;
			}

			$url_maybe = $this->get_attribute( $attr );
			/*
			 * Use base URL to resolve known URI attributes as we are certain we're
			 * dealing with URI values.
			 * With a base URL, the string "plugins.php" in <a href="plugins.php"> will
			 * be correctly recognized as a URL.
			 * Without a base URL, this Processor would incorrectly skip it.
			 */
			if ( is_string( $url_maybe ) ) {
				$parsed_url = WP_URL::parse( $url_maybe, $this->base_url );
				if ( false !== $parsed_url ) {
					$this->raw_url    = $url_maybe;
					$this->parsed_url = $parsed_url;

					return true;
				}
			}
		}

		return false;
	}

	private function next_url_block_attribute() {
		while ( $this->next_block_attribute() ) {
			$url_maybe = $this->get_block_attribute_value();
			/*
			 * Do not use base URL for block attributes. to avoid false positives.
			 * When a base URL is present, any word is a valid URL relative to the
			 * base URL.
			 * When a base URL is missing, the string must start with a protocol to
			 * be considered a URL.
			 */
			if ( is_string( $url_maybe ) ) {
				$parsed_url = WP_URL::parse( $url_maybe );
				if ( false !== $parsed_url ) {
					$this->raw_url    = $url_maybe;
					$this->parsed_url = $parsed_url;

					return true;
				}
			}
		}

		return false;
	}

	public function set_raw_url( $new_url ) {
		if ( null === $this->raw_url ) {
			return false;
		}
		switch ( parent::get_token_type() ) {
			case '#tag':
				$attr = $this->get_inspected_attribute_name();
				if ( false === $attr ) {
					return false;
				}
				$this->set_attribute( $attr, $new_url );

				return true;

			case '#block-comment':
				return $this->set_block_attribute_value( $new_url );

			case '#text':
				if ( null === $this->url_in_text_processor ) {
					return false;
				}
				$this->url_in_text_node_updated = true;

				return $this->url_in_text_processor->set_raw_url( $new_url );
		}
	}

	public function get_inspected_attribute_name() {
		if ( '#tag' !== $this->get_token_type() ) {
			return false;
		}

		$tag = $this->get_tag();
		if ( ! array_key_exists( $tag, self::URL_ATTRIBUTES ) ) {
			return false;
		}

		if (
			$this->inspected_url_attribute_idx < 0 ||
			$this->inspected_url_attribute_idx >= count( self::URL_ATTRIBUTES[ $tag ] )
		) {
			return false;
		}

		return self::URL_ATTRIBUTES[ $tag ][ $this->inspected_url_attribute_idx ];
	}


	/**
	 * A list of HTML attributes meant to contain URLs, as defined in the HTML specification.
	 * It includes some deprecated attributes like `lowsrc` and `highsrc` for the `IMG` element.
	 *
	 * See https://html.spec.whatwg.org/multipage/indices.html#attributes-1.
	 * See https://stackoverflow.com/questions/2725156/complete-list-of-html-tag-attributes-which-have-a-url-value.
	 */
	public const URL_ATTRIBUTES = array(
		'A'          => array( 'href' ),
		'APPLET'     => array( 'codebase', 'archive' ),
		'AREA'       => array( 'href' ),
		'AUDIO'      => array( 'src' ),
		'BASE'       => array( 'href' ),
		'BLOCKQUOTE' => array( 'cite' ),
		'BODY'       => array( 'background' ),
		'BUTTON'     => array( 'formaction' ),
		'COMMAND'    => array( 'icon' ),
		'DEL'        => array( 'cite' ),
		'EMBED'      => array( 'src' ),
		'FORM'       => array( 'action' ),
		'FRAME'      => array( 'longdesc', 'src' ),
		'HEAD'       => array( 'profile' ),
		'HTML'       => array( 'manifest' ),
		'IFRAME'     => array( 'longdesc', 'src' ),
		// SVG <image> element
		'IMAGE'      => array( 'href' ),
		'IMG'        => array( 'longdesc', 'src', 'usemap', 'lowsrc', 'highsrc' ),
		'INPUT'      => array( 'src', 'usemap', 'formaction' ),
		'INS'        => array( 'cite' ),
		'LINK'       => array( 'href' ),
		'OBJECT'     => array( 'classid', 'codebase', 'data', 'usemap' ),
		'Q'          => array( 'cite' ),
		'SCRIPT'     => array( 'src' ),
		'SOURCE'     => array( 'src' ),
		'TRACK'      => array( 'src' ),
		'VIDEO'      => array( 'poster', 'src' ),
	);

	/**
	 * @TODO: Either explicitly support these attributes, or explicitly drop support for
	 *        handling their subsyntax. A generic URL matcher might be good enough.
	 */
	public const URL_ATTRIBUTES_WITH_SUBSYNTAX = array(
		'*'      => array( 'style' ), // background(), background-image()
		'APPLET' => array( 'archive' ),
		'IMG'    => array( 'srcset' ),
		'META'   => array( 'content' ),
		'SOURCE' => array( 'srcset' ),
		'OBJECT' => array( 'archive' ),
	);

	/**
	 * Also <style> and <script> tag content can contain URLs.
	 * <style> has specific syntax rules we can use for matching, but perhaps a generic matcher would be good enough?
	 *
	 * <style>
	 * #domID { background:url(https://mysite.com/wp-content/uploads/image.png) }
	 * </style>
	 *
	 * @TODO: Either explicitly support these tags, or explicitly drop support for
	 *         handling their subsyntax. A generic URL matcher might be good enough.
	 */
	public const URL_CONTAINING_TAGS_WITH_SUBSYNTAX = array(
		'STYLE',
		'SCRIPT',
	);
}
