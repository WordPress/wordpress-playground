import type { UniversalPHP } from '@php-wasm/universal';

export async function getSqliteDatabasePath(
	php: UniversalPHP
): Promise<string> {
	const response = await php.runStream({
		code: `<?php
$wp_env = require '/internal/shared/wp-env.php';
if ($wp_env['db']['type'] !== 'sqlite') {
	throw new RuntimeException('The site does not use SQLite.');
}
echo $wp_env['db']['path'];
`,
	});
	const [path, errors, exitCode] = await Promise.all([
		response.stdoutText,
		response.stderrText,
		response.exitCode,
	]);
	if (exitCode !== 0) {
		throw new Error(errors || 'Could not read the SQLite database path.');
	}
	if (path === '') {
		throw new Error('The SQLite database path is invalid.');
	}
	return path;
}
