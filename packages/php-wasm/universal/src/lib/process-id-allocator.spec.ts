import { describe, it, expect } from 'vitest';
import { ProcessIdAllocator } from './process-id-allocator';

describe('ProcessIdAllocator', () => {
	it('claims IDs starting from initialId', () => {
		const alloc = new ProcessIdAllocator(1, 10);
		expect(alloc.claim()).toBe(1);
		expect(alloc.claim()).toBe(2);
		expect(alloc.claim()).toBe(3);
	});

	it('does not reuse claimed IDs', () => {
		const alloc = new ProcessIdAllocator(1, 10);
		const ids = new Set<number>();
		for (let i = 0; i < 10; i++) {
			ids.add(alloc.claim());
		}
		expect(ids.size).toBe(10);
	});

	it('wraps around to initialId after reaching maxId', () => {
		const alloc = new ProcessIdAllocator(1, 3);
		expect(alloc.claim()).toBe(1);
		expect(alloc.claim()).toBe(2);
		expect(alloc.claim()).toBe(3);
		alloc.release(1);
		expect(alloc.claim()).toBe(1);
	});

	it('skips claimed IDs when wrapping', () => {
		const alloc = new ProcessIdAllocator(1, 3);
		expect(alloc.claim()).toBe(1);
		expect(alloc.claim()).toBe(2);
		expect(alloc.claim()).toBe(3);
		// Release 1 and 3, but not 2. nextId is still at 3.
		alloc.release(1);
		alloc.release(3);
		// nextId=3, which was released, so it gets reclaimed first
		expect(alloc.claim()).toBe(3);
		// nextId=3 claimed → 4 wraps to 1, which was released
		expect(alloc.claim()).toBe(1);
	});

	it('throws when all IDs are claimed', () => {
		const alloc = new ProcessIdAllocator(1, 3);
		alloc.claim();
		alloc.claim();
		alloc.claim();
		expect(() => alloc.claim()).toThrow(
			'Unable to find free process ID after 3 tries'
		);
	});

	it('releases a claimed ID', () => {
		const alloc = new ProcessIdAllocator(1, 3);
		const id = alloc.claim();
		expect(alloc.release(id)).toBe(true);
	});

	it('returns false when releasing an unclaimed ID', () => {
		const alloc = new ProcessIdAllocator(1, 10);
		expect(alloc.release(5)).toBe(false);
	});

	it('allows reclaiming a released ID', () => {
		const alloc = new ProcessIdAllocator(1, 3);
		alloc.claim(); // 1
		alloc.claim(); // 2
		alloc.claim(); // 3
		alloc.release(2);
		alloc.release(1);
		// Wraps from 3 -> 1, claims 1
		expect(alloc.claim()).toBe(1);
		// Then 2
		expect(alloc.claim()).toBe(2);
	});

	it('works with a custom initial ID', () => {
		const alloc = new ProcessIdAllocator(100, 102);
		expect(alloc.claim()).toBe(100);
		expect(alloc.claim()).toBe(101);
		expect(alloc.claim()).toBe(102);
		alloc.release(100);
		expect(alloc.claim()).toBe(100);
	});

	it('handles single-value range', () => {
		const alloc = new ProcessIdAllocator(5, 5);
		expect(alloc.claim()).toBe(5);
		expect(() => alloc.claim()).toThrow(
			'Unable to find free process ID after 1 tries'
		);
		alloc.release(5);
		expect(alloc.claim()).toBe(5);
	});

	it('handles repeated claim-release cycles across wrapping boundary', () => {
		const alloc = new ProcessIdAllocator(1, 3);
		for (let cycle = 0; cycle < 5; cycle++) {
			const a = alloc.claim();
			const b = alloc.claim();
			const c = alloc.claim();
			expect(new Set([a, b, c]).size).toBe(3);
			alloc.release(a);
			alloc.release(b);
			alloc.release(c);
		}
	});
});
