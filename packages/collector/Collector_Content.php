<?php
function collector_iterate_directory($path, $prefix, $callback)
{
	$handle = opendir($path);

	while($entry = readdir($handle))
	{
		if($entry === '.' || $entry === '..' || substr($entry, 0, 4) === '.git')
		{
			continue;
		}

		$realPath = realpath($path . '/' . $entry);
		$packPath = substr($realPath, strlen($prefix));

		$callback($realPath, $packPath);
	}
}

function collector_export_tree()
{
	$flat = [];

	$callback = function ($realPath, $packPath) use (&$flat, &$callback) {
		if(is_file($realPath))
		{
			$flat[$packPath] = (object)[
				'realPath' => $realPath,
				'mode' => sprintf('%o', fileperms($realPath)),
			];
		}
		else if(is_dir($realPath))
		{
			$flat[$packPath] = (object)[
				'realPath' => $realPath,
				'mode' => '040000',
			];

			collector_iterate_directory($realPath, '/wordpress', $callback);
		}
	};

	collector_iterate_directory('/wordpress/wp-content/', '/wordpress', $callback);

	return ['files' => $flat];
}
