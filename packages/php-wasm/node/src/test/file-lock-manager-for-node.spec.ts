import { declareFileLockManagerTests } from './file-lock-manager-tests';
import { FileLockManagerForNode } from '../lib';

declareFileLockManagerTests({
	name: 'FileLockManagerForNode',
	fileLockManagerFactory: () => new FileLockManagerForNode(),
	includeNativeTests: false,
});
