<?php
function collector_get_tmpfile($name, $type)
{
    $tmpName = tempnam('/tmp/', 'clctr-'. date('Y-m-d_H-i-s-') . $name . '-');
    $typName = $tmpName . '.' . $type;
    touch($typName);
    unlink($tmpName);

    return $typName;
}

function collector_get_preloader($message)
{
    return sprintf(file_get_contents(__DIR__ . '/loading.html'), $message);
}

function collector_get_fakepass()
{
    $fakepass = base64_encode(random_bytes(128));

    set_transient('COLLECTOR_FAKE_PASSWORD', $fakepass, 60 * 5);

    return $fakepass;
}

function collector_use_fakepass()
{
    $fakepass = get_transient('COLLECTOR_FAKE_PASSWORD');

    delete_transient('COLLECTOR_FAKE_PASSWORD');

    return $fakepass;
}
