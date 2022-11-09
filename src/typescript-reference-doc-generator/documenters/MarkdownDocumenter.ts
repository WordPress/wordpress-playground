// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

import * as path from 'path';
import * as fs from 'fs';
import {
	DocSection,
	DocPlainText,
	DocLinkTag,
	TSDocConfiguration,
	StringBuilder,
	DocParagraph,
	DocCodeSpan,
	DocFencedCode,
	StandardTags,
	DocBlock,
	DocComment,
	DocNode,
	DocExcerpt,
	DocErrorText,
} from '@microsoft/tsdoc';
import {
	ApiModel,
	ApiItem,
	ApiEnum,
	ApiPackage,
	ApiItemKind,
	ApiReleaseTagMixin,
	ApiDocumentedItem,
	ApiClass,
	ReleaseTag,
	ApiStaticMixin,
	ApiPropertyItem,
	ApiInterface,
	Excerpt,
	ApiParameterListMixin,
	ApiReturnTypeMixin,
	ApiDeclaredItem,
	ApiNamespace,
	ExcerptTokenKind,
	ApiTypeAlias,
	ExcerptToken,
	ApiOptionalMixin,
	ApiInitializerMixin,
	ApiProtectedMixin,
	ApiReadonlyMixin,
	IFindApiItemsResult,
	Parameter,
	ApiProperty,
	HeritageType,
	ApiTypeParameterListMixin,
} from '@microsoft/api-extractor-model';

import { CustomDocNodes } from '../nodes/CustomDocNodeKind';
import { DocTable } from '../nodes/DocTable';
import {
	DocEmphasisSpan,
	IDocEmphasisSpanParameters,
} from '../nodes/DocEmphasisSpan';
import { DocTableRow } from '../nodes/DocTableRow';
import { DocTableCell } from '../nodes/DocTableCell';
import { DocNoteBox } from '../nodes/DocNoteBox';
import { ClassifiedToken, Utilities } from '../utils/Utilities';
import { CustomMarkdownEmitter } from '../markdown/CustomMarkdownEmitter';
import type { DocumenterConfig } from './DocumenterConfig';
import { ContentBlockType, DocContentBlock } from '../nodes/DocContentBlock';
import {
	BuilderArg,
	DocContentBlockBuilder,
} from '../utils/DocContentBlockBuilder';
import TypeResolver from '../utils/TypeResolver';
import { DocMaybe } from '../nodes/DocMaybe';

export interface IMarkdownDocumenterOptions {
	apiModel: ApiModel;
	documenterConfig: DocumenterConfig | undefined;
	outputFolder: string;
}

(DocParagraph.prototype as any).toBlock = function (
	type: ContentBlockType = 'inline'
): DocContentBlock {
	return new DocContentBlock(
		{ configuration: this.configuration, type },
		this.getChildNodes()
	);
};

/**
 * Renders API documentation in the Markdown file format.
 * For more info:  https://en.wikipedia.org/wiki/Markdown
 */
export class MarkdownDocumenter {
	private readonly _apiModel: ApiModel;
	private readonly _documenterConfig: DocumenterConfig | undefined;
	private readonly _tsdocConfiguration: TSDocConfiguration;
	private readonly _markdownEmitter: CustomMarkdownEmitter;
	private readonly _outputFolder: string;
	private readonly _typeResolver: TypeResolver;

	public constructor(options: IMarkdownDocumenterOptions) {
		this._apiModel = options.apiModel;
		this._documenterConfig = options.documenterConfig;
		this._outputFolder = options.outputFolder;
		this._tsdocConfiguration = CustomDocNodes.configuration;
		this._markdownEmitter = new CustomMarkdownEmitter(this._apiModel);
		this._typeResolver = new TypeResolver(
			this._apiModel,
			(apiItem: ApiItem) => {
				return this._getLinkFilenameForApiItem(apiItem);
			}
		);
	}

	public generateFiles(): void {
		this._deleteOldOutputFiles();

		try {
			this._writeApiItemPage(this._apiModel);
		} catch (e) {
			console.error(e);
			throw e;
		}
	}

