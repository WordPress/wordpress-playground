import type { UniversalPHP } from '@php-wasm/universal';

export async function getSqliteDatabasePath(
	php: UniversalPHP
): Promise<string> {
	const response = await php.run({
		code: `<?php
$wp_env = require '/internal/shared/wp-env.php';
if ($wp_env['db']['type'] !== 'sqlite') {
	throw new RuntimeException('The site does not use SQLite.');
}
echo json_encode($wp_env['db']['path']);
`,
	});
	const path = response.json;
	if (typeof path !== 'string' || path === '') {
		throw new Error('The SQLite database path is invalid.');
	}
	return path;
}
