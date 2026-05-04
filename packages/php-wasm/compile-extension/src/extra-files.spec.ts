import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseExtraFilesSpec, stageExtraFilesIntoOutDir } from './extra-files';

describe('parseExtraFilesSpec', () => {
	it('splits hostDir from absolute vfsRoot', () => {
		expect(parseExtraFilesSpec('./web-ui:/internal/shared/spx')).toEqual({
			hostDir: './web-ui',
			vfsRoot: '/internal/shared/spx',
		});
	});

	it('rejects values without a colon', () => {
		expect(() => parseExtraFilesSpec('./web-ui')).toThrow(
			'Invalid --extra-files'
		);
	});

	it('rejects relative vfsRoot values', () => {
		expect(() => parseExtraFilesSpec('./web-ui:internal/shared')).toThrow(
			'must be an absolute VFS path'
		);
	});

	it('preserves Windows-style hostDir that contains a colon', () => {
		expect(
			parseExtraFilesSpec('C:\\path\\to\\ui:/internal/shared/spx')
		).toEqual({
			hostDir: 'C:\\path\\to\\ui',
			vfsRoot: '/internal/shared/spx',
		});
	});
});

describe('stageExtraFilesIntoOutDir', () => {
	it('copies host files into outDir and records relative sourcePath nodes', async () => {
		const workspace = await mkdtemp(
			path.join(os.tmpdir(), 'compile-extension-extras-')
		);
		const hostDir = path.join(workspace, 'ui');
		await mkdir(path.join(hostDir, 'css'), { recursive: true });
		await writeFile(path.join(hostDir, 'index.html'), '<html></html>');
		await writeFile(path.join(hostDir, 'css', 'main.css'), 'body{}');

		const outDir = path.join(workspace, 'dist');
		const extraFiles = await stageExtraFilesIntoOutDir(
			[{ hostDir, vfsRoot: '/internal/shared/example' }],
			outDir,
			workspace
		);

		expect(extraFiles).toEqual({
			vfsRoot: '/internal/shared/example',
			nodes: [
				{ vfsPath: 'css/main.css', sourcePath: 'ui/css/main.css' },
				{ vfsPath: 'index.html', sourcePath: 'ui/index.html' },
			],
		});
		expect(
			(
				await readFile(path.join(outDir, 'ui', 'index.html'), 'utf8')
			).trim()
		).toBe('<html></html>');
	});

	it('records empty directories as type=directory nodes', async () => {
		const workspace = await mkdtemp(
			path.join(os.tmpdir(), 'compile-extension-extras-')
		);
		const hostDir = path.join(workspace, 'spx');
		await mkdir(path.join(hostDir, 'data'), { recursive: true });

		const outDir = path.join(workspace, 'dist');
		const extraFiles = await stageExtraFilesIntoOutDir(
			[{ hostDir, vfsRoot: '/internal/shared/spx' }],
			outDir,
			workspace
		);

		expect(extraFiles?.nodes).toEqual([
			{ vfsPath: 'data', type: 'directory' },
		]);
	});

	it('rejects two specs whose hostDirs share a basename', async () => {
		const workspace = await mkdtemp(
			path.join(os.tmpdir(), 'compile-extension-extras-')
		);
		await mkdir(path.join(workspace, 'a', 'ui'), { recursive: true });
		await mkdir(path.join(workspace, 'b', 'ui'), { recursive: true });

		await expect(
			stageExtraFilesIntoOutDir(
				[
					{
						hostDir: path.join(workspace, 'a', 'ui'),
						vfsRoot: '/x',
					},
					{
						hostDir: path.join(workspace, 'b', 'ui'),
						vfsRoot: '/x',
					},
				],
				path.join(workspace, 'dist'),
				workspace
			)
		).rejects.toThrow('destination collides on disk');
	});

	it('rejects two specs that produce the same vfsPath', async () => {
		const workspace = await mkdtemp(
			path.join(os.tmpdir(), 'compile-extension-extras-')
		);
		await mkdir(path.join(workspace, 'first'), { recursive: true });
		await mkdir(path.join(workspace, 'second'), { recursive: true });
		await writeFile(
			path.join(workspace, 'first', 'index.html'),
			'<html></html>'
		);
		await writeFile(
			path.join(workspace, 'second', 'index.html'),
			'<html></html>'
		);

		await expect(
			stageExtraFilesIntoOutDir(
				[
					{
						hostDir: path.join(workspace, 'first'),
						vfsRoot: '/x',
					},
					{
						hostDir: path.join(workspace, 'second'),
						vfsRoot: '/x',
					},
				],
				path.join(workspace, 'dist'),
				workspace
			)
		).rejects.toThrow('vfsPath collides across specs');
	});

	it('rejects mixed vfsRoot values across specs', async () => {
		const workspace = await mkdtemp(
			path.join(os.tmpdir(), 'compile-extension-extras-')
		);
		await mkdir(path.join(workspace, 'a'), { recursive: true });
		await mkdir(path.join(workspace, 'b'), { recursive: true });

		await expect(
			stageExtraFilesIntoOutDir(
				[
					{ hostDir: path.join(workspace, 'a'), vfsRoot: '/x' },
					{ hostDir: path.join(workspace, 'b'), vfsRoot: '/y' },
				],
				path.join(workspace, 'dist'),
				workspace
			)
		).rejects.toThrow(
			'All --extra-files entries must share the same vfsRoot'
		);
	});
});