	private _writeApiItemPage(apiItem: ApiItem): void {
		const configuration: TSDocConfiguration = this._tsdocConfiguration;
		const output: DocSection = this.section();

		const scopedName: string = apiItem.getScopedNameWithinPackage();

		switch (apiItem.kind) {
			case ApiItemKind.Class:
				output.appendNode(this.heading(`${scopedName} class`));
				break;
			case ApiItemKind.Enum:
				output.appendNode(this.heading(`${scopedName} enum`));
				break;
			case ApiItemKind.Interface:
				output.appendNode(this.heading(`${scopedName} interface`));
				break;
			case ApiItemKind.Constructor:
			case ApiItemKind.ConstructSignature:
				output.appendNode(this.heading(scopedName));
				break;
			case ApiItemKind.Method:
			case ApiItemKind.MethodSignature:
				output.appendNode(this.heading(`${scopedName} method`));
				break;
			case ApiItemKind.Function:
				output.appendNode(this.heading(`${scopedName} function`));
				break;
			case ApiItemKind.Model:
				output.appendNode(this.heading(`API Reference`));
				break;
			case ApiItemKind.Namespace:
				output.appendNode(this.heading(`${scopedName} namespace`));
				break;
			case ApiItemKind.Package:
				console.log(`Writing ${apiItem.displayName} package`);
				const unscopedPackageName: string =
					Utilities.getUnscopedPackageName(apiItem.displayName);
				output.appendNode(
					this.heading(`${unscopedPackageName} package`)
				);
				break;
			case ApiItemKind.Property:
			case ApiItemKind.PropertySignature:
				output.appendNode(this.heading(`${scopedName} property`));
				break;
			case ApiItemKind.TypeAlias:
				output.appendNode(this.heading(`${scopedName} type`));
				break;
			case ApiItemKind.Variable:
				output.appendNode(this.heading(`${scopedName} variable`));
				break;
			default:
				throw new Error('Unsupported API item kind: ' + apiItem.kind);
		}

		if (ApiReleaseTagMixin.isBaseClassOf(apiItem)) {
			if (apiItem.releaseTag === ReleaseTag.Beta) {
				const betaWarning: string =
					'This API is provided as a preview for developers and may change' +
					' based on feedback that we receive.  Do not use this API in a production environment.';
				output.appendNode(
					new DocNoteBox({ configuration }, [
						this.paragraph([this.text(betaWarning)]),
					])
				);
			}
		}

		const decoratorBlocks: DocBlock[] = [];

		if (apiItem instanceof ApiDeclaredItem) {
			if (
				apiItem.kind === ApiItemKind.Function &&
				ApiParameterListMixin.isBaseClassOf(apiItem)
			) {
				output.appendNode(
					this._createSignatureWithTypesLinkedToDefinitions(
						apiItem,
						undefined,
						true
					)
				);
			} else if (apiItem.excerpt.text.length > 0) {
				output.appendNode(
					this.paragraph([this.text('Signature:', { bold: true })])
				);

				output.appendNode(
					new DocFencedCode({
						configuration,
						code: Utilities.getSignatureExcerpt(apiItem),
						language: 'typescript',
					})
				);
			}

			this._writeHeritageTypes(output, apiItem);
		}

		this._writeRemarksSection(output, apiItem);

		let writtenDescription = false;
		switch (apiItem.kind) {
			case ApiItemKind.Method:
			case ApiItemKind.MethodSignature:
			case ApiItemKind.Function:
				break;
			default:
				this._writeDescriptionSection(output, apiItem);
				writtenDescription = true;
		}

		switch (apiItem.kind) {
			case ApiItemKind.Class:
				this._writeClassMembers(output, apiItem as ApiClass);
				break;
			case ApiItemKind.Enum:
				this._writeEnumTables(output, apiItem as ApiEnum);
				break;
			case ApiItemKind.Interface:
				this._writeInterfaceMembers(output, apiItem as ApiInterface);
				break;
			case ApiItemKind.Constructor:
			case ApiItemKind.ConstructSignature:
			case ApiItemKind.Method:
			case ApiItemKind.MethodSignature:
			case ApiItemKind.Function:
				output.appendNode(
					this._createParametersList(apiItem as ApiParameterListMixin)
				);
				output.appendNode(this._createThrowsSection(apiItem));
				break;
			case ApiItemKind.Namespace:
				this._writePackageOrNamespaceTables(
					output,
					apiItem as ApiNamespace
				);
				break;
			case ApiItemKind.Model:
				this._writeModelTable(output, apiItem as ApiModel);
				break;
			case ApiItemKind.Package:
				this._writePackageOrNamespaceTables(
					output,
					apiItem as ApiPackage
				);
				break;
			case ApiItemKind.Property:
			case ApiItemKind.PropertySignature:
				break;
			case ApiItemKind.TypeAlias:
				break;
			case ApiItemKind.Variable:
				break;
			default:
				throw new Error('Unsupported API item kind: ' + apiItem.kind);
		}

		if (apiItem instanceof ApiDocumentedItem) {
			const tsdocComment: DocComment | undefined = apiItem.tsdocComment;

			if (tsdocComment) {
				decoratorBlocks.push(
					...tsdocComment.customBlocks.filter(
						(block) =>
							block.blockTag.tagNameWithUpperCase ===
							StandardTags.decorator.tagNameWithUpperCase
					)
				);
			}
		}

		if (!writtenDescription) {
			this._writeDescriptionSection(output, apiItem);
		}

		if (decoratorBlocks.length > 0) {
			output.appendNode(
				this.paragraph([this.text('Decorators:', { bold: true })])
			);
			for (const decoratorBlock of decoratorBlocks) {
				output.appendNodes(decoratorBlock.content.nodes);
			}
		}

		this._writeExamplesSection(output, apiItem);

		const filename: string = path.join(
			this._outputFolder,
			this._getFilenameForApiItem(apiItem)
		);
		const stringBuilder: StringBuilder = new StringBuilder();

		stringBuilder.append(
			'<!-- Do not edit this file. It is automatically generated by API Documenter. -->\n\n'
		);

		this._markdownEmitter.emit(stringBuilder, output, {
			contextApiItem: apiItem,
			onGetFilenameForApiItem: (apiItemForFilename: ApiItem) => {
				return this._getLinkFilenameForApiItem(apiItemForFilename);
			},
		});

		const pageContent: string = stringBuilder.toString();

		fs.writeFileSync(filename, pageContent);
	}

	private _writeDescriptionSection(
		output: DocSection,
		apiItem: ApiItem
	): void {
		const configuration: TSDocConfiguration = this._tsdocConfiguration;

		if (apiItem instanceof ApiDocumentedItem) {
			const tsdocComment: DocComment | undefined = apiItem.tsdocComment;

			if (tsdocComment) {
				const asText = Utilities.nodeToText(tsdocComment);
				if (asText.includes(`is_uploaded_file`)) {
					debugger;
				}
				if (tsdocComment.deprecatedBlock) {
					output.appendNode(
						new DocNoteBox({ configuration }, [
							this.paragraph([
								this.text(
									'Warning: This API is now obsolete. '
								),
							]),
							...tsdocComment.deprecatedBlock.content.nodes,
						])
					);
				}

				output.appendNodes(tsdocComment.summarySection.nodes);
			}
		}
	}

