import { IDocNodeParameters, DocNode, DocSection } from '@microsoft/tsdoc';
/**
 * Constructor parameters for {@link DocNoteBox}.
 */
export interface IDocNoteBoxParameters extends IDocNodeParameters {
}
/**
 * Represents a note box, which is typically displayed as a bordered box containing informational text.
 */
export declare class DocNoteBox extends DocNode {
    readonly content: DocSection;
    constructor(parameters: IDocNoteBoxParameters, sectionChildNodes?: ReadonlyArray<DocNode>);
    /** @override */
    get kind(): string;
    /** @override */
    protected onGetChildNodes(): ReadonlyArray<DocNode | undefined>;
}
