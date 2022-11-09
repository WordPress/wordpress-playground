import { DocNode, StringBuilder, DocLinkTag } from '@microsoft/tsdoc';
import { IndentedWriter } from '../utils/IndentedWriter';
export interface IMarkdownEmitterOptions {
}
export interface IMarkdownEmitterContext<TOptions = IMarkdownEmitterOptions> {
    writer: IndentedWriter;
    insideTable: boolean;
    inlineBlockNestingLevel: number;
    boldRequested: boolean;
    italicRequested: boolean;
    writingBold: boolean;
    writingItalic: boolean;
    options: TOptions;
}
/**
 * Renders MarkupElement content in the Markdown file format.
 * For more info:  https://en.wikipedia.org/wiki/Markdown
 */
export declare class MarkdownEmitter {
    emit(stringBuilder: StringBuilder, docNode: DocNode, options: IMarkdownEmitterOptions): string;
    /**
     * Escapes the HTML characters in plain text.
     * Does not escape the markdown characters as plain text is
     * allowed to use markdown.
     *
     * @param  text - The text to be encoded
     * @returns The encoded text
     */
    protected getEscapedText(text: string): string;
    protected getTableEscapedText(text: string): string;
    /**
     * @param  docNode
     * @param  context
     * @param  docNodeSiblings
     * @abstract
     */
    protected writeNode(docNode: DocNode, context: IMarkdownEmitterContext, docNodeSiblings: boolean): void;
    /**
     * @param  docLinkTag
     * @param  context
     * @abstract
     */
    protected writeLinkTagWithCodeDestination(docLinkTag: DocLinkTag, context: IMarkdownEmitterContext): void;
    /**
     * @param  docLinkTag
     * @param  context
     * @abstract
     */
    protected writeLinkTagWithUrlDestination(docLinkTag: DocLinkTag, context: IMarkdownEmitterContext): void;
    protected writePlainText(text: string, context: IMarkdownEmitterContext): void;
    protected writeNodes(docNodes: ReadonlyArray<DocNode>, context: IMarkdownEmitterContext): void;
}
