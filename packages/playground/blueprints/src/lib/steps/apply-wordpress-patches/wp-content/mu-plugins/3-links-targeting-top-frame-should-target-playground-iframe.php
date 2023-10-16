<?php
/**
 * Links with target="top" don't work in the playground iframe because of
 * the sandbox attribute. What they really should be targeting is the
 * playground iframe itself (name="playground"). This mu-plugin rewrites
 * all target="_top" links to target="playground" instead.
 * 
 * https://github.com/WordPress/wordpress-playground/issues/266
 */

add_action('admin_print_scripts', function () {
    ?>
    <script>
        document.addEventListener('click', function (event) {
            if (event.target.tagName === 'A' && ['_parent', '_top'].includes(event.target.target)) {
                event.target.target = 'wordpress-playground';
            }
        });
    </script>
    <?php
});
