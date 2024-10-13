<?php

/**
 * Detects and rewrites URLs in block markup.
 *
 * ## Design choices
 *
 * ### No streaming
 *
 * This class loads the entire block markup into memory without streaming.
 * If the post cannot fit into memory, WordPress won't be able to render it
 * anyway.
 */
class WP_Block_Markup_Processor extends WP_HTML_Tag_Processor {

	private $block_name;
	protected $block_attributes;
	private $block_attributes_updated;
	private $block_closer;
	private $modifiable_text;
	private $modifiable_text_updated;

	/**
	 * @var \RecursiveIteratorIterator
	 */
	private $block_attributes_iterator;


	private $accessible_text_starts_at;
	private $accessible_text_length;
	private $accessible_lexical_updates;

	public function __construct( $html ) {
		parent::__construct( $html );
		$reflection = new ReflectionClass( 'WP_HTML_Tag_Processor' );

		$this->accessible_text_starts_at = $reflection->getProperty( 'text_starts_at' );
		$this->accessible_text_starts_at->setAccessible( true );

		$this->accessible_text_length = $reflection->getProperty( 'text_length' );
		$this->accessible_text_length->setAccessible( true );

		$this->accessible_lexical_updates = $reflection->getProperty( 'lexical_updates' );
		$this->accessible_lexical_updates->setAccessible( true );
	}


	public function get_token_type() {
		switch ( $this->parser_state ) {
			case self::STATE_COMMENT:
				if ( null !== $this->block_name ) {
					return '#block-comment';
				}

				return '#comment';

			default:
				return parent::get_token_type();
		}
	}

	public function get_modifiable_text() {
		if ( null === $this->modifiable_text ) {
			$this->modifiable_text = parent::get_modifiable_text();
		}

		return $this->modifiable_text;
	}

	/**
	 * @param  mixed  $new_content
	 *
	 * @return bool
	 */
	public function set_modifiable_text( $new_value ) {
		switch ( parent::get_token_type() ) {
			case '#text':
				break;

			case '#comment':
			case '#cdata-section':
				if (
					parent::get_token_type() === '#comment' && (
						strpos( $new_value, '-->' ) !== false ||
						strpos( $new_value, '--!>' ) !== false
					)
				) {
					_doing_it_wrong(
						__METHOD__,
						__( 'Cannot set a comment closer as a text of an HTML comment.' ),
						'WP_VERSION'
					);

					return false;
				}
				if (
					$this->get_token_type() === '#cdata-section' &&
					strpos( $new_value, '>' ) !== false
				) {
					_doing_it_wrong(
						__METHOD__,
						__( 'Cannot set a CDATA closer as text of an HTML CDATA-lookalike section.' ),
						'WP_VERSION'
					);

					return false;
				}

				break;
			default:
				_doing_it_wrong(
					__METHOD__,
					__( 'Cannot set text content on a non-text node.' ),
					'WP_VERSION'
				);

				return false;
		}

		$this->modifiable_text_updated = true;
		$this->modifiable_text         = $new_value;

		return true;
	}

	/**
	 * Returns the name of the block if the current token is a block comment.
	 *
	 * @return string|false
	 */
	public function get_block_name() {
		if ( null === $this->block_name ) {
			return false;
		}

		return $this->block_name;
	}

	public function get_block_attributes() {
		if ( null === $this->block_attributes ) {
			return false;
		}

		return $this->block_attributes;
	}

	public function is_block_closer() {
		return $this->block_name !== null && $this->block_closer === true;
	}

	public function next_token() {
		$this->get_updated_html();

		$this->block_name               = null;
		$this->block_attributes         = null;
		$this->block_closer             = false;
		$this->block_attributes_updated = false;
		$this->modifiable_text          = null;
		$this->modifiable_text_updated  = false;

		if ( parent::next_token() === false ) {
			return false;
		}

		if ( parent::get_token_type() !== '#comment' ) {
			return true;
		}

		$text = parent::get_modifiable_text();
		// Try to parse as a block. The block parser won't cut it because
		// while it can parse blocks, it has no semantics for rewriting the
		// block markup. Let's do our best here:
		$at = strspn( $text, ' \t\f\r\n' ); // Whitespace

		if ( $at >= strlen( $text ) ) {
			// This is an empty comment. Not a block.
			return true;
		}

		// Blocks closers start with the solidus character (`/`)
		if ( '/' === $text[ $at ] ) {
			$this->block_closer = true;
			++ $at;
		}

		// Blocks start with wp:
		if ( ! (
			$at + 3 < strlen( $text ) &&
			$text[ $at ] === 'w' &&
			$text[ $at + 1 ] === 'p' &&
			$text[ $at + 2 ] === ':'
		) ) {
			return true;
		}

		$name_starts_at = $at;

		// Skip wp:
		$at += 3;

		// Parse the actual block name after wp:
		$name_length = strspn( $text, 'abcdefghijklmnopqrstuwxvyzABCDEFGHIJKLMNOPRQSTUWXVYZ0123456789_-', $at );
		if ( $name_length === 0 ) {
			// This wasn't a block after all, just a regular comment.
			return true;
		}
		$name = substr( $text, $name_starts_at, $name_length + 3 );
		$at   += $name_length;

		// Skip the whitespace that follows the block name
		$at += strspn( $text, ' \t\f\r\n', $at );
		if ( $at >= strlen( $text ) ) {
			// It's a block without attributes.
			$this->block_name = $name;

			return true;
		}

		// It seems we may have block attributes here.

		// Block closers cannot have attributes.
		if ( $this->block_closer ) {
			return true;
		}

		// Let's try to parse them as JSON.
		$json_maybe = substr( $text, $at );
		$attributes = json_decode( $json_maybe, true );
		if ( null === $attributes || ! is_array( $attributes ) ) {
			// This comment looked like a block comment, but the attributes didn't
			// parse as a JSON array. This means it wasn't a block after all.
			return true;
		}

		// We have a block name and a valid attributes array. We may not find a block
		// closer, but let's assume is a block and process it as such.
		// @TODO: Confirm that WordPress block parser would have parsed this as a block.
		$this->block_name       = $name;
		$this->block_attributes = $attributes;

		return true;
	}

