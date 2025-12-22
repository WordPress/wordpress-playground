/**
 * Base64 encoding/decoding utilities for playground block attributes.
 *
 * These functions handle Unicode-safe Base64 conversion, which the native
 * browser btoa/atob functions don't support reliably. By converting strings
 * to Uint8Arrays first, we ensure proper encoding of special characters.
 */

export type EditorFile = {
	name: string;
	contents: string;
	remoteUrl?: string;
};

export type Attributes = {
	codeEditor: boolean;
	codeEditorReadOnly: boolean;
	codeEditorSideBySide: boolean;
	codeEditorTranspileJsx: boolean;
	codeEditorMultipleFiles: boolean;
	codeEditorMode: string;
	logInUser: boolean;
	landingPageUrl: string;
	createNewPost: boolean;
	createNewPostType: string;
	createNewPostTitle: string;
	createNewPostContent: string;
	redirectToPost: boolean;
	redirectToPostType: string;
	blueprint: string;
	files?: EditorFile[];
	constants: Record<string, boolean | string | number>;
	codeEditorErrorLog: boolean;
	blueprintUrl: string;
	configurationSource:
		| 'block-attributes'
		| 'blueprint-url'
		| 'blueprint-json';
	requireLivePreviewActivation: boolean;
};

const attributesToBase64 = [
	'blueprint',
	'blueprintUrl',
	'codeEditorErrorLog',
	'constants',
	'files',
];

/**
 * Convert a string to a Uint8Array using UTF-8 encoding.
 */
function stringToUint8Array(str: string): Uint8Array {
	return new TextEncoder().encode(str);
}

/**
 * Convert a Uint8Array to a string using UTF-8 decoding.
 */
function uint8ArrayToString(arr: Uint8Array): string {
	return new TextDecoder().decode(arr);
}

/**
 * Convert a Uint8Array to a Base64 string.
 */
function uint8ArrayToBase64(arr: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < arr.byteLength; i++) {
		binary += String.fromCharCode(arr[i]);
	}
	return window.btoa(binary);
}

/**
 * Convert a Base64 string to a Uint8Array.
 */
function base64ToUint8Array(base64: string): Uint8Array {
	const binary = window.atob(base64);
	const arr = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		arr[i] = binary.charCodeAt(i);
	}
	return arr;
}

/**
 * Convert a string to Base64 (Unicode-safe).
 */
export function stringToBase64(str: string): string {
	return uint8ArrayToBase64(stringToUint8Array(str));
}

/**
 * Convert a Base64 string back to a regular string (Unicode-safe).
 */
export function base64ToString(base64: string): string {
	return uint8ArrayToString(base64ToUint8Array(base64));
}

/**
 * Encode block attributes to Base64 for storage/transmission.
 * Only specific attributes are encoded (those in attributesToBase64).
 */
export function base64EncodeBlockAttributes(
	attributes: Record<string, unknown>
): Record<string, unknown> {
	const result: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(attributes)) {
		if (attributesToBase64.includes(key)) {
			if (key === 'files' && Array.isArray(value)) {
				result[key] = value.map((file: EditorFile) => ({
					...file,
					contents: stringToBase64(file.contents || ''),
				}));
			} else if (typeof value === 'string') {
				result[key] = stringToBase64(value);
			} else if (typeof value === 'object' && value !== null) {
				result[key] = stringToBase64(JSON.stringify(value));
			} else {
				result[key] = value;
			}
		} else {
			result[key] = value;
		}
	}

	return result;
}

/**
 * Decode block attributes from Base64.
 * This function never throws - it gracefully handles decoding errors
 * by returning the original value, maintaining backward compatibility.
 */
export function base64DecodeBlockAttributes(
	attributes: Record<string, unknown>
): Attributes {
	const result: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(attributes)) {
		if (attributesToBase64.includes(key)) {
			if (key === 'files' && Array.isArray(value)) {
				result[key] = value.map((file: EditorFile) => {
					try {
						return {
							...file,
							contents: base64ToString(file.contents || ''),
						};
					} catch {
						// If decoding fails, keep the original value
						return file;
					}
				});
			} else if (typeof value === 'string') {
				try {
					result[key] = base64ToString(value);
				} catch {
					result[key] = value;
				}
			} else {
				result[key] = value;
			}
		} else {
			result[key] = value;
		}
	}

	return result as Attributes;
}
