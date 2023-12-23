<?php

/**
 * Wraps all define calls in a conditional if(!defined()) to prevent redefining
 * constants.
 * 
 * Transforms:
 * 
 * ```
 * define('WP_DEBUG', true);
 * define('WP_DEBUG', false);
 * define($const ? $a, $b, 123);
 * ```
 * 
 * Into:
 * 
 * ```
 * if(!defined('WP_DEBUG')) {
 *    define('WP_DEBUG', true);
 * }
 * if(!defined('WP_DEBUG')) {
 *     define('WP_DEBUG', false);
 * }
 * if(!defined($const ? $a : $b)) {
 *     define($const ? $a : $b, 123);
 * }
 * ```
 * 
 * @param mixed $content
 * @return string
 */
function wrap_define_calls_in_ifs($content)
{
    $tokens = array_reverse(token_get_all($content));
    $output = [];

    // Look through all the tokens and find the define calls
    do {
        $buffer = [];
        $name_buffer = [];

        // Capture everything until the define call into output.
        // Capturing the define call into a buffer.
        // Example:
        //     <?php echo 'a'; define  (
        //     ^^^^^^^^^^^^^^^^^^^^^^
        //           output   |buffer
        while ($token = array_pop($tokens)) {
            if (is_array($token) && $token[0] === T_STRING && strtolower($token[1]) === 'define') {
                $buffer[] = $token;
                break;
            }
            $output[] = $token;
        }

        // Maybe we didn't find a define call and reached the end of the file?
        if (!count($tokens)) {
            break;
        }

        // Capture everything up to the opening parenthesis, including the parenthesis
        // e.g. define  (
        //           ^^^^
        while ($token = array_pop($tokens)) {
            $buffer[] = $token;
            if ($token === "(") {
                break;
            }
        }

        // Capture the first argument – it's the first expression after the opening
        // parenthesis and before the comma:
        // Examples:
        //     define("WP_DEBUG", true);
        //            ^^^^^^^^^^^
        //
        //     define(count([1,2]) > 2 ? 'WP_DEBUG' : 'FOO', true);
        //            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        $open_parenthesis = 0;
        while ($token = array_pop($tokens)) {
            $buffer[] = $token;
            if ($token === "(" || $token === "[" || $token === "{") {
                ++$open_parenthesis;
            } elseif ($token === ")" || $token === "]" || $token === "}") {
                --$open_parenthesis;
            } elseif ($token === "," && $open_parenthesis === 0) {
                break;
            }
            // Don't capture the comma as a part of the constant name
            $name_buffer[] = $token;
        }

        // Capture everything until the closing parenthesis
        //     define("WP_DEBUG", true);
        //                       ^^^^^^
        $open_parenthesis = 0;
        while ($token = array_pop($tokens)) {
            $buffer[] = $token;
            if ($token === "(" || $token === "[" || $token === "{") {
                ++$open_parenthesis;
            } elseif ($token === ")" || $token === "]" || $token === "}") {
                --$open_parenthesis;
            }
            if ($open_parenthesis === -1) {
                break;
            }
        }

        // Capture until the semicolon
        //     define("WP_DEBUG", true)  ;
        //                             ^^^
        while ($token = array_pop($tokens)) {
            $buffer[] = $token;
            if ($token === ";") {
                break;
            }
        }

        // Yay, we have the define call in the buffer now. Let's wrap it in an if
        // statement:
        $output = array_merge(
            $output,
            ["if(!defined("],
            $name_buffer,
            [")) {\n\t"],
            $buffer,
            ["\n}\n"]
        );
    } while (count($tokens));

    // Translate the output tokens back into a string
    $output_string = '';
    foreach ($output as $token) {
        if (is_array($token)) {
            $output_string .= $token[1];
        } else {
            $output_string .= $token;
        }
    }

    return $output_string;
}

// // Uncomment to test:
// $content = <<<'PHP'
// <?php
// define('WP_DEBUG', true);
// define('WP_DEBUG', false);
// define($const ? $a : $b, 123);
// define((function() use($x) {
//     return [$x, 'a'];
// })(), 123);
// PHP;

// print_r(wrap_define_calls_in_ifs($content));

