import type { UniversalPHP } from '@php-wasm/universal';

/** Stats the database inside PHP without copying its contents into JavaScript. */
export async function getSqliteDatabaseSize(
	php: UniversalPHP,
	databasePath: string
): Promise<number> {
	const response = await php.run({
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
	const sizeText = response.text.trim();
	const size = Number(sizeText);
	if (sizeText === '' || !Number.isSafeInteger(size) || size < 0) {
		throw new Error('Database stat returned an invalid size.');
	}
	return size;
}
