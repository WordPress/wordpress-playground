<?php

$prefix = <<<PHP
/*
 * BEGIN: Added by WordPress Playground.
 *
 * WordPress Playground detected that some required WordPress configuration was
 * missing in this file. Since the auto-configure mode was enabled, the missing
 * configuration was automatically added with sensible default values below.
 *
 * It's safe to remove this block and define the missing configuration manually,
 * or you can keep it, as it won't interfere with any existing configuration.
 */\n
PHP;

$suffix = "/* END: Added by WordPress Playground. */\n\n";

function auto_configure_wp_config( $content, $constants ) {
	global $prefix, $suffix;

	$tokens = token_get_all( $content );

	// First, remove existing configuration (before checking for constant existence).
	$from = find_first_token_index( $tokens, T_COMMENT, "BEGIN: Added by WordPress Playground." );
	$to   = find_first_token_index( $tokens, T_COMMENT, "END: Added by WordPress Playground." );
	if ( null !== $from && null !== $to ) {
		$prev_1 = $tokens[$from - 1][0] ?? null;
		$prev_2 = $tokens[$from - 2][0] ?? null;
		if ( T_WHITESPACE === $prev_1 || T_WHITESPACE === $prev_2 ) {
			$from--;
		}
		$tokens = array_merge( array_slice( $tokens, 0, $from ), array_slice( $tokens, $to + 1 ) );
	}

	// Unset whitespace tokens. This preserves the original token indexes.
	$non_whitespace_tokens = $tokens;
	foreach ( $non_whitespace_tokens as $i => $token ) {
		if ( is_array( $token ) && T_WHITESPACE === $token[0] ) {
			unset( $non_whitespace_tokens[ $i ] );
		}
	}

	// Then, inject what's missing.
	$code = '';
	foreach ( $constants as $name => $value ) {
		if ( ! constant_defined( $non_whitespace_tokens, $name ) ) {
			$name  = var_export( $name, true );
			$value = var_export( $value, true );
			$code  = "if ( ! defined( $name ) ) {\n\tdefine( $name, $value );\n}\n";
		}
	}

	// If there's something to inject, add the prefix and suffix.
	if ( '' !== $code ) {
		$code = $prefix . $code . $suffix;
	}

	// Inject the code into the tokens.
	$anchor  = get_anchor_token_index( $non_whitespace_tokens );
	array_splice( $tokens, $anchor, 0, $code );
	$output  = '';
    foreach ( $tokens as $token ) {
		$output .= is_array( $token ) ? $token[1] : $token;
    }
    return $output;
}

function constant_defined( $non_whitespace_tokens, $name ) {
	foreach ( $non_whitespace_tokens as $token ) {
		if ( is_array( $token ) && $token[0] === T_STRING && 'define' === strtolower( $token[1] ) ) {
			if ( '(' === next( $non_whitespace_tokens ) ) {
				$next = next( $non_whitespace_tokens );
				if ( is_array( $next ) && $name === eval( "return $next[1];" ) ) {
					return true;
				}
			}
		}
	}
}

function get_anchor_token_index( $non_whitespace_tokens ) {
	// First try to find the "/** Sets up WordPress vars and included files. */" comment.
	$anchor = find_first_token_index(
		$non_whitespace_tokens,
		T_DOC_COMMENT,
		"Sets up WordPress vars and included files."
	);

	// If not found, try "require_once ABSPATH . 'wp-settings.php';".
	if ( null === $anchor ) {
		$require_anchor = find_first_token_index( $non_whitespace_tokens, T_REQUIRE_ONCE );
		if ( null !== $require_anchor ) {
			$abspath = $non_whitespace_tokens[$require_anchor + 2] ?? null;
			$path    = $non_whitespace_tokens[$require_anchor + 6] ?? null;
			if (
				( is_array( $abspath ) && $abspath[1] === 'ABSPATH' )
				&& ( is_array( $path ) && $path[1] === "'wp-settings.php'" )
			) {
				$anchor = $require_anchor;
			}
		}
	}

	return $anchor;
}

function find_first_token_index( $tokens, $type, $search = null ) {
	foreach ( $tokens as $i => $token ) {
		if ( ! is_array( $token ) ) {
			continue;
		}
		if ( $type !== $token[0] ) {
			continue;
		}
		if ( null === $search || false !== strpos( $token[1], $search ) ) {
			return $i;
		}
	}
	return null;
}
