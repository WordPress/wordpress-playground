// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

import {
	ApiParameterListMixin,
	ApiItem,
	ApiDeclaredItem,
	ApiClass,
} from '@microsoft/api-extractor-model';
import { DocLinkTag, DocNode, DocPlainText } from '@microsoft/tsdoc';
import ts from 'typescript';
import { DocContentBlock } from '../nodes/DocContentBlock';
import { DocMaybe } from '../nodes/DocMaybe';
export class Utilities {
	private static readonly _badFilenameCharsRegExp: RegExp =
		/[^a-z0-9_\-\.]/gi;

	public static getUnscopedPackageName(packageName: string) {
		return packageName.split('/').pop() || '';
	}

	/**
	 * Generates a concise signature for a function. Example: "getArea(width, height)"
	 */
	public static getConciseSignature(
		apiItem: ApiItem,
		apiClass?: ApiClass
	): string {
		let signature = Utilities.getDisplayName(apiItem, apiClass!);
		if (ApiParameterListMixin.isBaseClassOf(apiItem)) {
			signature +=
				'(' + apiItem.parameters.map((x) => x.name).join(', ') + ')';
		}
		return signature;
	}

	/**
	 * Produces a signature without less useful modifiers like
	 * `export` or `default` to avoid cluttering the documentation.
	 *
	 * @param apiItem
	 */
	public static getSignatureExcerpt(apiItem: ApiDeclaredItem): string {
		let signature = apiItem.getExcerptWithModifiers();
		while (true) {
			const conciseSignature = signature.replace(
				/^(export|default|declare) /,
				''
			);
			if (conciseSignature === signature) {
				break;
			}
			signature = conciseSignature;
		}
		return signature;
	}

	public static forEachChildRecursive(
		node: DocNode,
		cb: (node: DocNode) => void
	): void {
		node.getChildNodes().forEach((child) => {
			cb(child);
			Utilities.forEachChildRecursive(child, cb);
		});
	}

	/**
	 * Converts bad filename characters to underscores.
	 */
	public static getSafeFilenameForName(name: string): string {
		// TODO: This can introduce naming collisions.
		// We will fix that as part of https://github.com/microsoft/rushstack/issues/1308
		return name
			.replace(Utilities._badFilenameCharsRegExp, '_')
			.toLowerCase();
	}

	public static getDisplayName(
		apiItem: ApiItem,
		apiClass?: ApiClass
	): string {
		if (apiItem.displayName.startsWith('(constructor)')) {
			return apiClass!.displayName;
		}
		return apiItem.displayName;
	}

	public static nodeToText(node: DocNode): string {
		const result: string[] = [];

		const stack = [node];
		while (stack.length) {
			const node = stack.pop();
			if (node instanceof DocPlainText) {
				result.push(node.text);
			} else if (node instanceof DocLinkTag) {
				result.push(node.linkText || '');
			} else if (
				node instanceof DocContentBlock &&
				node.type === 'whitespace'
			) {
				result.push(node.whitespaceCharacter || '');
			} else if (node?.getChildNodes().length) {
				if (node instanceof DocMaybe && !node.isActive) {
					continue;
				}
				stack.push(...(node.getChildNodes() as Array<any>).reverse());
			}
		}
		return result.join('');
	}

	public static classifyTypeExpression(
		code: string,
		ignoreTokens: Set<string> = new Set()
	) {
		const filename = 'test.ts';
		const sourceFile = ts.createSourceFile(
			filename,
			code,
			ts.ScriptTarget.Latest
		);

		const allTokens: ClassifiedToken[] = [];
		let cursor = 0;

		function classifyRecursive(
			node: ts.Node,
			indentLevel: number,
			sourceFile: ts.SourceFile
		) {
			let childrenToMap = [...node.getChildren(sourceFile)];
			let hasChildren = childrenToMap.length > 0;

			// Uncomment to debug:
			// const indentation = '-'.repeat(indentLevel);
			// const nodeText = node.getText(sourceFile);
			// const syntaxKind = ts.SyntaxKind[node.kind];
			// console.log(`${indentation}${syntaxKind}: ${nodeText}`);

			const doPush = (entry: ClassifiedToken) => {
				if (entry.text) {
					allTokens.push(entry);
				}
			};

			const classify = (x: ts.Node, isLinkable: boolean) => {
				if (ignoreTokens.has(x.getText(sourceFile))) {
					isLinkable = false;
				}
				const start = x.getStart(sourceFile);
				if (cursor < start) {
					doPush({
						text: code.substring(cursor, start),
						isLinkable: false,
					});
					cursor = start;
				}
				const end = x.getEnd();
				const text = code.substring(cursor, end);
				doPush({
					text,
					isLinkable,
				});
				cursor = x.getEnd();
			};

			switch (node.kind) {
				case ts.SyntaxKind.AnyKeyword:
				case ts.SyntaxKind.StringKeyword:
				case ts.SyntaxKind.NumberKeyword:
				case ts.SyntaxKind.BooleanKeyword:
				case ts.SyntaxKind.SymbolKeyword:
				case ts.SyntaxKind.VoidKeyword:
				case ts.SyntaxKind.UnknownKeyword:
				case ts.SyntaxKind.Identifier:
					classify(node, true);
					break;
				case ts.SyntaxKind.TypeReference: {
					const identifier = childrenToMap.splice(0, 1)[0]!;
					classify(identifier, true);
					break;
				}
				case ts.SyntaxKind.FunctionDeclaration: {
					const [keyword, name] = childrenToMap.splice(0, 2)!;
					classify(keyword, false);
					classify(name, false);
					break;
				}
				case ts.SyntaxKind.TypeParameter: {
					const name = childrenToMap.splice(0, 1)[0]!;
					ignoreTokens.add(name.getText(sourceFile));
					classify(name, false);
					break;
				}
				case ts.SyntaxKind.Parameter: {
					const name = childrenToMap.splice(0, 1)[0]!;
					classify(name, false);
					break;
				}
				default: {
					if (!hasChildren) {
						classify(node, false);
					}
				}
			}

			childrenToMap.forEach((child) =>
				classifyRecursive(child, indentLevel + 1, sourceFile)
			);
		}

		classifyRecursive(sourceFile, 0, sourceFile);
		return allTokens;
	}
}

export interface ClassifiedToken {
	text: string;
	isLinkable: boolean;
}

// console.log(
// 	Utilities.classifyTypeExpression(`
// 	ApplicationInitStatus(appInits: ReadOnlyArray<() => Observable<unknown> | Promise<unknown> | void>)
// 	`)
// );
// process.exit(0);
