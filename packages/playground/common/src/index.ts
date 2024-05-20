/**
 * Avoid adding new code here. @wp-playground/common should remain
 * as lean as possible.
 *
 * This package exists to avoid circular dependencies. Let's not
 * use it as a default place to add code that doesn't seem to fit
 * anywhere else. If there's no good place for your code, perhaps
 * it needs to be restructured? Or maybe there's a need for a new package?
 * Let's always consider these questions before adding new code here.
 */

import { UniversalPHP } from '@php-wasm/universal';
import { phpVars } from '@php-wasm/util';

export const RecommendedPHPVersion = '8.0';

// @TODO Make these ZIP functions more versatile and
//       move them to one of the @php-wasm packages.

/**
 * Unzip a zip file inside Playground.
 */
const tmpPath = '/tmp/file.zip';
export const unzipFile = async (
	php: UniversalPHP,
	zipPath: string | File,
	extractToPath: string
) => {
	if (zipPath instanceof File) {
		const zipFile = zipPath;
		zipPath = tmpPath;
		await php.writeFile(
			zipPath,
			new Uint8Array(await zipFile.arrayBuffer())
		);
	}
	const js = phpVars({
		zipPath,
		extractToPath,
	});
	await php.run({
		code: `<?php
        function unzip($zipPath, $extractTo, $overwrite = true)
        {
            if (!is_dir($extractTo)) {
                mkdir($extractTo, 0777, true);
            }
            $zip = new ZipArchive;
            $res = $zip->open($zipPath);
            if ($res === TRUE) {
                $zip->extractTo($extractTo);
                $zip->close();
                chmod($extractTo, 0777);
            } else {
                throw new Exception("Could not unzip file");
            }
        }
        unzip(${js.zipPath}, ${js.extractToPath});
        `,
	});
	if (await php.fileExists(tmpPath)) {
		await php.unlink(tmpPath);
	}
};