	public function get_updated_html() {
		$this->block_attribute_updates_to_modifiable_text_updates();
		$new_text_length = $this->modifiable_text_updates_to_lexical_updates();
		$text_starts_at  = $this->accessible_text_starts_at->getValue( $this );

		$updated_html = parent::get_updated_html();

		if ( false !== $new_text_length ) {
			/**
			 * Correct the invalid text indices moved by WP_HTML_Tag_Processor when
			 * updating the modifiable text.
			 * @TODO: Fix that directly in the WP_HTML_Tag_Processor.
			 */
			$this->accessible_text_length->setValue( $this, $new_text_length );
			$this->accessible_text_starts_at->setValue( $this, $text_starts_at );
		}

		return $updated_html;
	}

	private function block_attribute_updates_to_modifiable_text_updates() {
		// Apply block attribute updates, if any.
		if ( ! $this->block_attributes_updated ) {
			return false;
		}
		$this->set_modifiable_text(
			' ' .
			$this->block_name . ' ' .
			json_encode(
				$this->block_attributes_iterator
					? $this->block_attributes_iterator->getSubIterator( 0 )->getArrayCopy()
					: $this->block_attributes,
				JSON_HEX_TAG | // Convert < and > to \u003C and \u003E
				JSON_HEX_AMP   // Convert & to \u0026
			)
			. ' '
		);

		return true;
	}

	private function modifiable_text_updates_to_lexical_updates() {
		/**
		 * Applies modifiable text updates, if any.
		 *
		 * Don't do this at home :-) Changes access to private properties of the
		 * WP_HTML_Tag_Processor class to enable changing the text content of a
		 * node.
		 */
		if ( ! $this->modifiable_text_updated ) {
			return false;
		}

		$new_value = $this->get_modifiable_text();
		switch ( parent::get_token_type() ) {
			case '#text':
				$lexical_updates_now   = $this->accessible_lexical_updates->getValue( $this );
				$lexical_updates_now[] = new WP_HTML_Text_Replacement(
					$this->accessible_text_starts_at->getValue( $this ),
					$this->accessible_text_length->getValue( $this ),
					htmlspecialchars( $new_value, ENT_XML1, 'UTF-8' )
				);
				$this->accessible_lexical_updates->setValue( $this, $lexical_updates_now );
				break;

			case '#comment':
			case '#cdata-section':
				$lexical_updates_now   = $this->accessible_lexical_updates->getValue( $this );
				$lexical_updates_now[] = new WP_HTML_Text_Replacement(
					$this->accessible_text_starts_at->getValue( $this ),
					$this->accessible_text_length->getValue( $this ),
					$new_value
				);
				$this->accessible_lexical_updates->setValue( $this, $lexical_updates_now );
				break;

			default:
				return false;
		}
		$this->modifiable_text_updated = false;

		return strlen( $new_value );
	}

	public function next_block_attribute() {
		if ( '#block-comment' !== $this->get_token_type() ) {
			return false;
		}

		if ( null === $this->block_attributes_iterator ) {
			$block_attributes = $this->get_block_attributes();
			if ( ! is_array( $block_attributes ) ) {
				return false;
			}
			// Re-entrant iteration over the block attributes.
			$this->block_attributes_iterator = new \RecursiveIteratorIterator(
				new \RecursiveArrayIterator( $block_attributes ),
				\RecursiveIteratorIterator::SELF_FIRST
			);
		}

		while ( true ) {
			$this->block_attributes_iterator->next();
			if ( ! $this->block_attributes_iterator->valid() ) {
				break;
			}
			return true;
		}

		return false;
	}

	public function get_block_attribute_key() {
		if ( null === $this->block_attributes_iterator || false === $this->block_attributes_iterator->valid() ) {
			return false;
		}

		return $this->block_attributes_iterator->key();
	}

	public function get_block_attribute_value() {
		if ( null === $this->block_attributes_iterator || false === $this->block_attributes_iterator->valid() ) {
			return false;
		}

		return $this->block_attributes_iterator->current();
	}

	public function set_block_attribute_value( $new_value ) {
		if ( null === $this->block_attributes_iterator || false === $this->block_attributes_iterator->valid() ) {
			return false;
		}

		$this->block_attributes_iterator->getSubIterator(
			$this->block_attributes_iterator->getDepth()
		)->offsetSet(
			$this->get_block_attribute_key(),
			$new_value
		);
		$this->block_attributes_updated = true;

		return true;
	}

}
