<?php

function zipDir($root, $output, $options = array())
{
    $root = rtrim($root, '/');
    $additionalPaths = array_key_exists('additional_paths', $options) ? $options['additional_paths'] : array();
    $excludePaths = array_key_exists('exclude_paths', $options) ? $options['exclude_paths'] : array();
    $zip_root = array_key_exists('zip_root', $options) ? $options['zip_root'] : $root;

    $zip = new ZipArchive;
    $res = $zip->open($output, ZipArchive::CREATE);
    if ($res === TRUE) {
        $directories = array(
            $root . '/'
        );
        while (sizeof($directories)) {
            $current_dir = array_pop($directories);

            if ($handle = opendir($current_dir)) {
                while (false !== ($entry = readdir($handle))) {
                    if ($entry == '.' || $entry == '..') {
                        continue;
                    }

                    $entry = join_paths($current_dir, $entry);
                    if (in_array($entry, $excludePaths)) {
                        continue;
                    }

                    if (is_dir($entry)) {
                        $directory_path = $entry . '/';
                        array_push($directories, $directory_path);
                    } else if (is_file($entry)) {
                        $zip->addFile($entry, substr($entry, strlen($zip_root)));
                    }
                }
                closedir($handle);
            }
        }
        foreach ($additionalPaths as $disk_path => $zip_path) {
            $zip->addFile($disk_path, $zip_path);
        }
        $zip->close();
        chmod($output, 0777);
    }
}

function join_paths()
{
    $paths = array();

    foreach (func_get_args() as $arg) {
        if ($arg !== '') {
            $paths[] = $arg;
        }
    }

    return preg_replace('#/+#', '/', join('/', $paths));
}

function unzip($zipPath, $extractTo, $options = array())
{
    $except = array_key_exists('except', $options) ? $options['except'] : array();
    if (!is_dir($extractTo)) {
        mkdir($extractTo, 0777, true);
    }
    $zip = new ZipArchive;
    $res = $zip->open($zipPath);
    try {
        if ($res !== TRUE) {
            throw new Exception("Unable to open zip file: $zipPath");
        }

        for ($i = 0; $i < $zip->numFiles; $i++) {
            $filename = $zip->getNameIndex($i);
            foreach ($except as $e) {
                if (preg_match($e, $filename) === 1) {
                    continue 2;
                }
            }
            echo $filename . "\n";
            $fileInfo = pathinfo($filename);
            if (!empty($fileInfo['dirname'])) {
                $dir = join_paths($extractTo, $fileInfo['dirname']);
                if (!is_dir($dir)) {
                    mkdir($dir, 0777, true);
                }
            }
            $zip->extractTo($extractTo, $filename);
        }
        
        chmod($extractTo, 0777);
    } finally {
        $zip->close();
    }
}


function delTree($dir)
{
    $files = array_diff(scandir($dir), array('.', '..'));
    foreach ($files as $file) {
        (is_dir("$dir/$file")) ? delTree("$dir/$file") : unlink("$dir/$file");
    }
    return rmdir($dir);
}
