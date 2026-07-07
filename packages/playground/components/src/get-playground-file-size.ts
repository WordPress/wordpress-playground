export type PlaygroundFileSizeClient = {
	run(options: {
		code: string;
		env: Record<string, string>;
	}): Promise<{ text: string }>;
};

export async function getPlaygroundFileSize(
	playground: PlaygroundFileSizeClient,
	path: string
): Promise<number> {
	const response = await playground.run({
		code: `<?php
$path = getenv('PLAYGROUND_FILE_SIZE_PATH');
clearstatcache(true, $path);
$size = filesize($path);
if ($size !== false) {
	echo $size;
}
`,
		env: {
			PLAYGROUND_FILE_SIZE_PATH: path,
		},
	});
	const sizeText = response.text.trim();
	if (!/^\d+$/.test(sizeText)) {
		throw new Error(
			'Could not read the file size: PHP did not return a numeric size.'
		);
	}
	const size = Number(sizeText);
	if (!Number.isSafeInteger(size)) {
		throw new Error(
			'Could not read the file size: size exceeds Number.MAX_SAFE_INTEGER.'
		);
	}
	return size;
}
