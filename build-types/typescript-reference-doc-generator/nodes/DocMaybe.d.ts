import { IDocNodeParameters, DocNode } from '@microsoft/tsdoc';
/**
 * Constructor parameters for {@link DocContentBlock}.
 */
export interface IDocMaybeParameters extends IDocNodeParameters {
    predicate: () => boolean;
}
export declare class DocMaybe extends DocNode {
    private readonly _predicate;
    private _items;
    constructor(parameters: IDocMaybeParameters, items: ReadonlyArray<DocNode>);
    get isActive(): boolean;
    /** @override */
    get kind(): string;
    /** @override */
    protected onGetChildNodes(): ReadonlyArray<DocNode | undefined>;
}