	private _writeHeritageTypes(
		output: DocSection,
		apiItem: ApiDeclaredItem
	): void {
		if (apiItem instanceof ApiClass) {
			if (apiItem.extendsType) {
				output.appendNode(
					this.build([
						this.text('Extends: ', { bold: true }),
						this.formatTypeExpression(
							apiItem,
							apiItem.extendsType.excerpt
						),
					]).toContentBlock('block')
				);
			}
			if (apiItem.implementsTypes.length > 0) {
				output.appendNode(
					this.build([
						this.text('Implements: ', { bold: true }),
						this.build(
							apiItem.implementsTypes.map((implementsType) =>
								this.formatTypeExpression(
									apiItem,
									implementsType.excerpt
								)
							)
						)
							.join(this.text(', '))
							.toContentBlock('inline'),
					]).toContentBlock('block')
				);
			}
		}

		if (apiItem instanceof ApiInterface) {
			if (apiItem.extendsTypes.length > 0) {
				output.appendNode(
					this.build([
						this.text('Extends: ', { bold: true }),
						this.build(
							apiItem.extendsTypes.map((extendsType) =>
								this.formatTypeExpression(
									apiItem,
									extendsType.excerpt
								)
							)
						)
							.join(this.text(', '))
							.toContentBlock('inline'),
					]).toContentBlock('block')
				);
			}
		}

		if (apiItem instanceof ApiTypeAlias) {
			const refs: ExcerptToken[] = apiItem.excerptTokens.filter(
				(token) =>
					token.kind === ExcerptTokenKind.Reference &&
					token.canonicalReference &&
					this._apiModel.resolveDeclarationReference(
						token.canonicalReference,
						undefined
					).resolvedApiItem
			);
			if (refs.length > 0) {
				const referencesParagraph: DocParagraph = this.paragraph([
					this.text('References: ', { bold: true }),
				]);
				let needsComma: boolean = false;
				const visited: Set<string> = new Set();
				for (const ref of refs) {
					if (visited.has(ref.text)) {
						continue;
					}
					visited.add(ref.text);

					if (needsComma) {
						referencesParagraph.appendNode(this.text(', '));
					}

					referencesParagraph.appendNode(
						this.formatTypeIdentifier(ref)
					);
					needsComma = true;
				}
				output.appendNode(referencesParagraph);
			}
		}
	}

	private _writeRemarksSection(output: DocSection, apiItem: ApiItem): void {
		if (apiItem instanceof ApiDocumentedItem) {
			const tsdocComment: DocComment | undefined = apiItem.tsdocComment;

			if (tsdocComment) {
				// Write the @remarks block
				if (tsdocComment.remarksBlock) {
					output.appendNode(this.heading('Remarks'));
					output.appendNodes(tsdocComment.remarksBlock.content.nodes);
				}
			}
		}
	}

	private _writeExamplesSection(output: DocSection, apiItem: ApiItem): void {
		if (apiItem instanceof ApiDocumentedItem) {
			const tsdocComment: DocComment | undefined = apiItem.tsdocComment;

			if (tsdocComment) {
				// Write the @example blocks
				const exampleBlocks: DocBlock[] =
					tsdocComment.customBlocks.filter(
						(x) =>
							x.blockTag.tagNameWithUpperCase ===
							StandardTags.example.tagNameWithUpperCase
					);

				let exampleNumber: number = 1;
				for (const exampleBlock of exampleBlocks) {
					const heading: string =
						exampleBlocks.length > 1
							? `Example ${exampleNumber}`
							: 'Example';

					output.appendNode(this.heading(heading));
					output.appendNodes(exampleBlock.content.nodes);
					++exampleNumber;
				}
			}
		}
	}

	private _createThrowsSection(apiItem: ApiItem): DocNode {
		if (!(apiItem instanceof ApiDocumentedItem)) {
			return this.block();
		}
		const tsdocComment: DocComment | undefined = apiItem.tsdocComment;
		if (!tsdocComment) {
			return this.block();
		}

		const throwsListItems = tsdocComment.customBlocks
			.filter(
				(block) =>
					block.blockTag.tagNameWithUpperCase ===
					StandardTags.throws.tagNameWithUpperCase
			)
			.map((throwsBlock) => {
				const errorClassName = (
					(
						throwsBlock.content
							.getChildNodes()[0]
							?.getChildNodes()
							.find(
								(node) => node instanceof DocLinkTag
							) as DocLinkTag
					)?.codeDestination?.memberReferences[0]?.memberIdentifier?.getChildNodes()[0] as any as DocExcerpt
				)?.content?.toString();

				this.build([
					errorClassName && this.formatTypeIdentifier(errorClassName),
					throwsBlock.content,
				])
					.join(this.text(' – '))
					.toContentBlock('inline');
			});

		if (throwsListItems.length === 0) {
			return this.block();
		}

		return this.build()
			.concat(this.paragraph([this.text('Exceptions:')]))
			.concat(this.block(throwsListItems, 'ul'))
			.toContentBlock();
	}

	/**
	 * GENERATE PAGE: MODEL
	 *
	 * @param  output
	 * @param  apiModel
	 */
	private _writeModelTable(output: DocSection, apiModel: ApiModel): void {
		const packagesTable: DocTable = this.table(['Package', 'Description']);

		for (const apiMember of apiModel.members) {
			const row: DocTableRow = this.tableRow([
				this._createTitleCell(apiMember),
				this._createDescriptionCell(apiMember),
			]);

			switch (apiMember.kind) {
				case ApiItemKind.Package:
					packagesTable.addRow(row);
					this._writeApiItemPage(apiMember);
					break;
			}
		}

		if (packagesTable.rows.length > 0) {
			output.appendNode(this.heading('Packages'));
			output.appendNode(packagesTable);
		}
	}

