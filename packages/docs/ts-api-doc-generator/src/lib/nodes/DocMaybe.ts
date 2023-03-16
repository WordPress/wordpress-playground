// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

import { IDocNodeParameters, DocNode } from '@microsoft/tsdoc';
import { CustomDocNodeKind } from './CustomDocNodeKind';

/**
 * Constructor parameters for {@link DocContentBlock}.
 */
export interface IDocMaybeParameters extends IDocNodeParameters {
	predicate: () => boolean;
}

export class DocMaybe extends DocNode {
	private readonly _predicate: () => boolean;

	private _items: DocNode[];

	public constructor(
		parameters: IDocMaybeParameters,
		items: ReadonlyArray<DocNode>
	) {
		super(parameters);

		this._predicate = parameters.predicate;
		this._items = [...items];
	}

	public get isActive(): boolean {
		return this._predicate();
	}

	/** @override */
	public get kind(): string {
		return CustomDocNodeKind.Maybe;
	}

	/** @override */
	protected override onGetChildNodes(): ReadonlyArray<DocNode | undefined> {
		return this._items;
	}
}
