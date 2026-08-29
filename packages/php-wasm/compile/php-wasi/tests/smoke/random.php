<?php
$bytes = random_bytes(513);
$integer = random_int(100, 200);
$hash = password_hash('playground', PASSWORD_DEFAULT);
$email = filter_var('wordpress@example.com', FILTER_VALIDATE_EMAIL);

echo strlen($bytes), ':',
    ($integer >= 100 && $integer <= 200 ? 'in-range' : 'out-of-range'), ':',
    (password_verify('playground', $hash) ? 'valid' : 'invalid'), ':',
    ($email === 'wordpress@example.com' ? 'email-valid' : 'email-invalid');
