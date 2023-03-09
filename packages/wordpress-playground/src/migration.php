<?php

function generateZipFile($exportPath, $databasePath, $docRoot) {
    $zip = new ZipArchive;
    $res = $zip->open($exportPath, ZipArchive::CREATE);
    if ($res === TRUE) {
        $zip->addFile($databasePath);
        $directories = array();
        $directories[] = $docRoot . '/';

        while(sizeof($directories)) {
            $dir = array_pop($directories);

            if ($handle = opendir($dir)) {
                while (false !== ($entry = readdir($handle))) {
                    if ($entry == '.' || $entry == '..') {
                        continue;
                    }

                    $entry = $dir . $entry;

                    if (
                        is_dir($entry) &&
                        strpos($entry, 'wp-content/database') == false &&
                        strpos($entry, 'wp-includes') == false
                    ) {
                            $directory_path = $entry . '/';
                            array_push($directories, $directory_path);
                    } else if (is_file($entry)) {
                        $zip->addFile($entry);
                    }
                }
                closedir($handle);
            }
        }
        $zip->close();
        chmod($exportPath, 0777);
    }
}

function readFileFromZipArchive($pathToZip, $pathToFile) {
    chmod($pathToZip, 0777);
    $zip = new ZipArchive;
    $res = $zip->open($pathToZip);
    if ($res === TRUE) {
        $file = $zip->getFromName($pathToFile);
        echo $file;
    }
}

function importZipFile($pathToZip) {
    $zip = new ZipArchive;
    $res = $zip->open($pathToZip);
    if ($res === TRUE) {
        $counter = 0;
        while ($zip->statIndex($counter)) {
            $file = $zip->statIndex($counter);
            $filePath = $file['name'];
            if (!file_exists(dirname($filePath))) {
                mkdir(dirname($filePath), 0777, true);
            }
            $overwrite = fopen($filePath, 'w');
            fwrite($overwrite, $zip->getFromIndex($counter));
            $counter++;
        }
        $zip->close();
    }
}
