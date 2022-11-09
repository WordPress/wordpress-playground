import { ApiItem, ApiDeclaredItem, ApiClass } from '@microsoft/api-extractor-model';
import { DocNode } from '@microsoft/tsdoc';
export declare class Utilities {
    private static readonly _badFilenameCharsRegExp;
    static getUnscopedPackageName(packageName: string): string;
    /**
     * Generates a concise signature for a function. Example: "getArea(width, height)"
     */
    static getConciseSignature(apiItem: ApiItem, apiClass?: ApiClass): string;
    /**
     * Produces a signature without less useful modifiers like
     * `export` or `default` to avoid cluttering the documentation.
     *
     * @param apiItem
     */
    static getSignatureExcerpt(apiItem: ApiDeclaredItem): string;
    static forEachChildRecursive(node: DocNode, cb: (node: DocNode) => void): void;
    /**
     * Converts bad filename characters to underscores.
     */
    static getSafeFilenameForName(name: string): string;
    static getDisplayName(apiItem: ApiItem, apiClass?: ApiClass): string;
    static nodeToText(node: DocNode): string;
    static classifyTypeExpression(code: string, ignoreTokens?: Set<string>): ClassifiedToken[];
}
export interface ClassifiedToken {
    text: string;
    isLinkable: boolean;
}
