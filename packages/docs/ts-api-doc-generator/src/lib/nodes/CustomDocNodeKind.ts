import { TSDocConfiguration, DocNodeKind } from '@microsoft/tsdoc';
import { DocEmphasisSpan } from './DocEmphasisSpan';
import { DocHeading } from './DocHeading';
import { DocNoteBox } from './DocNoteBox';
import { DocTable } from './DocTable';
import { DocTableCell } from './DocTableCell';
import { DocTableRow } from './DocTableRow';
import { DocContentBlock } from './DocContentBlock';
import { DocForceSoftBreak } from './DocForceSoftBreak';
import { DocMaybe } from './DocMaybe';

// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

/**
 * Identifies custom subclasses of {@link DocNode}.
 */
export const enum CustomDocNodeKind {
	EmphasisSpan = 'EmphasisSpan',
	Heading = 'Heading',
	NoteBox = 'NoteBox',
	Table = 'Table',
	TableCell = 'TableCell',
	TableRow = 'TableRow',
	ContentBlock = 'ContentBlock',
	Maybe = 'Maybe',
	ForceSoftBreak = 'ForceSoftBreak',
}

export class CustomDocNodes {
	private static _configuration: TSDocConfiguration | undefined;

	public static get configuration(): TSDocConfiguration {
		if (CustomDocNodes._configuration === undefined) {
			const configuration: TSDocConfiguration = new TSDocConfiguration();

			configuration.docNodeManager.registerDocNodes(
				'@micrososft/api-documenter',
				[
					{
						docNodeKind: CustomDocNodeKind.EmphasisSpan,
						constructor: DocEmphasisSpan,
					},
					{
						docNodeKind: CustomDocNodeKind.Heading,
						constructor: DocHeading,
					},
					{
						docNodeKind: CustomDocNodeKind.NoteBox,
						constructor: DocNoteBox,
					},
					{
						docNodeKind: CustomDocNodeKind.Table,
						constructor: DocTable,
					},
					{
						docNodeKind: CustomDocNodeKind.TableCell,
						constructor: DocTableCell,
					},
					{
						docNodeKind: CustomDocNodeKind.TableRow,
						constructor: DocTableRow,
					},
					{
						docNodeKind: CustomDocNodeKind.ContentBlock,
						constructor: DocContentBlock,
					},
					{
						docNodeKind: CustomDocNodeKind.Maybe,
						constructor: DocMaybe,
					},
					{
						docNodeKind: CustomDocNodeKind.ForceSoftBreak,
						constructor: DocForceSoftBreak,
					},
				]
			);

			configuration.docNodeManager.registerAllowableChildren(
				CustomDocNodeKind.EmphasisSpan,
				[
					DocNodeKind.PlainText,
					DocNodeKind.SoftBreak,
					CustomDocNodeKind.ForceSoftBreak,
				]
			);

			configuration.docNodeManager.registerAllowableChildren(
				DocNodeKind.Section,
				[
					CustomDocNodeKind.Heading,
					CustomDocNodeKind.NoteBox,
					CustomDocNodeKind.Table,
					CustomDocNodeKind.ContentBlock,
					CustomDocNodeKind.Maybe,
					DocNodeKind.Section,
					DocNodeKind.SoftBreak,
					CustomDocNodeKind.ForceSoftBreak,
				]
			);

			configuration.docNodeManager.registerAllowableChildren(
				DocNodeKind.Paragraph,
				[
					CustomDocNodeKind.EmphasisSpan,
					DocNodeKind.SoftBreak,
					CustomDocNodeKind.ForceSoftBreak,
					CustomDocNodeKind.ContentBlock,
					CustomDocNodeKind.Maybe,
				]
			);

			CustomDocNodes._configuration = configuration;
		}
		return CustomDocNodes._configuration;
	}
}
