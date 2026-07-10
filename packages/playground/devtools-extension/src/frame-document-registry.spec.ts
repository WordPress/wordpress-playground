import { describe, expect, it } from 'vitest';
import {
	clearTabDocuments,
	commitFrameDocument,
	isCurrentFrameDocument,
	registerFrameDocument,
	type FrameDocumentRegistry,
} from './frame-document-registry';

describe('frame document registry', () => {
	it('rejects a late response after a replacement document commits', () => {
		const registry: FrameDocumentRegistry = new Map();
		expect(registerFrameDocument(registry, 1, 2, 'old-document')).toBe(
			true
		);

		commitFrameDocument(registry, 1, 2, 'new-document');

		expect(registerFrameDocument(registry, 1, 2, 'old-document')).toBe(
			false
		);
		expect(isCurrentFrameDocument(registry, 1, 2, 'new-document')).toBe(
			true
		);
	});

	it('keeps the current document valid when navigation never commits', () => {
		const registry: FrameDocumentRegistry = new Map();
		expect(registerFrameDocument(registry, 1, 2, 'current-document')).toBe(
			true
		);

		// A canceled navigation has no commit event. Re-observing the same
		// document must leave its target usable.
		expect(registerFrameDocument(registry, 1, 2, 'current-document')).toBe(
			true
		);
		expect(isCurrentFrameDocument(registry, 1, 2, 'current-document')).toBe(
			true
		);
	});

	it('allows a previously seen document to become current again', () => {
		const registry: FrameDocumentRegistry = new Map();
		commitFrameDocument(registry, 1, 2, 'first-document');
		commitFrameDocument(registry, 1, 2, 'second-document');

		commitFrameDocument(registry, 1, 2, 'first-document');

		expect(isCurrentFrameDocument(registry, 1, 2, 'first-document')).toBe(
			true
		);
		expect(isCurrentFrameDocument(registry, 1, 2, 'second-document')).toBe(
			false
		);
		clearTabDocuments(registry, 1);
		expect(isCurrentFrameDocument(registry, 1, 2, 'first-document')).toBe(
			false
		);
	});
});
