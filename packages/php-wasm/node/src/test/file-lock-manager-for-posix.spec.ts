import { declareFileLockManagerTests } from './file-lock-manager-tests';
import { platform } from 'os';

declareFileLockManagerTests({
	name: 'FileLockManagerForPosix',
	testWorkerUrl: new URL(
		'./file-lock-manager-for-posix--test-process.ts',
		import.meta.url
	),
	shouldSkip: platform() === 'win32',
	workerType: 'childProcess',
});
