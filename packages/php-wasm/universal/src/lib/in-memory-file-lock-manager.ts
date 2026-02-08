/**
 * In-memory file lock manager for use in web workers.
 *
 * This provides the same POSIX-compatible byte-range locking and
 * whole-file locking as FileLockManagerForNode, but without any
 * native OS file operations. All lock state is tracked purely in
 * memory using an interval tree for byte-range locks and a simple
 * state object for whole-file locks.
 *
 * Use this in the browser/worker context where multiple PHP-WASM
 * instances share a filesystem (SABMEMFS) and need coordinated
 * SQLite locking, but there's no native filesystem to flock().
 */

import type {
	FileLockManager,
	RequestedRangeLock,
	WholeFileLock,
	WholeFileLockOp,
	Pid,
	Fd,
} from './file-lock-manager';

const MAX_64BIT_OFFSET = BigInt(2n ** 64n - 1n);

type LockedRange = RequestedRangeLock & {
	type: Exclude<RequestedRangeLock['type'], 'unlocked'>;
};

export class InMemoryFileLockManager implements FileLockManager {
	private locks: Map<string, InMemoryFileLock> = new Map();

	lockWholeFile(path: string, op: WholeFileLockOp): boolean {
		if (!this.locks.has(path)) {
			if (op.type === 'unlock') {
				return true;
			}
			this.locks.set(path, new InMemoryFileLock());
		}
		const lock = this.locks.get(path)!;
		const result = lock.lockWholeFile(op);
		this.forgetPathIfUnlocked(path);
		return result;
	}

	lockFileByteRange(
		path: string,
		requestedLock: RequestedRangeLock
	): boolean {
		if (!this.locks.has(path)) {
			if (requestedLock.type === 'unlocked') {
				return true;
			}
			this.locks.set(path, new InMemoryFileLock());
		}
		const lock = this.locks.get(path)!;
		const result = lock.lockFileByteRange(requestedLock);
		this.forgetPathIfUnlocked(path);
		return result;
	}

	findFirstConflictingByteRangeLock(
		path: string,
		desiredLock: RequestedRangeLock
	): Omit<RequestedRangeLock, 'fd'> | undefined {
		const lock = this.locks.get(path);
		if (!lock) {
			return undefined;
		}
		return lock.findFirstConflictingByteRangeLock(desiredLock);
	}

	releaseLocksForProcess(pid: number): void {
		for (const [path, lock] of this.locks.entries()) {
			lock.releaseLocksForProcess(pid);
			this.forgetPathIfUnlocked(path);
		}
	}

	releaseLocksForProcessFd(
		pid: number,
		fd: number,
		nativePath: string
	): void {
		const lock = this.locks.get(nativePath);
		if (!lock) {
			return;
		}
		lock.releaseLocksForProcessFd(pid, fd);
		this.forgetPathIfUnlocked(nativePath);
	}

	private forgetPathIfUnlocked(path: string) {
		const lock = this.locks.get(path);
		if (lock && lock.isUnlocked()) {
			this.locks.delete(path);
		}
	}
}

/**
 * A single file's lock state, tracking both whole-file locks (flock)
 * and byte-range locks (fcntl). No native file operations.
 */
class InMemoryFileLock {
	private wholeFileLock: WholeFileLock = { type: 'unlocked' };
	private rangeLocks: FileLockIntervalTree = new FileLockIntervalTree();

	lockWholeFile(op: WholeFileLockOp): boolean {
		if (op.type === 'unlock') {
			if (this.wholeFileLock.type === 'unlocked') {
				// Already unlocked, no-op.
			} else if (
				this.wholeFileLock.type === 'exclusive' &&
				this.wholeFileLock.pid === op.pid &&
				this.wholeFileLock.fd === op.fd
			) {
				this.wholeFileLock = { type: 'unlocked' };
			} else if (
				this.wholeFileLock.type === 'shared' &&
				this.wholeFileLock.pidFds.has(op.pid) &&
				this.wholeFileLock.pidFds.get(op.pid)!.has(op.fd)
			) {
				this.wholeFileLock.pidFds.get(op.pid)!.delete(op.fd);
				if (this.wholeFileLock.pidFds.get(op.pid)!.size === 0) {
					this.wholeFileLock.pidFds.delete(op.pid);
				}
				if (this.wholeFileLock.pidFds.size === 0) {
					this.wholeFileLock = { type: 'unlocked' };
				}
			}
			return true;
		}

		if (this.isThereAConflictWithRequestedWholeFileLock(op)) {
			return false;
		}

		if (op.type === 'exclusive') {
			this.wholeFileLock = {
				type: 'exclusive',
				pid: op.pid,
				fd: op.fd,
			};
			return true;
		}

		if (op.type === 'shared') {
			if (this.wholeFileLock.type !== 'shared') {
				this.wholeFileLock = { type: 'shared', pidFds: new Map() };
			}
			const sharedLock = this.wholeFileLock;
			if (!sharedLock.pidFds.has(op.pid)) {
				sharedLock.pidFds.set(op.pid, new Set());
			}
			sharedLock.pidFds.get(op.pid)!.add(op.fd);
			return true;
		}

		throw new Error(`Unexpected wholeFileLock() op: '${op.type}'`);
	}

