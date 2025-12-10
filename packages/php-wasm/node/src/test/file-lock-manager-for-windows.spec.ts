import { declareFileLockManagerTests } from './file-lock-manager-tests';
import { FileLockManagerForWindows } from '../lib';
import { platform } from 'os';

declareFileLockManagerTests({
	name: 'FileLockManagerForWindows',
	fileLockManagerFactory: () => new FileLockManagerForWindows(),
	includeNativeTests: true,
	shouldSkip: platform() !== 'win32',
});
