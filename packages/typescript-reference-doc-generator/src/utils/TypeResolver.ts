import {
	ApiItem,
	ApiModel,
	ExcerptToken,
	ExcerptTokenKind,
	IResolveDeclarationReferenceResult,
} from '@microsoft/api-extractor-model';

export interface DocumentedType {
	name: string;
	docUrl: string;
}

export default class TypeResolver {
	private readonly _apiModel: ApiModel;
	private readonly _getLinkForApiItem: (item: ApiItem) => string;

	constructor(
		apiModel: ApiModel,
		getLinkForApiItem: (item: ApiItem) => string
	) {
		this._apiModel = apiModel;
		this._getLinkForApiItem = getLinkForApiItem;
	}

	public resolveTypeDocumentation(
		type: ExcerptToken | string
	): DocumentedType | null {
		if (type instanceof ExcerptToken) {
			const canonicalUrl = this.resolveCanonicalReference(type);
			if (canonicalUrl) {
				return { name: type.text, docUrl: canonicalUrl };
			}

			return this.resolveNativeToken(type.text);
		}

		return this.resolveNativeToken(type);
	}

	public resolveCanonicalReference(token: ExcerptToken) {
		if (
			token.kind === ExcerptTokenKind.Reference &&
			token.canonicalReference
		) {
			const apiItemResult: IResolveDeclarationReferenceResult =
				this._apiModel.resolveDeclarationReference(
					token.canonicalReference,
					undefined
				);
			if (apiItemResult.resolvedApiItem) {
				return this._getLinkForApiItem(apiItemResult.resolvedApiItem);
			}
		}
		return undefined;
	}

	public resolveNativeToken(token: string): DocumentedType | null {
		// Try finding an exact match first. If that fails, try a
		// case-insensitive match.
		const toComparables = [
			(token: string) => token,
			(token: string) => token.toLowerCase(),
		];

		const tokenText = token.split(/[^a-zA-Z0-9\_]/g)[0];
		for (const toComparable of toComparables) {
			const comparableTokenText = toComparable(tokenText);
			for (const [nativeToken, docUrl] of Object.entries(NativeTypes)) {
				if (toComparable(nativeToken) === comparableTokenText) {
					return { name: nativeToken, docUrl };
				}
			}
		}

		return null;
	}
}

/**
 * List of types and their documentation pages.
 * This object can be easily updated by going to any documentation page
 * that lists the types, selecting the <ul> element where the types are listed,
 * and running the following code in the console:
 *
 * ```js
 * copy(
 *   JSON.stringify(
 *     Object.fromEntries(
 *       Array.from($0.querySelectorAll('a'))
 *         .map(a => ([a.textContent.split('<')[0], a.href])
 *       )
 *     )
 *   )
 * )
 * ```
 */
