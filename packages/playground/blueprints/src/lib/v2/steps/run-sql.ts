import type { V2StepHandler } from '../types';
import type { DataSources } from '../wep-1-blueprint-v2-schema/appendix-B-data-sources';
import { phpVar } from '@php-wasm/util';
import { registerV2StepHandler } from './index';

interface RunSQLArgs {
	source: DataSources.DataReference;
}

/**
 * Resolves a data reference to a SQL file, then executes
 * each statement against the WordPress database via
 * $wpdb->query().
 */
const handler: V2StepHandler<RunSQLArgs> = async (args, context) => {
	const { php, dataReferenceResolver } = context;
	const docroot = await php.documentRoot;

	const file = await dataReferenceResolver.resolveFile(args.source);
	const sqlPath = '/tmp/run-sql.sql';
	await php.writeFile(sqlPath, file.contents);

	await php.run({
		code: `<?php
require_once(${phpVar(docroot)} . '/wp-load.php');
global $wpdb;

$sql = file_get_contents(${phpVar(sqlPath)});
$statements = array_filter(
	array_map('trim', explode(';', $sql))
);
foreach ($statements as $statement) {
	if (!empty($statement)) {
		$result = $wpdb->query($statement);
		if ($result === false) {
			throw new Exception(
				'SQL error: ' . $wpdb->last_error .
				' in statement: ' . substr($statement, 0, 200)
			);
		}
	}
}
unlink(${phpVar(sqlPath)});
`,
	});
};

registerV2StepHandler('runSQL', handler);
