import { ApiModel } from '@microsoft/api-extractor-model';
export declare class ApiModelBuilder {
    buildApiModel(inputFolder: string): ApiModel;
    private _applyInheritDoc;
    /**
     * Copy the content from `sourceDocComment` to `targetDocComment`.
     * This code is borrowed from DocCommentEnhancer as a temporary workaround.
     *
     * @param  targetDocComment
     * @param  sourceDocComment
     */
    private _copyInheritedDocs;
}
