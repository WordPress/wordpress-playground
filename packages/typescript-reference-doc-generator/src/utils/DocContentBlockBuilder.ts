// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

import { DocNode, TSDocConfiguration } from '@microsoft/tsdoc';
import { ContentBlockType, DocContentBlock } from '../nodes/DocContentBlock';

type BuilderArgItem = DocNode | unknown;
export type BuilderArg =
	| readonly BuilderArgItem[]
	| BuilderArgItem[]
	| DocContentBlockBuilder
	| unknown;

/**
 * Represents List, similar to an HTML `<List>` element.
 */
export class DocContentBlockBuilder {
	private _nodes: DocNode[];
	private configuration: TSDocConfiguration;
	private preferredBlockType: ContentBlockType = 'inline';

	public get nodes(): readonly DocNode[] {
		return this._nodes;
	}

	public static create(
		configuration: TSDocConfiguration,
		nodes?: BuilderArg
	) {
		return new DocContentBlockBuilder(configuration, nodes);
	}

	public constructor(configuration: TSDocConfiguration, nodes?: BuilderArg) {
		this.configuration = configuration;
		this._nodes = DocContentBlockBuilder.toNodesList(nodes);
	}

	public setPreferredBlockType(type: ContentBlockType) {
		this.preferredBlockType = type;
		return this;
	}

	public clone() {
		return new DocContentBlockBuilder(this.configuration, this.nodes);
	}

	public fork(nodes?: BuilderArg) {
		return new DocContentBlockBuilder(this.configuration, nodes);
	}

	private static toNodesList(nodes: BuilderArg): DocNode[] {
		let result: Array<DocNode | null | undefined> = [];
		if (Array.isArray(nodes)) {
			result.push(...nodes);
		} else if (nodes instanceof DocNode) {
			result.push(nodes);
		} else if (nodes instanceof DocContentBlockBuilder) {
			result.push(nodes.toContentBlockMaybe());
		}
		return result.filter((node) => node) as DocNode[];
	}

	public prepend(nodes: BuilderArg) {
		this._nodes.unshift(...DocContentBlockBuilder.toNodesList(nodes));
		return this;
	}

	public concat(nodes: BuilderArg) {
		this._nodes.push(...DocContentBlockBuilder.toNodesList(nodes));
		return this;
	}

	public toContentBlockMaybe(
		type?: ContentBlockType
	): DocContentBlock | null {
		if (this.nodes.length === 0) {
			return null;
		}
		return this.toContentBlock(type);
	}

	public get childNodes(): readonly DocNode[] {
		return this.toContentBlock().getChildNodes();
	}

	public toContentBlock(
		type: ContentBlockType = this.preferredBlockType
	): DocContentBlock {
		return new DocContentBlock(
			{
				configuration: this.configuration,
				type,
			},
			this.nodes
		);
	}

	public join(separator: DocNode) {
		const newNodes: DocNode[] = [];
		for (let i = 0; i < this.nodes.length; i++) {
			if (i > 0) {
				newNodes.push(separator);
			}
			newNodes.push(this.nodes[i]);
		}
		this._nodes = newNodes;
		return this;
	}

	public flatten() {
		this._nodes = DocContentBlockBuilder.flattenBlocks(this.nodes);
		return this;
	}

	/**
	 * Removes empty DocContentBlock wrappers, e.g. turns the following
	 * hierarchy:
	 *
	 * DocContentBlock
	 * DocContentBlock
	 *  DocContentBlock
	 *   DocContentBlock
	 *    DocParagraph
	 *    DocPlainText
	 *
	 * Into this:
	 *
	 * DocContentBlock
	 *  DocParagraph
	 *  DocPlainText
	 *
	 * @returns
	 */
	private static flattenBlocks(nodes: readonly DocNode[]): DocNode[] {
		return nodes.flatMap((node) => {
			if (!(node instanceof DocContentBlock)) {
				return [node];
			}
			if (!node.hasItems) {
				return [];
			}
			return DocContentBlockBuilder.flattenBlocks(node.getChildNodes());
		});
	}
}
