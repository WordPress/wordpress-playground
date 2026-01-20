<?php
$descriptorspec = array(
   0 => array("pipe", "r"),
   1 => array("pipe", "w"),
   2 => array("pipe", "w")
);

$process = proc_open('echo "Hello from proc_open"', $descriptorspec, $pipes);

if (is_resource($process)) {
    $stdout = stream_get_contents($pipes[1]);
    fclose($pipes[1]);

    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[2]);

    $return_value = proc_close($process);

    if (trim($stdout) === 'Hello from proc_open') {
        echo "proc_open test passed!\n";
        exit(0);
    } else {
        echo "proc_open test failed! Expected 'Hello from proc_open', got: '$stdout'\n";
        exit(1);
    }
} else {
    echo "proc_open failed to create process\n";
    exit(1);
}
