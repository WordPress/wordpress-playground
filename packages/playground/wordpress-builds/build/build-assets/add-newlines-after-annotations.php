<?php
/**
 * Playground uses `php -w` used to minify WordPress by removing whitespace.
 * However, this causes issues with annotations.
 * `php8 -w file.php` may output code like this:
 *
 * ```php
 * <?php
 * #[AllowDynamicProperties] final class WP_Recovery_Mode_Email_Service {  /* ... code ... * / $message = __( 'Howdy!', '
 *
 * WordPress has a built-in feature ...
 * ```
 * 
 * The class declaration is treated as a comment by PHP 7.4.
 * 
 * However, PHP 7.4 would remove that annotation entirely.
 * 
 * This script is used to postprocess the minified PHP files to add newlines after
 * annotations.
 * 
 * @see https://github.com/WordPress/wordpress-playground/issues/985
 */

function token_to_string($token) {
    if(is_array($token)) {
        return $token[1];
    } else {
        return $token;
    }
}

$text = file_get_contents( $argv[1] );
$output = '';
$inside_annotation = false;
foreach(token_get_all($text) as $token) {
    if ($inside_annotation) {
        if ($token === '[') {
            ++$square_brace_balance;
        } else if ($token === ']') {
            --$square_brace_balance;
        }

        $output .= token_to_string($token);
        if($square_brace_balance === 0) {
            $output .= "\n";
            $inside_annotation = false;
        }
        continue;
    } else if(is_array($token)) {
        if($token[0] === T_ATTRIBUTE) {
            $square_brace_balance = 1;
            $inside_annotation = true;
        }
    }

    $output .= token_to_string($token);
}

file_put_contents($argv[1], $output);
