import { declareFileLockManagerTests } from './file-lock-manager-tests';
import { FileLockManagerForPosix } from '../lib';
import { platform } from 'os';

declareFileLockManagerTests({
	name: 'FileLockManagerForPosix',
	fileLockManagerFactory: () => new FileLockManagerForPosix(),
	testWorkerUrl: new URL(
		'./file-lock-manager-for-posix--test-process.ts',
		import.meta.url
	),
	shouldSkip: platform() === 'win32',
});