	/**
	 * GENERATE PAGE: PACKAGE or NAMESPACE
	 *
	 * @param  output
	 * @param  apiContainer
	 */
	private _writePackageOrNamespaceTables(
		output: DocSection,
		apiContainer: ApiPackage | ApiNamespace
	): void {
		const classesList: DocContentBlock = this.block([], 'ul');
		const enumerationsList: DocContentBlock = this.block([], 'ul');
		const functionsList: DocContentBlock = this.block([], 'ul');
		const interfacesList: DocContentBlock = this.block([], 'ul');
		const namespacesList: DocContentBlock = this.block([], 'ul');
		const variablesList: DocContentBlock = this.block([], 'ul');
		const typeAliasesList: DocContentBlock = this.block([], 'ul');

		const apiMembers: ReadonlyArray<ApiItem> =
			apiContainer.kind === ApiItemKind.Package
				? (apiContainer as ApiPackage).entryPoints[0].members
				: (apiContainer as ApiNamespace).members;

		for (const apiMember of apiMembers) {
			const item = this._createTitleListItem(apiMember);

			switch (apiMember.kind) {
				case ApiItemKind.Class:
					classesList.addItem(item);
					this._writeApiItemPage(apiMember);
					break;

				case ApiItemKind.Enum:
					enumerationsList.addItem(item);
					this._writeApiItemPage(apiMember);
					break;

				case ApiItemKind.Interface:
					interfacesList.addItem(item);
					this._writeApiItemPage(apiMember);
					break;

				case ApiItemKind.Namespace:
					namespacesList.addItem(item);
					this._writeApiItemPage(apiMember);
					break;

				case ApiItemKind.Function:
					functionsList.addItem(item);
					this._writeApiItemPage(apiMember);
					break;

				case ApiItemKind.TypeAlias:
					typeAliasesList.addItem(item);
					this._writeApiItemPage(apiMember);
					break;

				case ApiItemKind.Variable:
					variablesList.addItem(item);
					this._writeApiItemPage(apiMember);
					break;
			}
		}

		if (classesList.items.length > 0) {
			output.appendNode(this.heading('Classes'));
			output.appendNode(classesList);
		}

		if (enumerationsList.items.length > 0) {
			output.appendNode(this.heading('Enumerations'));
			output.appendNode(enumerationsList);
		}

		if (functionsList.items.length > 0) {
			output.appendNode(this.heading('Functions'));
			output.appendNode(functionsList);
		}

		if (interfacesList.items.length > 0) {
			output.appendNode(this.heading('Interfaces'));
			output.appendNode(interfacesList);
		}

		if (namespacesList.items.length > 0) {
			output.appendNode(this.heading('Namespaces'));
			output.appendNode(namespacesList);
		}

		if (variablesList.items.length > 0) {
			output.appendNode(this.heading('Variables'));
			output.appendNode(variablesList);
		}

		if (typeAliasesList.items.length > 0) {
			output.appendNode(this.heading('Type Aliases'));
			output.appendNode(typeAliasesList);
		}
	}

	/**
	 * GENERATE PAGE: CLASS
	 *
	 * @param  output
	 * @param  apiClass
	 */
	private _writeClassMembers(output: DocSection, apiClass: ApiClass): void {
		const eventsTable: DocTable = this.table([
			'Property',
			'Modifiers',
			'Type',
			'Description',
		]);

		const constructorsList: DocContentBlock = this.block([], 'block');
		const propertiesList: DocContentBlock = this.block([], 'ul');
		const methodsList: DocContentBlock = this.block([], 'block');

		const apiMembers: readonly ApiItem[] =
			this._getMembersAndWriteIncompleteWarning(apiClass, output);
		for (const apiMember of apiMembers) {
			const isInherited: boolean = apiMember.parent !== apiClass;
			switch (apiMember.kind) {
				case ApiItemKind.Constructor: {
					constructorsList.addItems([
						this.block(
							[
								this._createSignatureWithTypesLinkedToDefinitions(
									apiMember,
									apiClass
								),
							],
							'h3'
						),
						this._createParametersList(
							apiMember as ApiParameterListMixin
						),
						...this._createModifiersCell(
							apiMember
						).content.getChildNodes(),
						this.buildDescriptionBlock(
							apiMember,
							isInherited
						).toContentBlock(),
					]);

					this._writeApiItemPage(apiMember);
					break;
				}
				case ApiItemKind.Method: {
					methodsList.addItems([
						this.block(
							[
								this._createSignatureWithTypesLinkedToDefinitions(
									apiMember,
									apiClass
								),
							],
							'h3'
						),
						this._createParametersList(
							apiMember as ApiParameterListMixin
						),
						this._createThrowsSection(apiMember),
						...this._createModifiersCell(
							apiMember
						).content.getChildNodes(),
						this.buildDescriptionBlock(
							apiMember,
							isInherited
						).toContentBlock(),
					]);

					this._writeApiItemPage(apiMember);
					break;
				}
				case ApiItemKind.Property: {
					if ((apiMember as ApiPropertyItem).isEventProperty) {
						eventsTable.addRow(
							this.tableRow([
								this._createTitleCell(apiMember),
								this._createModifiersCell(apiMember),
								this._createPropertyTypeCell(apiMember),
								this._createDescriptionCell(
									apiMember,
									isInherited
								),
							])
						);
					} else {
						propertiesList.addItem(
							this._createPropertyItem(
								apiMember as ApiProperty,
								isInherited
							)
						);
					}

					this._writeApiItemPage(apiMember);
					break;
				}
			}
		}

		if (eventsTable.rows.length > 0) {
			output.appendNode(this.heading('Events'));
			output.appendNode(eventsTable);
		}

		if (constructorsList.items.length > 0) {
			output.appendNode(this.heading('Constructors'));
			output.appendNode(constructorsList);
		}

		if (propertiesList.items.length > 0) {
			output.appendNode(this.heading('Properties'));
			output.appendNode(propertiesList);
		}

		if (methodsList.items.length > 0) {
			output.appendNode(this.heading('Methods'));
			output.appendNode(this.section([methodsList]));
		}
	}

	/**
	 * GENERATE PAGE: ENUM
	 *
	 * @param  output
	 * @param  apiEnum
	 */
	private _writeEnumTables(output: DocSection, apiEnum: ApiEnum): void {
		const enumMembersTable: DocTable = this.table([
			'Member',
			'Value',
			'Description',
		]);

		for (const apiEnumMember of apiEnum.members) {
			enumMembersTable.addRow(
				this.tableRow([
					this.tableCell([
						this.paragraph([
							this.text(
								Utilities.getConciseSignature(apiEnumMember)
							),
						]),
					]),
					this._createInitializerCell(apiEnumMember),
					this._createDescriptionCell(apiEnumMember),
				])
			);
		}

		if (enumMembersTable.rows.length > 0) {
			output.appendNode(this.heading('Enumeration Members'));
			output.appendNode(enumMembersTable);
		}
	}

