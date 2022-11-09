import { DocNode } from '@microsoft/tsdoc';
import { ApiModel, ApiItem, Excerpt, ExcerptToken } from '@microsoft/api-extractor-model';
import type { DocumenterConfig } from './DocumenterConfig';
export interface IMarkdownDocumenterOptions {
    apiModel: ApiModel;
    documenterConfig: DocumenterConfig | undefined;
    outputFolder: string;
}
/**
 * Renders API documentation in the Markdown file format.
 * For more info:  https://en.wikipedia.org/wiki/Markdown
 */
export declare class MarkdownDocumenter {
    private readonly _apiModel;
    private readonly _documenterConfig;
    private readonly _tsdocConfiguration;
    private readonly _markdownEmitter;
    private readonly _outputFolder;
    private readonly _typeResolver;
    constructor(options: IMarkdownDocumenterOptions);
    generateFiles(): void;
    private _writeApiItemPage;
    private _writeDescriptionSection;
    private _writeHeritageTypes;
    private _writeRemarksSection;
    private _writeExamplesSection;
    private _createThrowsSection;
    /**
     * GENERATE PAGE: MODEL
     *
     * @param  output
     * @param  apiModel
     */
    private _writeModelTable;
    /**
     * GENERATE PAGE: PACKAGE or NAMESPACE
     *
     * @param  output
     * @param  apiContainer
     */
    private _writePackageOrNamespaceTables;
    /**
     * GENERATE PAGE: CLASS
     *
     * @param  output
     * @param  apiClass
     */
    private _writeClassMembers;
    /**
     * GENERATE PAGE: ENUM
     *
     * @param  output
     * @param  apiEnum
     */
    private _writeEnumTables;
    /**
     * GENERATE PAGE: INTERFACE
     *
     * @param  output
     * @param  apiInterface
     */
    private _writeInterfaceMembers;
    /**
     * GENERATE PAGE: FUNCTION-LIKE
     *
     * @param  apiParameterListMixin
     * @param  root0
     * @param  root0.withTypes
     */
    private _createParametersList;
    private _assertReturnsBlockDoesNotIncludeType;
    private _createPropertyItem;
    private _createModifiersDescription;
    private _getModifiers;
    formatTypeExpression(apiItem: ApiItem, typeExcerpt: Excerpt): DocNode;
    formatTypeIdentifier(type: ExcerptToken | string): DocNode;
    private formatApiParameterDescription;
    private static seenTypeTokens;
    private formatExcerptSource;
    private _createTitleCell;
    private _createTitleListItem;
    private _createApiItemLinkTag;
    /**
     * This generates a DocTableCell for an ApiItem including the summary section and "(BETA)" annotation.
     *
     * @param  apiItem
     * @param  isInherited
     * @remarks
     * We mostly assume that the input is an ApiDocumentedItem, but it's easier to perform this as a runtime
     * check than to have each caller perform a type cast.
     */
    private buildDescriptionBlock;
    private _createDescriptionCell;
    private _createModifiersCell;
    private _createPropertyTypeCell;
    private _createInitializerCell;
    private _getMembersAndWriteIncompleteWarning;
    private _getFilenameForApiItem;
    private _getLinkFilenameForApiItem;
    private _deleteOldOutputFiles;
    private _createSignatureWithTypesLinkedToDefinitions;
    private heading;
    private build;
    private code;
    private literal;
    private table;
    private tableRow;
    private tableCell;
    private text;
    private maybe;
    private paragraph;
    private section;
    private block;
    private link;
    private space;
    private softnl;
    private indent;
    private _whitespace;
    private nodeToMarkdown;
}
