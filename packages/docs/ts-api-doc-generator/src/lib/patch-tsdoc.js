if (!global.tsDocPatched) {
	global.tsDocPatched = true;

	const {
		DocNode,
		DocNodeKind,
		DocPlainText,
		DocSoftBreak,
		DocParagraph,
		DocNodeTransforms,
		TSDocEmitter,
	} = require('@microsoft/tsdoc');

	/**
	 * Patch tsdoc to preserve newlines in plain text nodes.
	 *
	 * Without this patch, the following markdown gets rendered as a single line:
	 *
	 * * Grocery list:
	 * * - apples
	 * * - oranges
	 * * - bananas
	 *
	 * @param {DocParagraph} docParagraph - a DocParagraph containing nodes to be transformed
	 * @return {DocParagraph} The transformed child nodes.
	 */

	DocNodeTransforms.trimSpacesInParagraph = function (docParagraph) {
		const transformedNodes = [];
		// Whether the next nonempty node to be added needs a space before it
		let pendingSpace = false;
		let pendingSpaceChar = ' ';
		// The DocPlainText node that we're currently accumulating
		const accumulatedTextChunks = [];
		const accumulatedNodes = [];
		// We always trim leading whitespace for a paragraph.  This flag gets set to true
		// as soon as nonempty content is encountered.
		let finishedSkippingLeadingSpaces = false;

		function appendPendingSpace() {
			if (pendingSpace) {
				accumulatedTextChunks.push(pendingSpaceChar);
				pendingSpace = false;
				pendingSpaceChar = ' ';
			}
		}

		function pushAccumulatedText() {
			if (accumulatedTextChunks.length > 0) {
				const lines = accumulatedTextChunks.join('').split('\n');
				for (let i = 0, max = lines.length; i < max; i++) {
					transformedNodes.push(
						new DocPlainText({
							configuration: docParagraph.configuration,
							text: lines[i],
						})
					);
					if (i !== max - 1) {
						// Newlines are represented as "Soft breaks" nodes.
						// Let's push one representing the original newline
						// character.
						//
						// This is a quick&dirty workaround that pretends that:
						// – DocSoftBreak arguments come from a parser (parsed: true)
						// – softBreakExcerpt is an actual TokenSequence when in
						//   reality it's just an ad-hoc object with a toString()
						transformedNodes.push(
							new DocSoftBreak({
								configuration: docParagraph.configuration,
								parsed: true,
								softBreakExcerpt: {
									toString() {
										return '\n';
									},
								},
							})
						);
					}
				}
				accumulatedTextChunks.length = 0;
				accumulatedNodes.length = 0;
			}
		}

		for (let _i = 0, _a = docParagraph.nodes; _i < _a.length; _i++) {
			const node = _a[_i];
			switch (node.kind) {
				case DocNodeKind.PlainText: {
					const docPlainText = node;
					const text = docPlainText.text;
					const startedWithSpace = /^\s/.test(text);
					const endedWithSpace = /\s$/.test(text);
					const collapsedText = text.replace(/\s+/g, ' ').trim();
					if (startedWithSpace && finishedSkippingLeadingSpaces) {
						pendingSpace = true;
					}
					if (collapsedText.length > 0) {
						appendPendingSpace();
						accumulatedTextChunks.push(collapsedText);
						accumulatedNodes.push(node);
						finishedSkippingLeadingSpaces = true;
					}
					if (endedWithSpace && finishedSkippingLeadingSpaces) {
						pendingSpace = true;
					}
					break;
				}
				case DocNodeKind.SoftBreak: {
					if (finishedSkippingLeadingSpaces) {
						pendingSpace = true;
						pendingSpaceChar = node
							.getChildNodes()[0]
							.content.toString();
					}
					accumulatedNodes.push(node);
					break;
				}
				default: {
					appendPendingSpace();
					// Push the accumulated text
					pushAccumulatedText();
					transformedNodes.push(node);
					finishedSkippingLeadingSpaces = true;
				}
			}
		}

		// Push the accumulated text
		pushAccumulatedText();
		const transformedParagraph = new DocParagraph({
			configuration: docParagraph.configuration,
		});
		transformedParagraph.appendNodes(transformedNodes);

		return transformedParagraph;
	};

	const originalRenderNode = TSDocEmitter.prototype._renderNode;

	/**
	 * Preserve newlines plain text nodes.
	 * By default, tsdoc replaces them with spaces.
	 *
	 * @param {DocNode} docNode
	 */
	TSDocEmitter.prototype._renderNode = function (docNode) {
		if (docNode === undefined) {
			return;
		}
		if (docNode.kind === DocNodeKind.SoftBreak) {
			this._writeContent('\n');
			return;
		}
		return originalRenderNode.apply(this, arguments);
	};
}