	/**
	 * GENERATE PAGE: INTERFACE
	 *
	 * @param  output
	 * @param  apiInterface
	 */
	private _writeInterfaceMembers(
		output: DocSection,
		apiInterface: ApiInterface
	): void {
		const eventsTable: DocTable = this.table([
			'Property',
			'Modifiers',
			'Type',
			'Description',
		]);
		const propertiesList: DocContentBlock = this.block([], 'ul');
		const methodsList: DocContentBlock = this.block([], 'ul');

		const apiMembers: readonly ApiItem[] =
			this._getMembersAndWriteIncompleteWarning(apiInterface, output);
		for (const apiMember of apiMembers) {
			const isInherited: boolean = apiMember.parent !== apiInterface;
			switch (apiMember.kind) {
				case ApiItemKind.ConstructSignature:
				case ApiItemKind.MethodSignature: {
					methodsList.addItem(
						this.build([
							...this._createTitleCell(
								apiMember
							).content.getChildNodes(),
							this.buildDescriptionBlock(
								apiMember,
								isInherited
							).toContentBlock(),
						]).toContentBlock()
					);

					this._writeApiItemPage(apiMember);
					break;
				}
				case ApiItemKind.PropertySignature: {
					if ((apiMember as ApiPropertyItem).isEventProperty) {
						eventsTable.addRow(
							this.tableRow([
								this._createTitleCell(apiMember),
								this._createModifiersCell(apiMember),
								this._createPropertyTypeCell(apiMember),
								this._createDescriptionCell(
									apiMember,
									isInherited
								),
							])
						);
					} else {
						propertiesList.addItem(
							this._createPropertyItem(
								apiMember as ApiProperty,
								isInherited
							)
						);
					}

					this._writeApiItemPage(apiMember);
					break;
				}
			}
		}

		if (eventsTable.rows.length > 0) {
			output.appendNode(this.heading('Events'));
			output.appendNode(eventsTable);
		}

		if (propertiesList.items.length > 0) {
			output.appendNode(this.heading('Properties'));
			output.appendNode(propertiesList);
		}

		if (methodsList.items.length > 0) {
			output.appendNode(this.heading('Methods'));
			output.appendNode(methodsList);
		}
	}

	/**
	 * GENERATE PAGE: FUNCTION-LIKE
	 *
	 * @param  apiParameterListMixin
	 * @param  root0
	 * @param  root0.withTypes
	 */
	private _createParametersList(
		apiParameterListMixin: ApiParameterListMixin,
		{ withTypes = false } = {}
	): DocContentBlock {
		const parametersList: DocContentBlock = this.block([], 'ul');

		if (apiParameterListMixin.parameters.length > 0) {
			for (const apiParameter of apiParameterListMixin.parameters) {
				const descriptionNode = this.build()
					.concat(apiParameter.isOptional && this.text('Optional.'))
					.concat(
						this.formatApiParameterDescription(
							apiParameterListMixin,
							apiParameter
						)
					)
					.join(this.space())
					// .flatten()
					.toContentBlockMaybe();
				if (!descriptionNode) {
					continue;
				}
				parametersList.addItem(
					this.build()
						.concat(
							this.build([
								this.code(apiParameter.name),
								withTypes &&
									this.formatTypeExpression(
										apiParameterListMixin,
										apiParameter.parameterTypeExcerpt
									),
							])
								.join(this.space())
								.toContentBlock('inline')
						)
						.concat(descriptionNode)
						.join(this.text('–'))
						.join(this.space())
						.toContentBlock()
				);
			}
		}

		if (ApiReturnTypeMixin.isBaseClassOf(apiParameterListMixin)) {
			this._assertReturnsBlockDoesNotIncludeType(apiParameterListMixin);
			const returnType =
				apiParameterListMixin instanceof ApiDocumentedItem &&
				apiParameterListMixin?.tsdocComment?.returnsBlock?.content;
			if (returnType) {
				parametersList.addItem(
					this.build()
						.concat(this.text('Returns:'))
						.concat(this.space())
						.concat(returnType)
						.toContentBlock()
				);
			}
		}

		return parametersList;
	}

	private _assertReturnsBlockDoesNotIncludeType(
		apiParameterListMixin: ApiParameterListMixin
	): void {
		const returnBlockContent =
			apiParameterListMixin instanceof ApiDocumentedItem &&
			apiParameterListMixin?.tsdocComment?.returnsBlock?.content;

		if (!returnBlockContent) {
			return;
		}

		const nodes =
			returnBlockContent.getChildNodes()[0]?.getChildNodes() || [];
		for (let i = 0; i < nodes.length; i++) {
			const node = nodes[i];
			if (node instanceof DocErrorText && i <= 2 && node.text === '{') {
				const source = [
					apiParameterListMixin.parent?.displayName,
					apiParameterListMixin.displayName,
				]
					.filter((x) => x)
					.join('.');
				throw new Error(
					"Don't use { } in the @returns block. Instead, use the TypeScript syntax to define the return type in " +
						source +
						'.'
				);
			}
		}
	}

	private _createPropertyItem(
		apiMember: ApiProperty,
		isInherited: boolean
	): DocContentBlock {
		return this.build([
			this.code(Utilities.getConciseSignature(apiMember)),
			this.space(),
		])
			.concat(this._createModifiersDescription(apiMember))
			.concat(
				this.build([
					this.formatTypeExpression(
						apiMember,
						apiMember.propertyTypeExcerpt
					),
					this.buildDescriptionBlock(
						apiMember,
						isInherited
					).toContentBlockMaybe('inline'),
				])
					.join(this.text('–'))
					.join(this.space())
			)
			.join(this.space())
			.toContentBlock();
	}

	private _createModifiersDescription(apiItem: ApiItem): DocContentBlock {
		return this.build(
			this._getModifiers(apiItem).map((name) => this.text(name))
		)
			.join(this.block([this.text(', '), this.space()]))
			.toContentBlock('inline');
	}

