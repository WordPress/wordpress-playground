import type { BlueprintV1Declaration } from '../v1/types';

export type RawBlueprintV2Data = string | BlueprintV1Declaration | undefined;
export type ParsedBlueprintV2String =
	| { type: 'inline-file'; contents: string }
	| { type: 'file-reference'; reference: string };

export function parseBlueprintDeclaration(
	source: RawBlueprintV2Data | ParsedBlueprintV2String
): ParsedBlueprintV2String {
	if (
		typeof source === 'object' &&
		'type' in source &&
		['inline-file', 'file-reference'].includes(source.type)
	) {
		return source;
	}
	if (!source) {
		return {
			type: 'inline-file',
			contents: '{}',
		};
	}
	if (typeof source !== 'string') {
		// If source is an object, assume it's a Blueprint declaration object and
		// convert it to a JSON string.
		return {
			type: 'inline-file',
			contents: JSON.stringify(source),
		};
	}
	try {
		// If source is valid JSON, return it as is.
		JSON.parse(source);
		return {
			type: 'inline-file',
			contents: source,
		};
	} catch {
		return {
			type: 'file-reference',
			reference: source,
		};
	}
}
