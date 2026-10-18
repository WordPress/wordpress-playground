<?php
/**
 * No-op wp_mail() for Playground's --experimental-posix-kernel browser
 * mode. Mirrors the CLI's wp-templates/disable-wp-mail.php. Prevents
 * wp_install()'s wp_new_blog_notification() from spawning sendmail via
 * PHPMailer's popen path, which the kernel's fork+exec cannot resolve
 * and which crashes the FPM worker mid-install.
 */
if (!function_exists('wp_mail')) {
    function wp_mail($to, $subject, $message, $headers = '', $attachments = array()) {
        return true;
    }
}
