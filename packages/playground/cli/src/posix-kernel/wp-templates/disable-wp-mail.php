<?php
/**
 * No-op wp_mail() for Playground CLI's --experimental-posix-kernel.
 * Prevents wp_install()'s wp_new_blog_notification() from spawning
 * sendmail via PHPMailer's popen path, which the kernel's fork+exec
 * cannot resolve.
 */
if (!function_exists('wp_mail')) {
    function wp_mail($to, $subject, $message, $headers = '', $attachments = array()) {
        return true;
    }
}
