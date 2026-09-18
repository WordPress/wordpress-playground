import { declareFileLockManagerTests } from './file-lock-manager-tests';
import { platform } from 'os';

declareFileLockManagerTests({
	name: 'FileLockManagerForWindows',
	testWorkerUrl: new URL(
		'./file-lock-manager-for-windows--test-process.ts',
		import.meta.url
	),
	shouldSkip: platform() !== 'win32',
	workerType: 'childProcess',
});
