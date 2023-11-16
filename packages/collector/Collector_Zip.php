<?php

function collector_zip_wp_content($zip)
{
	$callback = function ($realPath, $packPath) use ($zip, &$callback) {
		if(is_file($realPath))
		{
			$zip->addFile($realPath, $packPath);
		}
		else if(is_dir($realPath))
		{
			$zip->addEmptyDir($packPath);

			collector_iterate_directory($realPath, ABSPATH, $callback);
		}
	};

	collector_iterate_directory(ABSPATH . '/' . 'wp-content/', ABSPATH, $callback);
}

function collector_open_zip()
{
	$zipName = collector_get_tmpfile('package', 'zip');
	$zip = new ZipArchive;
	$zip->open($zipName, ZIPARCHIVE::CREATE);

	$zip->addEmptyDir('wp-content');
	$zip->addEmptyDir('schema');

	return [$zip, $zipName];
}

function collector_close_zip($zip, $files)
{
	$zip->close();
	array_map(fn($f) => unlink($f), $files);
}

function collector_zip_collect()
{
	[$zip, $zipName] = collector_open_zip();
	collector_zip_wp_content($zip);
	$tmpFiles = collector_dump_db($zip);
	collector_close_zip($zip, $tmpFiles);

	rename($zipName, COLLECTOR_FINAL_ZIP);

	return $zipName;
}

function collector_zip_send()
{
	header("Status: 200 OK");
	header("Content-type: application/zip");
	header("Content-Disposition: attachment; filename=collector-package-" . date('Y-m-d_H-i-s') . ".zip");
	header("Pragma: no-cache");
	header("Expires: 0");

	readfile(COLLECTOR_FINAL_ZIP);
}

function collector_zip_delete()
{
	unlink(COLLECTOR_FINAL_ZIP);
}
