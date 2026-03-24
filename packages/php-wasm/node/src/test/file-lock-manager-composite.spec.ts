import { declareFileLockManagerTests } from './file-lock-manager-tests';
import { platform } from 'os';

// 1. Composite with InMemory and POSIX, tested with child processes
declareFileLockManagerTests({
	name: 'FileLockManagerComposite with InMemory and POSIX (child processes)',
	testWorkerUrl: new URL(
		'./file-lock-manager-composite-with-posix--test-process.ts',
		import.meta.url
	),
	shouldSkip: platform() === 'win32',
	workerType: 'childProcess',
});

// 2. Composite with InMemory and POSIX, tested with worker threads
declareFileLockManagerTests({
	name: 'FileLockManagerComposite with InMemory and POSIX (worker threads)',
	testWorkerUrl: new URL(
		'./file-lock-manager-composite-with-posix--test-worker-thread.ts',
		import.meta.url
	),
	shouldSkip: platform() === 'win32',
	workerType: 'workerThread',
});

// 3. Composite with InMemory and Windows, tested with child processes
declareFileLockManagerTests({
	name: 'FileLockManagerComposite with InMemory and Windows (child processes)',
	testWorkerUrl: new URL(
		'./file-lock-manager-composite-with-windows--test-process.ts',
		import.meta.url
	),
	shouldSkip: platform() !== 'win32',
	workerType: 'childProcess',
});

// 4. Composite with InMemory and Windows, tested with worker threads
declareFileLockManagerTests({
	name: 'FileLockManagerComposite with InMemory and Windows (worker threads)',
	testWorkerUrl: new URL(
		'./file-lock-manager-composite-with-windows--test-worker-thread.ts',
		import.meta.url
	),
	shouldSkip: platform() !== 'win32',
	workerType: 'workerThread',
});
