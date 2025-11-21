import { createPlaygroundCliTempDir } from '../src/temp-dir';
import fs from 'fs';
import path from 'path';

if (process.send === undefined) {
	// eslint-disable-next-line no-console
	console.error('process.send is undefined');
	process.exit(1);
}

process.on('message', async (message: any) => {
	if (message.type === 'create-temp-dir') {
		const tempDir = await createPlaygroundCliTempDir(
			message.substrToIdentifyTempDirs,
			message.autoCleanup
		);
		// Add a file to the temp dir to test that cleanup works
		// on non-empty dirs.
		fs.writeFileSync(path.join(tempDir.path, 'test.txt'), 'test');
		process.send!({
			type: 'temp-dir',
			tempDirPath: tempDir.path,
		});
	} else if (message.type === 'exit') {
		process.exit(0);
	}
});