	lockFileByteRange(requestedLock: RequestedRangeLock): boolean {
		if (requestedLock.start === requestedLock.end) {
			// Treat a range with zero length as covering the
			// entire remaining range (POSIX semantics).
			requestedLock = {
				...requestedLock,
				end: MAX_64BIT_OFFSET,
			};
		}

		if (requestedLock.type === 'unlocked') {
			const overlapping = this.rangeLocks
				.findOverlapping(requestedLock)
				.filter((lock) => lock.pid === requestedLock.pid);

			for (const overlappingLock of overlapping) {
				this.rangeLocks.remove(overlappingLock);
				if (overlappingLock.start < requestedLock.start) {
					this.rangeLocks.insert({
						...overlappingLock,
						end: requestedLock.start,
					});
				}
				if (overlappingLock.end > requestedLock.end) {
					this.rangeLocks.insert({
						...overlappingLock,
						start: requestedLock.end,
					});
				}
			}
			return true;
		}

		if (
			this.findFirstConflictingByteRangeLock(requestedLock) !== undefined
		) {
			return false;
		}

		const overlapping = this.rangeLocks
			.findOverlapping(requestedLock)
			.filter((lock) => lock.pid === requestedLock.pid);

		let minStart = requestedLock.start;
		let maxEnd = requestedLock.end;
		for (const overlappingLock of overlapping) {
			this.rangeLocks.remove(overlappingLock);
			if (overlappingLock.start < minStart) {
				minStart = overlappingLock.start;
			}
			if (overlappingLock.end > maxEnd) {
				maxEnd = overlappingLock.end;
			}
		}

		this.rangeLocks.insert({
			...(requestedLock as LockedRange),
			start: minStart,
			end: maxEnd,
		});
		return true;
	}

	findFirstConflictingByteRangeLock(
		desiredLock: RequestedRangeLock
	): RequestedRangeLock | undefined {
		const overlapping = this.rangeLocks.findOverlapping(desiredLock);
		const conflicting = overlapping.find(
			(lock) =>
				lock.pid !== desiredLock.pid &&
				(desiredLock.type === 'exclusive' || lock.type === 'exclusive')
		);

		if (conflicting) {
			return conflicting;
		}

		if (this.wholeFileLock.type === 'unlocked') {
			return undefined;
		}

		const wfl = this.wholeFileLock;
		if (wfl.type === 'exclusive' || desiredLock.type === 'exclusive') {
			return {
				type: this.wholeFileLock.type,
				start: 0n,
				end: 0n,
				pid: -1,
			};
		}

		return undefined;
	}

	releaseLocksForProcess(pid: Pid): void {
		for (const rangeLock of this.rangeLocks.findLocksForProcess(pid)) {
			this.lockFileByteRange({ ...rangeLock, type: 'unlocked' });
		}

		if (
			this.wholeFileLock.type === 'exclusive' &&
			this.wholeFileLock.pid === pid
		) {
			this.lockWholeFile({ pid, fd: this.wholeFileLock.fd, type: 'unlock' });
		} else if (
			this.wholeFileLock.type === 'shared' &&
			this.wholeFileLock.pidFds.has(pid)
		) {
			for (const fd of this.wholeFileLock.pidFds.get(pid)!) {
				this.lockWholeFile({ pid, fd, type: 'unlock' });
			}
		}
	}

	releaseLocksForProcessFd(pid: Pid, fd: Fd): void {
		// Closing an fd releases all fcntl locks for that file by the process.
		for (const rangeLock of this.rangeLocks.findLocksForProcess(pid)) {
			this.lockFileByteRange({ ...rangeLock, type: 'unlocked' });
		}
		this.lockWholeFile({ pid, fd, type: 'unlock' });
	}

	isUnlocked(): boolean {
		return (
			this.wholeFileLock.type === 'unlocked' &&
			this.rangeLocks.isEmpty()
		);
	}

