import * as fs from 'fs';
import * as colors from 'colors';
import * as path from 'path';
import type * as tsdoc from '@microsoft/tsdoc';
import {
	ApiDocumentedItem,
	ApiItem,
	ApiItemContainerMixin,
	ApiModel,
	IResolveDeclarationReferenceResult,
} from '@microsoft/api-extractor-model';

export class ApiModelBuilder {
	public buildApiModel(inputFolder: string) {
		const apiModel: ApiModel = new ApiModel();

		for (const filename of fs.readdirSync(inputFolder)) {
			if (filename.match(/\.api\.json$/i)) {
				console.log(`Reading ${filename}`);
				const filenamePath: string = path.join(inputFolder, filename);
				apiModel.loadPackage(filenamePath);
			}
		}

		this._applyInheritDoc(apiModel, apiModel);

		return apiModel;
	}

	// TODO: This is a temporary workaround.  The long term plan is for API Extractor's DocCommentEnhancer
	// to apply all @inheritDoc tags before the .api.json file is written.
	// See DocCommentEnhancer._applyInheritDoc() for more info.
	private _applyInheritDoc(apiItem: ApiItem, apiModel: ApiModel): void {
		if (apiItem instanceof ApiDocumentedItem) {
			if (apiItem.tsdocComment) {
				const inheritDocTag: tsdoc.DocInheritDocTag | undefined =
					apiItem.tsdocComment.inheritDocTag;

				if (inheritDocTag && inheritDocTag.declarationReference) {
					// Attempt to resolve the declaration reference
					const result: IResolveDeclarationReferenceResult =
						apiModel.resolveDeclarationReference(
							inheritDocTag.declarationReference,
							apiItem
						);

					if (result.errorMessage) {
						console.log(
							colors.yellow(
								`Warning: Unresolved @inheritDoc tag for ${apiItem.displayName}: ` +
									result.errorMessage
							)
						);
					} else if (
						result.resolvedApiItem instanceof ApiDocumentedItem &&
						result.resolvedApiItem.tsdocComment &&
						result.resolvedApiItem !== apiItem
					) {
						this._copyInheritedDocs(
							apiItem.tsdocComment,
							result.resolvedApiItem.tsdocComment
						);
					}
				}
			}
		}

		// Recurse members
		if (ApiItemContainerMixin.isBaseClassOf(apiItem)) {
			for (const member of apiItem.members) {
				this._applyInheritDoc(member, apiModel);
			}
		}
	}

	/**
	 * Copy the content from `sourceDocComment` to `targetDocComment`.
	 * This code is borrowed from DocCommentEnhancer as a temporary workaround.
	 *
	 * @param  targetDocComment
	 * @param  sourceDocComment
	 */
	private _copyInheritedDocs(
		targetDocComment: tsdoc.DocComment,
		sourceDocComment: tsdoc.DocComment
	): void {
		targetDocComment.summarySection = sourceDocComment.summarySection;
		targetDocComment.remarksBlock = sourceDocComment.remarksBlock;

		targetDocComment.params.clear();
		for (const param of sourceDocComment.params) {
			targetDocComment.params.add(param);
		}
		for (const typeParam of sourceDocComment.typeParams) {
			targetDocComment.typeParams.add(typeParam);
		}
		targetDocComment.returnsBlock = sourceDocComment.returnsBlock;

		targetDocComment.inheritDocTag = undefined;
	}
}
