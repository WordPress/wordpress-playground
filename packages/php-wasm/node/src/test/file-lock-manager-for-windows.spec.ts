import { declareFileLockManagerTests } from './file-lock-manager-tests';
import { FileLockManagerForWindows } from '../lib';
import { platform } from 'os';

declareFileLockManagerTests({
	name: 'FileLockManagerForWindows',
	fileLockManagerFactory: () => new FileLockManagerForWindows(),
	testWorkerUrl: new URL(
		'./file-lock-manager-for-windows--test-process.ts',
		import.meta.url
	),
	shouldSkip: platform() !== 'win32',
});
