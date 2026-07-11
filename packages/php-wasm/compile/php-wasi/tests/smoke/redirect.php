<?php
header('Location: /next', true, 302);
setcookie('php_wasi_redirect', 'visible', ['path' => '/', 'httponly' => true]);
exit;
