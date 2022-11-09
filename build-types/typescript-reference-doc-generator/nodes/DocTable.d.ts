import { IDocNodeParameters, DocNode } from '@microsoft/tsdoc';
import { DocTableRow } from './DocTableRow';
import type { DocTableCell } from './DocTableCell';
/**
 * Constructor parameters for {@link DocTable}.
 */
export interface IDocTableParameters extends IDocNodeParameters {
    headerCells?: ReadonlyArray<DocTableCell>;
    headerTitles?: string[];
}
/**
 * Represents table, similar to an HTML `<table>` element.
 */
export declare class DocTable extends DocNode {
    readonly header: DocTableRow;
    private _rows;
    constructor(parameters: IDocTableParameters, rows?: ReadonlyArray<DocTableRow>);
    /** @override */
    get kind(): string;
    get rows(): ReadonlyArray<DocTableRow>;
    addRow(row: DocTableRow): void;
    createAndAddRow(): DocTableRow;
    /** @override */
    protected onGetChildNodes(): ReadonlyArray<DocNode | undefined>;
}
