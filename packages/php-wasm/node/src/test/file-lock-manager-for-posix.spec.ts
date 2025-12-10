import { declareFileLockManagerTests } from './file-lock-manager-tests';
import { FileLockManagerForPosix } from '../lib';
import { platform } from 'os';

declareFileLockManagerTests({
	name: 'FileLockManagerForPosix',
	fileLockManagerFactory: () => new FileLockManagerForPosix(),
	includeNativeTests: true,
	shouldSkip: platform() === 'win32',
});
