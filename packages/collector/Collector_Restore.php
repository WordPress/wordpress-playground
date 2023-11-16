<?php
const COLLECTOR_PLAYGROUND_FLAG = '/tmp/690013d3-b53b-43f2-8371-b293a3bdc4fb';
function collector_restore_backup($schemaFile)
{
	$handle = fopen($schemaFile, 'r');
	$buffer = '';

	global $wpdb;

	while($bytes = fgets($handle))
	{
		$buffer .= $bytes;

		if(substr($buffer, -1, 1) !== "\n")
		{
			continue;
		}

		if(substr($buffer, 0, 2) === '--')
		{
			$buffer = '';
			continue;
		}

		$wpdb->query($buffer);
		$buffer = '';
	}
}
