import { describe, it, expect, vi } from 'vitest';
import {
	createModalRegistry,
	getDefaultModalRegistry,
	initializeModalRegistry,
} from './modal-registry';

// Mock components
const MockComponent1 = () => null;
const MockComponent2 = () => null;
const MockComponent3 = () => null;

describe('Modal Registry', () => {
	describe('createModalRegistry()', () => {
		it('should create a new modal registry instance', () => {
			const registry = createModalRegistry();
			expect(registry).toBeDefined();
			expect(registry.register).toBeDefined();
			expect(registry.get).toBeDefined();
			expect(registry.getAll).toBeDefined();
			expect(registry.resolve).toBeDefined();
			expect(registry.getHighestPriorityModal).toBeDefined();
		});

		it('should start with an empty registry', () => {
			const registry = createModalRegistry();
			expect(registry.getAll()).toEqual([]);
		});
	});

	describe('register() and get()', () => {
		it('should register a modal and retrieve it', () => {
			const registry = createModalRegistry();
			registry.register({
				slug: 'test-modal',
				component: MockComponent1,
				priority: 1,
			});

			const retrieved = registry.get('test-modal');
			expect(retrieved).toBeDefined();
			expect(retrieved?.slug).toBe('test-modal');
			expect(retrieved?.component).toBe(MockComponent1);
			expect(retrieved?.priority).toBe(1);
		});

		it('should return undefined for unregistered modal', () => {
			const registry = createModalRegistry();
			expect(registry.get('non-existent')).toBeUndefined();
		});

		it('should register multiple modals', () => {
			const registry = createModalRegistry();
			registry.register({
				slug: 'modal-1',
				component: MockComponent1,
				priority: 1,
			});
			registry.register({
				slug: 'modal-2',
				component: MockComponent2,
				priority: 2,
			});

			expect(registry.get('modal-1')).toBeDefined();
			expect(registry.get('modal-2')).toBeDefined();
		});

		it('should warn when registering a duplicate modal slug', () => {
			const registry = createModalRegistry();
			const warnSpy = vi.spyOn(console, 'warn');

			registry.register({
				slug: 'duplicate',
				component: MockComponent1,
				priority: 1,
			});
			registry.register({
				slug: 'duplicate',
				component: MockComponent2,
				priority: 2,
			});

			expect(warnSpy).toHaveBeenCalledWith(
				expect.stringContaining('already registered')
			);
			warnSpy.mockRestore();
		});
	});

	describe('getAll()', () => {
		it('should return all registered modals', () => {
			const registry = createModalRegistry();
			registry.register({
				slug: 'modal-1',
				component: MockComponent1,
				priority: 1,
			});
			registry.register({
				slug: 'modal-2',
				component: MockComponent2,
				priority: 2,
			});

			const all = registry.getAll();
			expect(all).toHaveLength(2);
			expect(all.some((m) => m.slug === 'modal-1')).toBe(true);
			expect(all.some((m) => m.slug === 'modal-2')).toBe(true);
		});

		it('should return empty array when no modals are registered', () => {
			const registry = createModalRegistry();
			expect(registry.getAll()).toEqual([]);
		});
	});

	describe('resolve()', () => {
		it('should resolve a registered modal component and props', () => {
			const registry = createModalRegistry();
			const props = { title: 'Test Modal' };
			registry.register({
				slug: 'test-modal',
				component: MockComponent1,
				priority: 1,
				props,
			});

			const resolved = registry.resolve('test-modal');
			expect(resolved).toBeDefined();
			expect(resolved?.component).toBe(MockComponent1);
			expect(resolved?.props).toEqual(props);
		});

		it('should return undefined for unregistered modal', () => {
			const registry = createModalRegistry();
			expect(registry.resolve('non-existent')).toBeUndefined();
		});

		it('should return undefined props when not specified', () => {
			const registry = createModalRegistry();
			registry.register({
				slug: 'test-modal',
				component: MockComponent1,
				priority: 1,
			});

			const resolved = registry.resolve('test-modal');
			expect(resolved?.props).toBeUndefined();
		});
	});

	describe('getHighestPriorityModal()', () => {
		it('should return the modal with highest priority', () => {
			const registry = createModalRegistry();
			registry.register({
				slug: 'low-priority',
				component: MockComponent1,
				priority: 1,
			});
			registry.register({
				slug: 'high-priority',
				component: MockComponent2,
				priority: 10,
			});
			registry.register({
				slug: 'medium-priority',
				component: MockComponent3,
				priority: 5,
			});

			const highest = registry.getHighestPriorityModal([
				'low-priority',
				'high-priority',
				'medium-priority',
			]);
			expect(highest).toBe('high-priority');
		});

		it('should return undefined when no modals are found', () => {
			const registry = createModalRegistry();
			const highest = registry.getHighestPriorityModal([
				'non-existent-1',
				'non-existent-2',
			]);
			expect(highest).toBeUndefined();
		});

		it('should handle single modal correctly', () => {
			const registry = createModalRegistry();
			registry.register({
				slug: 'only-modal',
				component: MockComponent1,
				priority: 5,
			});

			const highest = registry.getHighestPriorityModal(['only-modal']);
			expect(highest).toBe('only-modal');
		});

		it('should ignore unregistered modals in the list', () => {
			const registry = createModalRegistry();
			registry.register({
				slug: 'registered',
				component: MockComponent1,
				priority: 5,
			});

			const highest = registry.getHighestPriorityModal([
				'registered',
				'non-existent',
			]);
			expect(highest).toBe('registered');
		});
	});

	describe('getDefaultModalRegistry()', () => {
		it('should return a singleton instance', () => {
			const registry1 = getDefaultModalRegistry();
			const registry2 = getDefaultModalRegistry();
			expect(registry1).toBe(registry2);
		});
	});

	describe('initializeModalRegistry()', () => {
		it('should register static modals', () => {
			initializeModalRegistry(
				{
					'static-1': {
						component: MockComponent1,
						priority: 1,
					},
					'static-2': {
						component: MockComponent2,
						priority: 2,
					},
				},
				{}
			);

			const defaultRegistry = getDefaultModalRegistry();
			expect(defaultRegistry.get('static-1')).toBeDefined();
		});

		it('should mark lazy modals appropriately', () => {
			initializeModalRegistry(
				{},
				{
					'lazy-modal': {
						loader: async () => ({ default: MockComponent1 }),
						priority: 5,
					},
				}
			);

			const defaultRegistry = getDefaultModalRegistry();
			const modal = defaultRegistry.get('lazy-modal');
			expect(modal?.lazy).toBe(true);
		});
	});

	describe('Modal priority system', () => {
		it('should prioritize error modals over others', () => {
			const registry = createModalRegistry();
			registry.register({
				slug: 'error',
				component: MockComponent1,
				priority: 100,
				exclusive: true,
			});
			registry.register({
				slug: 'info',
				component: MockComponent2,
				priority: 1,
			});

			const highest = registry.getHighestPriorityModal(['error', 'info']);
			expect(highest).toBe('error');
		});

		it('should handle exclusive modal flag', () => {
			const registry = createModalRegistry();
			registry.register({
				slug: 'exclusive-modal',
				component: MockComponent1,
				priority: 50,
				exclusive: true,
			});

			const modal = registry.get('exclusive-modal');
			expect(modal?.exclusive).toBe(true);
		});
	});
});
