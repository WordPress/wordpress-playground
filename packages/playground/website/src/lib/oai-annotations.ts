import type React from 'react';

declare module 'react' {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	interface HTMLAttributes<T> extends React.AriaAttributes {
		'oai-annotation-container'?: string;
		'oai-annotatable'?: string;
		'oai-annotation-container-text'?: string;
		'oai-annotation-metadata'?: string;
	}
}

export type AnnotationMetadataPrimitive = string | number | boolean | null;

export interface PlaygroundAnnotationContext {
	siteSlug?: string | null;
	storage?: string | null;
	wpVersion?: string | null;
	phpVersion?: string | null;
	currentUrl?: string | null;
	activeDockPane?: string | null;
}

/**
 * Builds the flat JSON string for `oai-annotation-metadata` on the Playground
 * shell so browser annotations in ChatGPT include live site/runtime context.
 */
export function buildPlaygroundAnnotationMetadata(
	context: PlaygroundAnnotationContext
): string {
	return serializeAnnotationMetadata({
		siteSlug: context.siteSlug ?? null,
		storage: context.storage ?? null,
		wpVersion: context.wpVersion ?? null,
		phpVersion: context.phpVersion ?? null,
		currentUrl: context.currentUrl ?? null,
		activeDockPane: context.activeDockPane ?? null,
	});
}

/**
 * Serializes flat key-value pairs for the `oai-annotation-metadata` attribute,
 * omitting entries that exceed the browser's six-property, 256-character string,
 * or 2,048-byte serialized-object limits.
 */
export function serializeAnnotationMetadata(
	metadata: Record<string, AnnotationMetadataPrimitive | undefined>
): string {
	const flat: Record<string, AnnotationMetadataPrimitive> = {};
	for (const [key, value] of Object.entries(metadata)) {
		if (Object.keys(flat).length === 6) {
			break;
		}
		if (
			value === undefined ||
			(typeof value === 'string' && value.length > 256)
		) {
			continue;
		}
		flat[key] = value;
		if (new TextEncoder().encode(JSON.stringify(flat)).byteLength > 2048) {
			delete flat[key];
		}
	}
	return JSON.stringify(flat);
}