const NativeTypes: Record<string, string> = {
	// Basic Global MDN Types:
	AggregateError:
		'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AggregateError',
	Array: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array',
	ArrayBuffer:
		'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer',
	AsyncFunction:
		'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncFunction',
	AsyncGenerator:
		'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator',
	AsyncGeneratorFunction:
		'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncGeneratorFunction',
	Atomics:
		'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics',
	BigInt: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt',
	BigInt64Array:
		'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt64Array',
	BigUint64Array:
		'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigUint64Array',
	Boolean:
		'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean',
	DataView:
		'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView',
	Date: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date',
	Error: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error',
	EvalError:
		'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/EvalError',
	FinalizationRegistry:
		'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/FinalizationRegistry',
	Float32Array:
		'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Float32Array',
	Float64Array:
		'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Float64Array',
	Function:
		'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function',
	Generator:
		'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Generator',
	GeneratorFunction:
		'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/GeneratorFunction',
	globalThis:
		'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/globalThis',
	Infinity:
		'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Infinity',
	Int16Array:
		'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Int16Array',
	Int32Array:
		'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Int32Array',
	Int8Array:
		'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Int8Array',
	InternalError:
		'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/InternalError',
	Intl: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl',
	JSON: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON',
	Map: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map',
	Math: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math',
	NaN: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/NaN',
	Number: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number',
	null: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/null',
	Object: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object',
	Promise:
		'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise',
	Proxy: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy',
	RangeError:
		'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RangeError',
	ReferenceError:
		'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ReferenceError',
	Reflect:
		'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect',
	RegExp: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp',
	Set: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set',
	SharedArrayBuffer:
		'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer',
	String: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String',
	Symbol: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol',
	SyntaxError:
		'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SyntaxError',
	TypedArray:
		'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray',
	TypeError:
		'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypeError',
	Uint16Array:
		'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint16Array',
	Uint32Array:
		'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint32Array',
	Uint8Array:
		'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array',
	Uint8ClampedArray:
		'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8ClampedArray',
	undefined:
		'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/undefined',
	URIError:
		'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/URIError',
	WeakMap:
		'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap',
	WeakRef:
		'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakRef',
	WeakSet:
		'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakSet',

	// More advanced MDN types:
	EventTarget: 'https://developer.mozilla.org/en-US/docs/Web/API/EventTarget',
	BroadcastChannel:
		'https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel',
	Headers: 'https://developer.mozilla.org/en-US/docs/Web/API/Headers',
	File: 'https://developer.mozilla.org/en-US/docs/Web/API/File',
	Request: 'https://developer.mozilla.org/en-US/docs/Web/API/Request',
	Response: 'https://developer.mozilla.org/en-US/docs/Web/API/Response',
	URL: 'https://developer.mozilla.org/en-US/docs/Web/API/URL',

	// TypeScript – everyday types
	// https://www.typescriptlang.org/docs/handbook/2/everyday-types.html
	any: 'https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#any',
	unknown:
		'https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#any',
	void: 'https://www.typescriptlang.org/docs/handbook/2/functions.html#void',
	never: 'https://www.typescriptlang.org/docs/handbook/2/functions.html#never',
	object: 'https://www.typescriptlang.org/docs/handbook/2/functions.html#object',
	string: 'https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#the-primitives-string-number-and-boolean',
	number: 'https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#the-primitives-string-number-and-boolean',
	boolean:
		'https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#the-primitives-string-number-and-boolean',
	array: 'https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#arrays',

	// TypeScript – utility types
	// https://www.typescriptlang.org/docs/handbook/utility-types.html
	Awaited:
		'https://www.typescriptlang.org/docs/handbook/utility-types.html#awaitedtype',
	Partial:
		'https://www.typescriptlang.org/docs/handbook/utility-types.html#partialtype',
	Required:
		'https://www.typescriptlang.org/docs/handbook/utility-types.html#requiredtype',
	Readonly:
		'https://www.typescriptlang.org/docs/handbook/utility-types.html#readonlytype',
	ReadOnlyArray:
		'https://www.typescriptlang.org/docs/handbook/2/objects.html#the-readonlyarray-type',
	Record: 'https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type',
	Pick: 'https://www.typescriptlang.org/docs/handbook/utility-types.html#picktype-keys',
	Omit: 'https://www.typescriptlang.org/docs/handbook/utility-types.html#omittype-keys',
	Exclude:
		'https://www.typescriptlang.org/docs/handbook/utility-types.html#excludeuniontype-excludedmembers',
	Extract:
		'https://www.typescriptlang.org/docs/handbook/utility-types.html#extracttype-union',
	NonNullable:
		'https://www.typescriptlang.org/docs/handbook/utility-types.html#nonnullabletype',
	Parameters:
		'https://www.typescriptlang.org/docs/handbook/utility-types.html#parameterstype',
	ConstructorParameters:
		'https://www.typescriptlang.org/docs/handbook/utility-types.html#constructorparameterstype',
	ReturnType:
		'https://www.typescriptlang.org/docs/handbook/utility-types.html#returntypetype',
	InstanceType:
		'https://www.typescriptlang.org/docs/handbook/utility-types.html#instancetypetype',
	ThisParameterType:
		'https://www.typescriptlang.org/docs/handbook/utility-types.html#thisparametertypetype',
	OmitThisParameter:
		'https://www.typescriptlang.org/docs/handbook/utility-types.html#omitthisparametertype',
	ThisType:
		'https://www.typescriptlang.org/docs/handbook/utility-types.html#thistypetype',
	Uppercase:
		'https://www.typescriptlang.org/docs/handbook/utility-types.html#uppercasestringtype',
	Lowercase:
		'https://www.typescriptlang.org/docs/handbook/utility-types.html#lowercasestringtype',
	Capitalize:
		'https://www.typescriptlang.org/docs/handbook/utility-types.html#capitalizestringtype',
	Uncapitalize:
		'https://www.typescriptlang.org/docs/handbook/utility-types.html#uncapitalizestringtype',
};
