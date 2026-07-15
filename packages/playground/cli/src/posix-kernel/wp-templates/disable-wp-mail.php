<?php
// No-op wp_mail() shadowing pluggable.php's. Prevents wp_install()'s
// wp_new_blog_notification() from spawning sendmail via PHPMailer popen,
// which kandelo's fork+exec cannot resolve.

if (!function_exists('wp_mail')) {
    function wp_mail($to, $subject, $message, $headers = '', $attachments = array()) {
        return true;
    }
}
