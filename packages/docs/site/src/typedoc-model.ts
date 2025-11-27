// @ts-ignore
import api from './model.json';
import type {
	ProjectReflection,
	ContainerReflection,
	DeclarationReflection,
} from 'typedoc';

// Avoid importing values from 'typedoc' as that
// pulls in the entire library including cumbersome
// node.js imports.
export enum ReflectionKind {
	Project = 1,
	Module = 2,
	Namespace = 4,
	Enum = 8,
	EnumMember = 16,
	Variable = 32,
	Function = 64,
	Class = 128,
	Interface = 256,
	Constructor = 512,
	Property = 1024,
	Method = 2048,
	CallSignature = 4096,
	IndexSignature = 8192,
	ConstructorSignature = 16384,
	Parameter = 32768,
	TypeLiteral = 65536,
	TypeParameter = 131072,
	Accessor = 262144,
	GetSignature = 524288,
	SetSignature = 1048576,
	/** @deprecated will be removed in v0.25, not used */
	ObjectLiteral = 2097152,
	TypeAlias = 4194304,
	Reference = 8388608,
}

const typed = api as any as ProjectReflection;

export function getModule(name: string): ContainerReflection | undefined {
	return typed.children?.find(
		(child) => child.name === name && child.kind === ReflectionKind.Module
	);
}

export function getMember<
	T extends DeclarationReflection = DeclarationReflection
>(moduleName: string, name: string, kind?: ReflectionKind): T | undefined {
	return getModule(moduleName).children?.find(
		(child) =>
			child.name === name && (kind === undefined || child.kind === kind)
	) as T | undefined;
}

export function getByPath(...path: string[]) {
	let current = typed as ContainerReflection;
	for (const name of path) {
		const next = current.children?.find((child) => child.name === name);
		if (!next) {
			const pathTraversed = path.slice(0, path.indexOf(name)).join('.');
			throw new Error(
				`Invalid API member: ${path.join(
					'.'
				)}. Node '${name}' not found in node '${pathTraversed}'.}`
			);
		}
		current = next;
	}
	// Deep clone
	return JSON.parse(JSON.stringify(current));
}
