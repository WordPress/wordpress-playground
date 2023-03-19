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
  $zip = new \ZipArchive;
  $res = $zip->open($pathToZip);
  if ($res === TRUE) {
    $zip->extractTo('/');
    $zip->close();
    return TRUE;
  } else {
    return FALSE;
  }
}
