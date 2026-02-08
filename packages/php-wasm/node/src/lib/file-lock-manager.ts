/**
 * Re-export the FileLockManager interface and related types from
 * @php-wasm/universal so they can be used in both web and Node contexts.
 */
export type {
	FileLockManager,
	RequestedRangeLock,
	WholeFileLock,
	Pid,
	Fd,
	WholeFileLock_Exclusive,
	WholeFileLock_Shared,
	WholeFileLock_Unlocked,
	WholeFileLockOp,
} from '@php-wasm/universal';
