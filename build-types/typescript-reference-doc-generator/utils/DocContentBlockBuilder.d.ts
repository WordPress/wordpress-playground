import { DocNode, TSDocConfiguration } from '@microsoft/tsdoc';
import { ContentBlockType, DocContentBlock } from '../nodes/DocContentBlock';
declare type BuilderArgItem = DocNode | unknown;
export declare type BuilderArg = readonly BuilderArgItem[] | BuilderArgItem[] | DocContentBlockBuilder | unknown;
/**
 * Represents List, similar to an HTML `<List>` element.
 */
export declare class DocContentBlockBuilder {
    private _nodes;
    private configuration;
    private preferredBlockType;
    get nodes(): readonly DocNode[];
    static create(configuration: TSDocConfiguration, nodes?: BuilderArg): DocContentBlockBuilder;
    constructor(configuration: TSDocConfiguration, nodes?: BuilderArg);
    setPreferredBlockType(type: ContentBlockType): this;
    clone(): DocContentBlockBuilder;
    fork(nodes?: BuilderArg): DocContentBlockBuilder;
    private static toNodesList;
    prepend(nodes: BuilderArg): this;
    concat(nodes: BuilderArg): this;
    toContentBlockMaybe(type?: ContentBlockType): DocContentBlock | null;
    get childNodes(): readonly DocNode[];
    toContentBlock(type?: ContentBlockType): DocContentBlock;
    join(separator: DocNode): this;
    flatten(): this;
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
    private static flattenBlocks;
}
export {};
