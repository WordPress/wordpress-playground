import { TSDocConfiguration } from '@microsoft/tsdoc';
/**
 * Identifies custom subclasses of {@link DocNode}.
 */
export declare const enum CustomDocNodeKind {
    EmphasisSpan = "EmphasisSpan",
    Heading = "Heading",
    NoteBox = "NoteBox",
    Table = "Table",
    TableCell = "TableCell",
    TableRow = "TableRow",
    ContentBlock = "ContentBlock",
    Maybe = "Maybe",
    ForceSoftBreak = "ForceSoftBreak"
}
export declare class CustomDocNodes {
    private static _configuration;
    static get configuration(): TSDocConfiguration;
}
