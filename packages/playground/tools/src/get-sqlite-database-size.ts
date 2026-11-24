import type { UniversalPHP } from '@php-wasm/universal';

/** Stats the database inside PHP without copying its contents into JavaScript. */
export async function getSqliteDatabaseSize(
	php: UniversalPHP,
	databasePath: string
): Promise<number> {
	const response = await php.runStream({
		code: `<?php
$stat = stat(getenv('DATABASE_PATH'));
if ($stat === false) {
	throw new RuntimeException('Could not stat the database.');
}
echo $stat['size'];
`,
		env: {
			DATABASE_PATH: databasePath,
		},
	});
	const [output, errors, exitCode] = await Promise.all([
		response.stdoutText,
		response.stderrText,
		response.exitCode,
	]);
	if (exitCode !== 0) {
		throw new Error(errors || 'Could not stat the database.');
	}
	const sizeText = output.trim();
	const size = Number(sizeText);
	if (sizeText === '' || !Number.isSafeInteger(size) || size < 0) {
		throw new Error('Database stat returned an invalid size.');
	}
	return size;
}
