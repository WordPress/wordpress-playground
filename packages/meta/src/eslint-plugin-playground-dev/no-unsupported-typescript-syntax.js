/**
 * ESLint rule to disallow TypeScript syntax that's not supported by Node.js type stripping.
 *
 * Node.js type stripping (--experimental-strip-types) only supports removing type annotations
 * but does NOT support TypeScript syntax that has runtime behavior:
 * - Parameter properties (e.g., constructor(private foo: string))
 * - Enums
 * - Namespaces/modules with value statements (type-only namespaces are allowed)
 *
 * @see https://nodejs.org/api/typescript.html#type-stripping
 */

const description =
	'Disallow TypeScript syntax unsupported by Node.js type stripping. ' +
	'Node.js type stripping only removes type annotations but does not support ' +
	'TypeScript-specific syntax that has runtime semantics, such as parameter ' +
	'properties, enums, and namespaces with value statements.';

/**
 * Check if a statement is a value statement (has runtime semantics).
 * Type-only statements like interfaces, type aliases, and ambient declarations are not value statements.
 */
function isValueStatement(node) {
	switch (node.type) {
		case 'ExportNamedDeclaration':
			// Check if the declaration (if any) is a value statement
			return node.declaration ? isValueStatement(node.declaration) : false;
		case 'TSInterfaceDeclaration':
		case 'TSTypeAliasDeclaration':
			// Type declarations don't have runtime semantics
			return false;
		case 'TSModuleDeclaration':
			// Recursively check nested namespaces
			return hasValueStatements(node);
		case 'TSDeclareFunction':
		case 'TSAbstractMethodDefinition':
			// Ambient function declarations don't have runtime semantics
			return false;
		case 'ClassDeclaration':
		case 'FunctionDeclaration':
			// Check for declare keyword - ambient declarations are type-only
			if (node.declare) {
				return false;
			}
			return true;
		case 'VariableDeclaration':
			// Check for declare keyword - ambient declarations are type-only
			if (node.declare) {
				return false;
			}
			return true;
		default:
			// All other statements are considered value statements
			return true;
	}
}

/**
 * Check if a namespace/module has any value statements in its body.
 * Namespaces with only type declarations (interfaces, type aliases) are allowed.
 */
function hasValueStatements(node) {
	// Ambient declarations (declare module/namespace) are type-only
	if (node.declare) {
		return false;
	}

	// String literal module names (declare module "foo") are type-only
	if (node.id && node.id.type === 'Literal') {
		return false;
	}

	// Check the body for value statements
	const body = node.body;

	// Handle nested namespace (A.B.C form)
	if (body && body.type === 'TSModuleDeclaration') {
		return hasValueStatements(body);
	}

	// Check module block body
	if (body && body.type === 'TSModuleBlock' && body.body) {
		return body.body.some(isValueStatement);
	}

	return false;
}

module.exports = {
	meta: {
		type: 'problem',
		docs: {
			description,
			recommended: true,
		},
		messages: {
			parameterProperty:
				'TypeScript parameter property is not supported by Node.js type stripping. ' +
				'Declare the property in the class body and assign it manually in the constructor.',
			enum: 'TypeScript enums are not supported by Node.js type stripping. ' +
				'Use a const object with `as const` assertion instead.',
			namespace:
				'TypeScript namespaces with value statements are not supported by Node.js type stripping. ' +
				'Use ES modules (import/export) instead. Type-only namespaces containing only interfaces and type aliases are allowed.',
		},
		schema: [],
	},
	create(context) {
		return {
			// Detect parameter properties in constructor parameters
			// e.g., constructor(private foo: string)
			TSParameterProperty(node) {
				context.report({
					node,
					messageId: 'parameterProperty',
				});
			},

			// Detect enum declarations
			// e.g., enum Foo { A, B, C }
			TSEnumDeclaration(node) {
				context.report({
					node,
					messageId: 'enum',
				});
			},

			// Detect namespace/module declarations with value statements
			// e.g., namespace Foo { const x = 1; }
			// Type-only namespaces are allowed:
			// e.g., namespace Foo { interface Bar {} }
			TSModuleDeclaration(node) {
				// Only report on the outermost namespace, not nested ones
				if (node.parent && node.parent.type === 'TSModuleDeclaration') {
					return;
				}
				// Only report on top-level namespace declarations (not nested in module blocks)
				if (node.parent && node.parent.type === 'TSModuleBlock') {
					return;
				}
				// Skip export wrappers
				if (node.parent && node.parent.type === 'ExportNamedDeclaration') {
					// Will be handled by visiting the export parent
					return;
				}

				if (hasValueStatements(node)) {
					context.report({
						node,
						messageId: 'namespace',
					});
				}
			},

			// Handle exported namespace declarations
			'ExportNamedDeclaration > TSModuleDeclaration'(node) {
				if (hasValueStatements(node)) {
					context.report({
						node: node.parent, // Report on the export declaration
						messageId: 'namespace',
					});
				}
			},
		};
	},
};
