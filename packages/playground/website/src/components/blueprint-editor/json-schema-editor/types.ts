import type { Text } from '@codemirror/state';

export interface JSONSchema {
	$schema?: string;
	$ref?: string;
	type?: string | string[];
	properties?: Record<string, JSONSchema>;
	required?: string[];
	items?: JSONSchema;
	anyOf?: JSONSchema[];
	oneOf?: JSONSchema[];
	allOf?: JSONSchema[];
	const?: unknown;
	enum?: unknown[];
	description?: string;
	discriminator?: {
		propertyName: string;
		mapping?: Record<string, string>;
	};
	[key: string]: unknown;
}

export interface PathSegment {
	type: 'key' | 'array' | 'object';
	key?: string;
	depth: number;
}

export interface JSONSchemaCompletionConfig {
	autofocus?: boolean;
	initialDoc?: string;
	onChange?: (doc: string) => void;
	readOnly?: boolean;
}

export type { Text as CodeMirrorDoc };