	private isThereAConflictWithRequestedWholeFileLock(
		requestedLock: WholeFileLockOp
	): boolean {
		if (requestedLock.type === 'exclusive') {
			if (
				this.wholeFileLock.type === 'exclusive' &&
				(this.wholeFileLock.fd !== requestedLock.fd ||
					this.wholeFileLock.pid !== requestedLock.pid)
			) {
				return true;
			}
			if (
				this.wholeFileLock.type === 'shared' &&
				Array.from(this.wholeFileLock.pidFds).some(
					([pid]) => pid !== requestedLock.pid
				)
			) {
				return true;
			}
			const overlapping = this.rangeLocks.findOverlapping({
				type: 'unlocked',
				start: 0n,
				end: MAX_64BIT_OFFSET,
				pid: -1,
			});
			if (overlapping.length > 0) {
				return true;
			}
			return false;
		}

		if (requestedLock.type === 'shared') {
			if (
				this.wholeFileLock.type === 'exclusive' &&
				this.wholeFileLock.pid !== requestedLock.pid
			) {
				return true;
			}
			const overlapping = this.rangeLocks.findOverlapping({
				type: 'unlocked',
				start: 0n,
				end: MAX_64BIT_OFFSET,
				pid: -1,
			});
			const exclusiveLocks = overlapping.filter(
				(lock) => lock.type === 'exclusive'
			);
			if (exclusiveLocks.length > 0) {
				return true;
			}
			return false;
		}

		return false;
	}
}

// ────────────── Interval tree for byte-range locks ──────────────

class IntervalNode {
	range: LockedRange;
	max: bigint;
	left: IntervalNode | null = null;
	right: IntervalNode | null = null;

	constructor(range: LockedRange) {
		this.range = range;
		this.max = range.end;
	}
}

class FileLockIntervalTree {
	private root: IntervalNode | null = null;

	isEmpty(): boolean {
		return this.root === null;
	}

	insert(range: LockedRange): void {
		this.root = this.insertNode(this.root, range);
	}

	findOverlapping(range: RequestedRangeLock): LockedRange[] {
		const result: LockedRange[] = [];
		this.findOverlappingRanges(this.root, range, result);
		return result;
	}

	remove(range: RequestedRangeLock): void {
		this.root = this.removeNode(this.root, range);
	}

	findLocksForProcess(pid: number): RequestedRangeLock[] {
		const result: RequestedRangeLock[] = [];
		this.findLocksForProcessInNode(this.root, pid, result);
		return result;
	}

	private insertNode(
		node: IntervalNode | null,
		range: LockedRange
	): IntervalNode {
		if (!node) {
			return new IntervalNode(range);
		}
		if (range.start < node.range.start) {
			node.left = this.insertNode(node.left, range);
		} else {
			node.right = this.insertNode(node.right, range);
		}
		if (range.end > node.max) {
			node.max = range.end;
		}
		return node;
	}

	private findOverlappingRanges(
		node: IntervalNode | null,
		range: RequestedRangeLock,
		result: LockedRange[]
	): void {
		if (!node) return;
		if (node.range.start < range.end && range.start < node.range.end) {
			result.push(node.range);
		}
		if (node.left && node.left.max >= range.start) {
			this.findOverlappingRanges(node.left, range, result);
		}
		if (node.right && node.range.start <= range.end) {
			this.findOverlappingRanges(node.right, range, result);
		}
	}

	private removeNode(
		node: IntervalNode | null,
		range: RequestedRangeLock
	): IntervalNode | null {
		if (!node) return null;

		if (
			node.range.start === range.start &&
			node.range.end === range.end &&
			node.range.pid === range.pid
		) {
			if (!node.left) return node.right;
			if (!node.right) return node.left;
			const successor = this.findMin(node.right);
			node.range = successor.range;
			node.right = this.removeNode(node.right, successor.range);
		} else if (range.start < node.range.start) {
			node.left = this.removeNode(node.left, range);
		} else {
			node.right = this.removeNode(node.right, range);
		}

		node.max = node.range.end;
		if (node.left && node.left.max > node.max) {
			node.max = node.left.max;
		}
		if (node.right && node.right.max > node.max) {
			node.max = node.right.max;
		}
		return node;
	}

	private findMin(node: IntervalNode): IntervalNode {
		let current = node;
		while (current.left) {
			current = current.left;
		}
		return current;
	}

	private findLocksForProcessInNode(
		node: IntervalNode | null,
		pid: number,
		result: RequestedRangeLock[]
	): void {
		if (!node) return;
		if (node.range.pid === pid) {
			result.push(node.range);
		}
		this.findLocksForProcessInNode(node.left, pid, result);
		this.findLocksForProcessInNode(node.right, pid, result);
	}
}
