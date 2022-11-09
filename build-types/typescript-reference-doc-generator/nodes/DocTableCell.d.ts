import { IDocNodeParameters, DocNode, DocSection } from '@microsoft/tsdoc';
/**
 * Constructor parameters for {@link DocTableCell}.
 */
export interface IDocTableCellParameters extends IDocNodeParameters {
}
/**
 * Represents table cell, similar to an HTML `<td>` element.
 */
export declare class DocTableCell extends DocNode {
    readonly content: DocSection;
    constructor(parameters: IDocTableCellParameters, sectionChildNodes?: ReadonlyArray<DocNode>);
    /** @override */
    get kind(): string;
}