	private _getModifiers(apiItem: ApiItem): string[] {
		const modifiers: string[] = [];

		if (ApiProtectedMixin.isBaseClassOf(apiItem)) {
			if (apiItem.isProtected) {
				modifiers.push('protected');
			}
		}

		if (ApiReadonlyMixin.isBaseClassOf(apiItem)) {
			if (apiItem.isReadonly) {
				modifiers.push('readonly');
			}
		}

		if (ApiStaticMixin.isBaseClassOf(apiItem)) {
			if (apiItem.isStatic) {
				modifiers.push('static');
			}
		}
		return modifiers;
	}

	public formatTypeExpression(
		apiItem: ApiItem,
		typeExcerpt: Excerpt
	): DocNode {
		// Turn a token sequence into a string for TS to parse
		const typeExpression = typeExcerpt.spannedTokens
			.map(({ text }) => text)
			.join('');

		// Build an index of canonical tokens
		const canonicalTokenIndex: Record<string, string> = {};
		for (const token of typeExcerpt.spannedTokens) {
			const canonicalUrl =
				this._typeResolver.resolveCanonicalReference(token);
			if (canonicalUrl) {
				canonicalTokenIndex[token.text] = canonicalUrl;
			}
		}

		// Take note of the type parameters to avoid linking them
		const typeParameters = ApiTypeParameterListMixin.isBaseClassOf(apiItem)
			? apiItem.typeParameters.map((t) => t.name)
			: [];

		const classifiedTokens = Utilities.classifyTypeExpression(
			typeExpression,
			new Set(typeParameters)
		);

		const linkedTokens = classifiedTokens
			.map(({ text, isLinkable }: ClassifiedToken) => {
				if (!isLinkable) {
					return { text };
				}

				if (canonicalTokenIndex[text]) {
					return { text, url: canonicalTokenIndex[text] };
				}

				const nativeResult =
					this._typeResolver.resolveNativeToken(text);
				if (nativeResult) {
					return {
						text: nativeResult.name,
						url: nativeResult.docUrl,
					};
				}

				if (!MarkdownDocumenter.seenTypeTokens.has(text)) {
					if (MarkdownDocumenter.seenTypeTokens.size === 0) {
						console.warn(
							`No definition was found for some type tokens listed below with ❌. ` +
								`This means they won't be linked to their definition using <a href=""></a> in the documentation. \n` +
								`Please check if the type, the imports etc are correct. If this type comes from ` +
								`a third-party library, please add it to the list of known types in the NativeTypes object.`
						);
					}
					const source = this.formatExcerptSource(apiItem);
					console.warn(`❌ Couldn't resolve "${text}" in ${source}`);
					MarkdownDocumenter.seenTypeTokens.add(text);
				}
				return { text };
			})
			.map(({ text, url }) => ({
				text: text.replace('\n', ' ').trim(),
				url,
			}));

		return this.block(
			linkedTokens.map(({ text, url }) => {
				if (url) {
					return this.link(text, url);
				}
				return this.text(text);
			}),
			'inline'
		);
	}

	public formatTypeIdentifier(type: ExcerptToken | string) {
		const resolved = this._typeResolver.resolveTypeDocumentation(type);
		if (resolved) {
			return this.link(resolved.name, resolved.docUrl);
		} else if (type instanceof ExcerptToken) {
			return this.text(type.text);
		}
		return this.text(type);
	}

	private formatApiParameterDescription(
		apiParameterListMixin: ApiParameterListMixin,
		apiParameter: Parameter
	): BuilderArg {
		const contentSection = apiParameter.tsdocParamBlock?.content;
		if (contentSection) {
			// Remove the leading whitespaces and slashes from the
			// parameters descriptions
			const str = this.nodeToMarkdown(
				apiParameterListMixin,
				apiParameter.tsdocParamBlock!.content
			);
			return [this.literal(str.replace(/^(\s[\-–—])+/, ''))];
		}
		return [];
	}

	private static seenTypeTokens = new Set();

	private formatExcerptSource(source: ApiItem | HeritageType): string {
		if (source instanceof HeritageType) {
			return source.excerpt.text;
		} else if (source instanceof ApiItem) {
			return source.canonicalReference.toString();
		}
		console.warn('Unknown source', { source });
		throw new Error('Unknown source');
	}

	private _createTitleCell(apiItem: ApiItem): DocTableCell {
		let linkText: string = Utilities.getConciseSignature(apiItem);
		if (ApiOptionalMixin.isBaseClassOf(apiItem) && apiItem.isOptional) {
			linkText += '?';
		}

		return this.tableCell([
			this.paragraph([
				this.link(linkText, this._getLinkFilenameForApiItem(apiItem)),
			]),
		]);
	}

	private _createTitleListItem(apiItem: ApiItem): DocNode {
		return this.paragraph([this._createApiItemLinkTag(apiItem)]);
	}

	private _createApiItemLinkTag(apiItem: ApiItem): DocLinkTag {
		// Remove the arguments:
		let linkText: string =
			Utilities.getConciseSignature(apiItem).split('(')[0];
		if (ApiOptionalMixin.isBaseClassOf(apiItem) && apiItem.isOptional) {
			linkText += '?';
		}

		return this.link(linkText, this._getLinkFilenameForApiItem(apiItem));
	}

