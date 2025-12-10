import { declareFileLockManagerTests } from './file-lock-manager-tests';
import { FileLockManagerInMemory } from '../lib';

declareFileLockManagerTests({
	name: 'FileLockManagerInMemory',
	fileLockManagerFactory: () => new FileLockManagerInMemory(),
	includeNativeTests: false,
});
