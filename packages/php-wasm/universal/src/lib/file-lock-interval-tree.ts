import type {
	ByteRange,
	LockedRange,
	RequestedRangeLock,
} from './file-lock-manager';

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

export class FileLockIntervalTree {
	private root: IntervalNode | null = null;

	isEmpty() {
		return this.root === null;
	}

	/**
	 * Insert a new locked range into the tree
	 */
	insert(range: LockedRange): void {
		this.root = this.insertNode(this.root, range);
	}

	/**
	 * Find all ranges that overlap with the given range
	 */
	findOverlapping(range: ByteRange): LockedRange[] {
		const result: LockedRange[] = [];
		this.findOverlappingRanges(this.root, range, result);
		return result;
	}

	/**
	 * Remove a lock range from the tree
	 */
	remove(range: RequestedRangeLock): void {
		this.root = this.removeNode(this.root, range);
	}

	/**
	 * Find all ranges locked by the given process.
	 *
	 * @param pid The process ID to find locks for.
	 * @returns All locked ranges for the given process.
	 */
	findLocksForProcess(pid: number): RequestedRangeLock[] {
		const result: RequestedRangeLock[] = [];
		this.findLocksForProcessInNode(this.root, pid, result);
		return result;
	}

	/**
	 * Find the strictest existing lock type in the range lock tree.
	 *
	 * @returns The strictest existing lock type, or 'unlocked' if no locks exist.
	 */
	findStrictestExistingLockType(): RequestedRangeLock['type'] {
		let maxType: RequestedRangeLock['type'] = 'unlocked';

		const traverse = (node: IntervalNode | null) => {
			if (!node) {
				return;
			}
			if (node.range.type === 'exclusive') {
				maxType = 'exclusive';
				return; // Can stop early since exclusive is highest
			}
			if (node.range.type === 'shared') {
				maxType = 'shared';
			}
			traverse(node.left);
			traverse(node.right);
		};
		traverse(this.root);

		return maxType;
	}

	private insertNode(
		node: IntervalNode | null,
		range: LockedRange
	): IntervalNode {
		if (!node) {
			return new IntervalNode(range);
		}

		// Insert to left subtree if start is less than node's start
		if (range.start < node.range.start) {
			node.left = this.insertNode(node.left, range);
		} else {
			node.right = this.insertNode(node.right, range);
		}

		// Update max value
		node.max = this.bigintMax(node.max, range.end);
		return node;
	}

	private bigintMax(...args: bigint[]): bigint {
		return args.reduce((max, current) => {
			return current > max ? current : max;
		}, args[0]);
	}

	private findOverlappingRanges(
		node: IntervalNode | null,
		range: ByteRange,
		result: LockedRange[]
	): void {
		if (!node) {
			return;
		}

		// Check if current node overlaps
		if (this.doRangesOverlap(node.range, range)) {
			result.push(node.range);
		}

		// If left child exists and its max is greater than range start, search left
		if (node.left && node.left.max >= range.start) {
			this.findOverlappingRanges(node.left, range, result);
		}

		// Search right if it could contain overlapping intervals
		if (node.right && node.range.start <= range.end) {
			this.findOverlappingRanges(node.right, range, result);
		}
	}

	private doRangesOverlap(a: ByteRange, b: ByteRange): boolean {
		return a.start < b.end && b.start < a.end;
	}

	private removeNode(
		node: IntervalNode | null,
		range: RequestedRangeLock
	): IntervalNode | null {
		if (!node) {
			return null;
		}

		// Check if current node is the one to remove
		if (this.areRangesEqual(node.range, range)) {
			// Handle cases of no children or one child
			if (!node.left) {
				return node.right;
			}
			if (!node.right) {
				return node.left;
			}

			// Node has two children - find successor
			const successor = this.findMin(node.right);
			node.range = successor.range;
			node.right = this.removeNode(node.right, successor.range);
		} else if (range.start < node.range.start) {
			node.left = this.removeNode(node.left, range);
		} else {
			node.right = this.removeNode(node.right, range);
		}

		// Update max value
		node.max = node.range.end;
		if (node.left) {
			node.max = this.bigintMax(node.max, node.left.max);
		}
		if (node.right) {
			node.max = this.bigintMax(node.max, node.right.max);
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

	private areRangesEqual(
		a: RequestedRangeLock,
		b: RequestedRangeLock
	): boolean {
		return (
			a.start === b.start &&
			a.end === b.end &&
			a.pid === b.pid &&
			a.fd === b.fd
		);
	}

	private findLocksForProcessInNode(
		node: IntervalNode | null,
		pid: number,
		result: RequestedRangeLock[]
	): void {
		if (!node) {
			return;
		}

		if (node.range.pid === pid) {
			result.push(node.range);
		}

		this.findLocksForProcessInNode(node.left, pid, result);
		this.findLocksForProcessInNode(node.right, pid, result);
	}
}