	/**
	 * This generates a DocTableCell for an ApiItem including the summary section and "(BETA)" annotation.
	 *
	 * @param  apiItem
	 * @param  isInherited
	 * @remarks
	 * We mostly assume that the input is an ApiDocumentedItem, but it's easier to perform this as a runtime
	 * check than to have each caller perform a type cast.
	 */
	private buildDescriptionBlock(
		apiItem: ApiItem,
		isInherited: boolean = false
	): DocContentBlockBuilder {
		return this.build([
			ApiReleaseTagMixin.isBaseClassOf(apiItem) &&
				apiItem.releaseTag === ReleaseTag.Beta &&
				this.paragraph([
					this.text('(BETA)', { bold: true, italic: true }),
				]),
			ApiOptionalMixin.isBaseClassOf(apiItem) &&
				apiItem.isOptional &&
				this.paragraph([this.text('(Optional)', { italic: true })]),
		])
			.concat(
				apiItem instanceof ApiDocumentedItem &&
					apiItem.tsdocComment?.summarySection &&
					this.literal(
						this.nodeToMarkdown(
							apiItem,
							apiItem.tsdocComment!.summarySection
						)
					)
			)
			.concat([
				isInherited &&
					apiItem.parent &&
					this.paragraph([
						this.text('(Inherited from '),
						this.link(
							apiItem.parent.displayName,
							this._getLinkFilenameForApiItem(apiItem.parent)
						),
						this.text(')'),
					]),
			])
			.join(this.space());
	}

	private _createDescriptionCell(
		apiItem: ApiItem,
		isInherited: boolean = false
	): DocTableCell {
		const desc = this.buildDescriptionBlock(
			apiItem,
			isInherited
		).toContentBlockMaybe('inline');
		return this.tableCell(desc ? [desc] : []);
	}

	private _createModifiersCell(apiItem: ApiItem): DocTableCell {
		return this.tableCell(
			this._createModifiersDescription(apiItem).getChildNodes()
		);
	}

	private _createPropertyTypeCell(apiItem: ApiItem): DocTableCell {
		const section: DocSection = this.section();

		if (apiItem instanceof ApiPropertyItem) {
			section.appendNode(
				this.formatTypeExpression(apiItem, apiItem.propertyTypeExcerpt)
			);
		}

		return this.tableCell(section.nodes);
	}

	private _createInitializerCell(apiItem: ApiItem): DocTableCell {
		const section: DocSection = this.section();

		if (ApiInitializerMixin.isBaseClassOf(apiItem)) {
			if (apiItem.initializerExcerpt) {
				section.appendNodeInParagraph(
					this.code(apiItem.initializerExcerpt.text)
				);
			}
		}

		return this.tableCell(section.nodes);
	}

	private _getMembersAndWriteIncompleteWarning(
		apiClassOrInterface: ApiClass | ApiInterface,
		output: DocSection
	): readonly ApiItem[] {
		const showInheritedMembers: boolean =
			!!this._documenterConfig?.configFile.showInheritedMembers;
		if (!showInheritedMembers) {
			return apiClassOrInterface.members;
		}

		const result: IFindApiItemsResult =
			apiClassOrInterface.findMembersWithInheritance();

		// If the result is potentially incomplete, write a short warning communicating this.
		if (result.maybeIncompleteResult) {
			output.appendNode(
				this.paragraph([
					this.text(
						'(Some inherited members may not be shown because they are not represented in the documentation.)',
						{
							italic: true,
						}
					),
				])
			);
		}

		// Log the messages for diagnostic purposes.
		for (const message of result.messages) {
			console.log(
				`Diagnostic message for findMembersWithInheritance: ${message.text}`
			);
		}

		return result.items;
	}

	private _getFilenameForApiItem(apiItem: ApiItem): string {
		if (apiItem.kind === ApiItemKind.Model) {
			return 'index.md';
		}

		let baseName: string = '';
		for (const hierarchyItem of apiItem.getHierarchy()) {
			// For overloaded methods, add a suffix such as "MyClass.myMethod_2".
			let qualifiedName: string = Utilities.getSafeFilenameForName(
				hierarchyItem.displayName
			);
			if (ApiParameterListMixin.isBaseClassOf(hierarchyItem)) {
				if (hierarchyItem.overloadIndex > 1) {
					// Subtract one for compatibility with earlier releases of API Documenter.
					// (This will get revamped when we fix GitHub issue #1308)
					qualifiedName += `_${hierarchyItem.overloadIndex - 1}`;
				}
			}

			switch (hierarchyItem.kind) {
				case ApiItemKind.Model:
				case ApiItemKind.EntryPoint:
				case ApiItemKind.EnumMember:
					break;
				case ApiItemKind.Package:
					baseName = Utilities.getSafeFilenameForName(
						Utilities.getUnscopedPackageName(
							hierarchyItem.displayName
						)
					);
					break;
				default:
					baseName += '.' + qualifiedName;
			}
		}
		return baseName + '.md';
	}

	private _getLinkFilenameForApiItem(apiItem: ApiItem): string {
		return './' + this._getFilenameForApiItem(apiItem);
	}

	private _deleteOldOutputFiles(): void {
		console.log('Deleting old output from ' + this._outputFolder);

		fs.readdirSync(this._outputFolder).forEach((file) => {
			fs.unlinkSync(path.join(this._outputFolder, file));
		});
	}

