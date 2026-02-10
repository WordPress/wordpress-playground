import type {
	EmscriptenOptions,
	PHPRuntime,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import { LatestSupportedPHPVersion, FSHelpers } from '@php-wasm/universal';
import fs from 'fs';
import path from 'path';
import { getSpxExtensionModule } from './get-spx-extension-module';

const SPX_VFS_WEB_UI_DIR = '/internal/shared/spx-web-ui';
const SPX_VFS_DATA_DIR = '/internal/shared/spx-data';

function copyDirToVFS(phpRuntime: PHPRuntime, hostDir: string, vfsDir: string) {
	if (!FSHelpers.fileExists(phpRuntime.FS, vfsDir)) {
		phpRuntime.FS.mkdirTree(vfsDir);
	}
	for (const entry of fs.readdirSync(hostDir, { withFileTypes: true })) {
		const hostPath = path.join(hostDir, entry.name);
		const vfsPath = `${vfsDir}/${entry.name}`;
		if (entry.isDirectory()) {
			copyDirToVFS(phpRuntime, hostPath, vfsPath);
		} else if (entry.isFile()) {
			if (!FSHelpers.fileExists(phpRuntime.FS, vfsPath)) {
				phpRuntime.FS.writeFile(
					vfsPath,
					new Uint8Array(fs.readFileSync(hostPath))
				);
			}
		}
	}
}

export async function withSpx(
	version: SupportedPHPVersion = LatestSupportedPHPVersion,
	options: EmscriptenOptions
): Promise<EmscriptenOptions> {
	const fileName = 'spx.so';
	const { extensionPath, webUiPath } = await getSpxExtensionModule(version);
	const extension = fs.readFileSync(extensionPath);

	return {
		...options,
		ENV: {
			...options.ENV,
			PHP_INI_SCAN_DIR: '/internal/shared/extensions',
		},
		onRuntimeInitialized: (phpRuntime: PHPRuntime) => {
			if (options.onRuntimeInitialized) {
				options.onRuntimeInitialized(phpRuntime);
			}
			if (
				!FSHelpers.fileExists(
					phpRuntime.FS,
					'/internal/shared/extensions'
				)
			) {
				phpRuntime.FS.mkdirTree('/internal/shared/extensions');
			}
			if (
				!FSHelpers.fileExists(
					phpRuntime.FS,
					`/internal/shared/extensions/${fileName}`
				)
			) {
				phpRuntime.FS.writeFile(
					`/internal/shared/extensions/${fileName}`,
					new Uint8Array(extension)
				);
			}
			if (
				!FSHelpers.fileExists(
					phpRuntime.FS,
					'/internal/shared/extensions/spx.ini'
				)
			) {
				phpRuntime.FS.writeFile(
					'/internal/shared/extensions/spx.ini',
					[
						'extension=/internal/shared/extensions/spx.so',
						`spx.data_dir=${SPX_VFS_DATA_DIR}`,
						'spx.http_enabled=1',
						'spx.http_key=dev',
						'spx.http_ip_whitelist=*',
						`spx.http_ui_assets_dir=${SPX_VFS_WEB_UI_DIR}`,
					].join('\n')
				);
			}
			if (!FSHelpers.fileExists(phpRuntime.FS, SPX_VFS_DATA_DIR)) {
				phpRuntime.FS.mkdirTree(SPX_VFS_DATA_DIR);
			}
			copyDirToVFS(phpRuntime, webUiPath, SPX_VFS_WEB_UI_DIR);
		},
	};
}
