import { lazy } from 'react';
import type { ComponentType } from 'react';

/**
 * Modal metadata for registry
 */
export interface ModalMetadata {
	/** Unique identifier for the modal */
	slug: string;
	/** Component to render */
	component: ComponentType<any>;
	/** Priority: higher number = higher priority (shows over others) */
	priority: number;
	/** Whether the modal should be lazy loaded */
	lazy?: boolean;
	/** Props to pass to the modal component */
	props?: Record<string, any>;
	/** Whether this modal should prevent stacking with others */
	exclusive?: boolean;
}

/**
 * Modal registry configuration
 * Maps modal slugs to their metadata and lazy components
 */
export interface ModalRegistry {
	register: (metadata: ModalMetadata) => void;
	get: (slug: string) => ModalMetadata | undefined;
	getAll: () => ModalMetadata[];
	resolve: (slug: string) =>
		| {
				component: ComponentType<any>;
				props?: Record<string, any>;
		  }
		| undefined;
	getHighestPriorityModal: (slugs: string[]) => string | undefined;
}

/**
 * Create a modal registry instance
 * This allows for dynamic registration of modals with metadata
 */
export function createModalRegistry(): ModalRegistry {
	const registry = new Map<string, ModalMetadata>();

	return {
		register(metadata: ModalMetadata) {
			if (registry.has(metadata.slug)) {
				/* eslint-disable-next-line no-console */
				console.warn(
					`Modal with slug "${metadata.slug}" is already registered`
				);
			}
			registry.set(metadata.slug, metadata);
		},

		get(slug: string) {
			return registry.get(slug);
		},

		getAll() {
			return Array.from(registry.values());
		},

		resolve(slug: string) {
			const metadata = registry.get(slug);
			if (!metadata) return undefined;
			return {
				component: metadata.component,
				props: metadata.props,
			};
		},

		getHighestPriorityModal(slugs: string[]) {
			let highest: { slug: string; priority: number } | null = null;

			for (const slug of slugs) {
				const metadata = registry.get(slug);
				if (
					metadata &&
					(!highest || metadata.priority > highest.priority)
				) {
					highest = { slug, priority: metadata.priority };
				}
			}

			return highest?.slug;
		},
	};
}

/**
 * Default modal registry with all registered modals
 */
let defaultRegistry: ModalRegistry | null = null;

export function getDefaultModalRegistry(): ModalRegistry {
	if (!defaultRegistry) {
		defaultRegistry = createModalRegistry();
	}
	return defaultRegistry;
}

/**
 * Initialize the default modal registry with all modals
 * This should be called once at app startup
 *
 * Note: Modals are now lazy-loaded to reduce initial bundle size
 */
export function initializeModalRegistry(
	staticModals: Record<
		string,
		{ component: ComponentType<any>; priority: number }
	>,
	lazyModals: Record<
		string,
		{
			loader: () => Promise<{ default: ComponentType<any> }>;
			priority: number;
		}
	>
) {
	const registry = getDefaultModalRegistry();

	// Register static modals (loaded on app startup)
	for (const [slug, { component, priority }] of Object.entries(
		staticModals
	)) {
		registry.register({
			slug,
			component,
			priority,
			lazy: false,
		});
	}

	// Register lazy modals (loaded on demand)
	for (const [slug, { loader, priority }] of Object.entries(lazyModals)) {
		const lazyComponent = lazy(loader);
		registry.register({
			slug,
			component: lazyComponent,
			priority,
			lazy: true,
		});
	}
}