	private _createSignatureWithTypesLinkedToDefinitions(
		apiItem: ApiItem,
		apiClass?: ApiClass,
		wrap: boolean = false
	): DocContentBlock {
		const typeParameters = ApiTypeParameterListMixin.isBaseClassOf(apiItem)
			? apiItem.typeParameters
			: [];
		const apiParameters = ApiParameterListMixin.isBaseClassOf(apiItem)
			? apiItem.parameters
			: [];
		const returnTypeExcerpt =
			ApiReturnTypeMixin.isBaseClassOf(apiItem) &&
			apiItem.returnTypeExcerpt;

		let shouldWrapTypeParameters = false;
		const typeParametersNodes = typeParameters.length
			? typeParameters.flatMap(
					(typeParameter, i) =>
						this.build([
							this.text(typeParameter.name),
							typeParameter.constraintExcerpt?.text && [
								this.text('extends'),
								this.formatTypeExpression(
									apiItem,
									typeParameter.constraintExcerpt
								),
							],
							typeParameter.defaultTypeExcerpt?.text && [
								this.text('='),
								this.formatTypeExpression(
									apiItem,
									typeParameter.defaultTypeExcerpt
								),
							],
						])
							.join(this.space())
							.prepend(
								this.maybe(
									[this.softnl(), this.indent()],
									() => shouldWrapTypeParameters
								)
							)
							.concat(
								i !== typeParameters.length - 1 && [
									this.text(','),
									this.space(),
								]
							).childNodes
			  )
			: [];

		let shouldWrapArguments = false;
		const argumentsNodes = apiParameters.flatMap(
			(param, i) =>
				this.build([
					this.text(`${param.name}${param.isOptional ? '?' : ''}`),
				])
					.concat(
						!param.parameterTypeExcerpt.isEmpty && [
							this.text(':'),
							this.space(),
							this.formatTypeExpression(
								apiItem,
								param.parameterTypeExcerpt
							),
						]
					)
					.prepend(
						this.maybe(
							[this.softnl(), this.indent()],
							() => shouldWrapArguments
						)
					)
					.concat(
						i !== apiParameters.length - 1 && [
							this.text(','),
							this.space(),
						]
					).childNodes
		);

		const signature = this.build([
			this.text(Utilities.getDisplayName(apiItem, apiClass)),
		])
			.concat(
				typeParametersNodes.length && [
					this.text('<'),
					...typeParametersNodes,
					this.maybe([this.softnl()], () => shouldWrapArguments),
					shouldWrapTypeParameters && this.softnl(),
					this.literal('&gt;'),
				]
			)
			.concat([
				this.text('('),
				...argumentsNodes,
				this.maybe([this.softnl()], () => shouldWrapArguments),
				this.text(')'),
			])
			.concat(
				returnTypeExcerpt && [
					this.text(':'),
					this.space(),
					this.formatTypeExpression(apiItem, returnTypeExcerpt),
				]
			);

		if (wrap) {
			const typeParamsLength = Utilities.nodeToText(
				this.block(typeParametersNodes)
			).length;
			const argsLength = Utilities.nodeToText(
				this.block(argumentsNodes)
			).length;
			const signatureLength = Utilities.nodeToText(
				this.block(argumentsNodes)
			).length;

			if (typeParamsLength > 50) {
				shouldWrapTypeParameters = true;
			}

			if (argsLength > 50) {
				shouldWrapArguments = true;
			}

			if (signatureLength > 80) {
				shouldWrapTypeParameters = true;
				shouldWrapArguments = true;
			}
		}

		return signature.toContentBlock();
	}

	private heading(text: string, level = 2) {
		return this.block([this.text(text)], ('h' + level) as any);
	}

	private build(nodes?: BuilderArg) {
		return DocContentBlockBuilder.create(this._tsdocConfiguration, nodes);
	}

	private code(code: string): DocNode {
		const configuration: TSDocConfiguration = this._tsdocConfiguration;
		return new DocCodeSpan({ configuration, code });
	}

	private literal(text: string): DocNode {
		const configuration: TSDocConfiguration = this._tsdocConfiguration;
		return new DocContentBlock({ configuration, type: 'literal', text });
	}

	private table(
		headerTitles: string[] = [],
		nodes: readonly DocTableRow[] = []
	) {
		const configuration: TSDocConfiguration = this._tsdocConfiguration;
		return new DocTable({ configuration, headerTitles }, nodes);
	}

	private tableRow(nodes: readonly DocTableCell[] = []) {
		const configuration: TSDocConfiguration = this._tsdocConfiguration;
		return new DocTableRow({ configuration }, nodes);
	}

	private tableCell(nodes: readonly DocNode[] = []) {
		const configuration: TSDocConfiguration = this._tsdocConfiguration;
		return new DocTableCell({ configuration }, nodes);
	}

	private text(
		text: string,
		emphasis?: Omit<IDocEmphasisSpanParameters, 'configuration'>
	): DocNode {
		const configuration: TSDocConfiguration = this._tsdocConfiguration;
		const textNode = new DocPlainText({ configuration, text });
		if (emphasis) {
			return new DocEmphasisSpan({ configuration, bold: true }, [
				textNode,
			]);
		}
		return textNode;
	}

	private maybe(nodes: DocNode[], predicate: () => boolean) {
		const configuration: TSDocConfiguration = this._tsdocConfiguration;
		return new DocMaybe({ configuration, predicate }, nodes);
	}

	private paragraph(nodes: readonly DocNode[]): DocParagraph {
		const configuration: TSDocConfiguration = this._tsdocConfiguration;
		return new DocParagraph({ configuration }, nodes);
	}

	private section(nodes: readonly DocNode[] = []): DocSection {
		const configuration: TSDocConfiguration = this._tsdocConfiguration;
		return new DocSection({ configuration }, nodes);
	}

	private block(
		nodes: BuilderArg = [],
		type: ContentBlockType = 'block'
	): DocContentBlock {
		return this.build(nodes).toContentBlock(type);
	}

	private link(text: string, url: string): DocLinkTag {
		const configuration: TSDocConfiguration = this._tsdocConfiguration;
		return new DocLinkTag({
			configuration,
			tagName: '@link',
			linkText: text,
			urlDestination: url,
		});
	}

	private space(): DocNode {
		return this._whitespace(' ');
	}

	private softnl(): DocNode {
		return this.literal('\\\n');
	}

	private indent(): DocNode {
		return this.literal('&emsp;&emsp;&emsp;');
	}

	private _whitespace(character: string) {
		const configuration: TSDocConfiguration = this._tsdocConfiguration;
		return new DocContentBlock({
			configuration,
			type: 'whitespace',
			character,
		});
	}

	private nodeToMarkdown(apiItem: ApiItem, node: DocNode): string {
		const stringBuilder: StringBuilder = new StringBuilder();
		return this._markdownEmitter
			.emit(stringBuilder, node, {
				contextApiItem: apiItem,
				onGetFilenameForApiItem: (apiItemForFilename: ApiItem) => {
					return this._getLinkFilenameForApiItem(apiItemForFilename);
				},
			})
			.replace(/^(\s|\n)*/m, '')
			.replace(/(\s|\n)*$/m, '');
	}
}
