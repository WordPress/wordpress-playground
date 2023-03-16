// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

import { IDocNodeParameters, DocNode } from '@microsoft/tsdoc';
import { CustomDocNodeKind } from './CustomDocNodeKind';

export type ContentBlockType =
	| 'block'
	| 'inline'
	| 'ul'
	| 'ol'
	| 'h1'
	| 'h2'
	| 'h3'
	| 'h4'
	| 'h5'
	| 'h6'
	| 'whitespace'
	| 'literal';

/**
 * Constructor parameters for {@link DocContentBlock}.
 */
export interface IContentBlockParameters extends IDocNodeParameters {
	type?: ContentBlockType;
	character?: string;
	text?: string;
}

/**
 * Represents List, similar to an HTML `<List>` element.
 */
export class DocContentBlock extends DocNode {
	public readonly type: ContentBlockType;
	public readonly whitespaceCharacter?: string;
	public readonly text: string = '';

	private _items: DocNode[];

	public constructor(
		parameters: IContentBlockParameters,
		items?: ReadonlyArray<DocNode>
	) {
		super(parameters);

		this.type = parameters.type || 'block';
		if (this.type === 'whitespace') {
			this.whitespaceCharacter = parameters.character?.slice(0, 1) || ' ';
		} else if (this.type === 'literal') {
			this.text = parameters.text || '';
		}
		this._items = [];

		if (items) {
			for (const item of items) {
				this.addItem(item);
			}
		}
	}

	public get hasItems(): boolean {
		return this._items.length > 0;
	}

	public get isList(): boolean {
		return ['ul', 'ol'].includes(this.type);
	}

	public get isHeading(): boolean {
		return this.type.startsWith('h');
	}

	public get isWhitespace(): boolean {
		return this.type === 'whitespace';
	}

	public get headingLevel(): number {
		if (this.isHeading) {
			return parseInt(this.type[1], 10);
		}
		return 0;
	}

	/** @override */
	public get kind(): string {
		return CustomDocNodeKind.ContentBlock;
	}

	public get items(): ReadonlyArray<DocNode> {
		return this._items;
	}

	public addItems(items: readonly DocNode[]): void {
		this._items.push(...items);
	}

	public prependItem(item: DocNode): void {
		this._items.unshift(item);
	}

	public addItem(item: DocNode): void {
		this._items.push(item);
	}

	/** @override */
	protected override onGetChildNodes(): ReadonlyArray<DocNode | undefined> {
		return this._items;
	}
}
