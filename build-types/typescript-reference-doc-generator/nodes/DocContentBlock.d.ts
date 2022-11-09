import { IDocNodeParameters, DocNode } from '@microsoft/tsdoc';
export declare type ContentBlockType = 'block' | 'inline' | 'ul' | 'ol' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'whitespace' | 'literal';
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
export declare class DocContentBlock extends DocNode {
    readonly type: ContentBlockType;
    readonly whitespaceCharacter?: string;
    readonly text: string;
    private _items;
    constructor(parameters: IContentBlockParameters, items?: ReadonlyArray<DocNode>);
    get hasItems(): boolean;
    get isList(): boolean;
    get isHeading(): boolean;
    get isWhitespace(): boolean;
    get headingLevel(): number;
    /** @override */
    get kind(): string;
    get items(): ReadonlyArray<DocNode>;
    addItems(items: readonly DocNode[]): void;
    prependItem(item: DocNode): void;
    addItem(item: DocNode): void;
    /** @override */
    protected onGetChildNodes(): ReadonlyArray<DocNode | undefined>;
}
