import type {
	EmscriptenOptions,
	PHPRuntime,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import { LatestSupportedPHPVersion } from '@php-wasm/universal';
import { phpVersions } from '../../../../supported-php-versions.mjs';
import fs from 'fs';

interface PHPVersion {
	version: SupportedPHPVersion;
	loaderFilename: string;
	wasmFilename: string;
	lastRelease: string;
}

export async function withXdebug(
	version: SupportedPHPVersion = LatestSupportedPHPVersion,
	options: EmscriptenOptions
): Promise<EmscriptenOptions> {
	const fileName = 'xdebug.so';
	const directoryName = fullyQualifiedPHPVersion(version);
	const filePath = `${__dirname}/jspi/${directoryName}/extensions/${fileName}`;
	const extension = fs.readFileSync(filePath);

	return {
		ENV: {
			...options.ENV,
		},
		onRuntimeInitialized: (phpRuntime: PHPRuntime) => {
			if (options.onRuntimeInitialized) {
				options.onRuntimeInitialized(phpRuntime);
			}
			/* The extension file previously read
			 * is written inside the /extensions directory
			 */
			phpRuntime.FS.mkdirTree('/extensions');
			phpRuntime.FS.writeFile(
				`/extensions/${fileName}`,
				new Uint8Array(extension)
			);
		},
	};
}

function fullyQualifiedPHPVersion(
	requestedVersion: SupportedPHPVersion
): string {
	const version = (phpVersions as PHPVersion[]).find(
		(v) => v.version === requestedVersion
	);
	if (!version) return '';

	return version.lastRelease.replaceAll('.', '_');
}
