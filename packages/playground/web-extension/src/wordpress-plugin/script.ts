import {
	awaitReply,
	postMessageExpectReply,
	responseTo,
} from '@php-wasm/web-service-worker';

const wp = (window as any).wp;
let format: keyof typeof formatConverters = 'markdown';

// Accept commands from the parent window
window.addEventListener('message', (event) => {
	if (typeof event.data !== 'object') {
		return;
	}

	const { command, value } = event.data;

	if (command === 'setEditorContent') {
		populateEditorWithFormattedText(value);
	} else if (command === 'getEditorContent') {
		const blocks = wp.data.select('core/block-editor').getBlocks();
		window.opener.postMessage(
			responseTo(event.data.requestId, {
				command: 'response',
				value: formatConverters[format].fromBlocks(blocks),
				type: 'relay',
			}),
			'*'
		);
	}
});

function populateEditorWithFormattedText(text: string) {
	if (!(format in formatConverters)) {
		throw new Error('Unsupported format');
	}

	const rawBlocks = formatConverters[format].toBlocks(text);
	if (!rawBlocks.length || !text.trim()) {
		rawBlocks.push([
			{
				name: 'core/paragraph',
				attributes: {
					content: ' - ',
				},
				innerBlocks: [],
			},
			{
				name: 'core/paragraph',
				attributes: {
					content: ' - ',
				},
				innerBlocks: [],
			},
		]);
	}
	wp.data.dispatch('core/block-editor').resetBlocks(createBlocks(rawBlocks));
}

// @TODO: Figure out why this import is needed – blocky formats should hook this
//        file on its own. Do I need WP nightly with modules support?
// @ts-expect-error
await import('./blocky-formats.js');
// // @ts-expect-error
await import('../blocky-formats/vendor/commonmark.min.js');
const { markdownToBlocks, blocks2markdown } = await import(
	// @ts-expect-error
	'../blocky-formats/src/markdown.js'
);
const formatConverters = {
	markdown: {
		toBlocks: markdownToBlocks,
		fromBlocks: blocks2markdown,
	},
};

const requestId = postMessageExpectReply(
	window.opener,
	{
		command: 'getBootParameters',
	},
	'*'
);

awaitReply(self, requestId).then((response) => {
	format = response.format;
	populateEditorWithFormattedText(response.value);
});

const createBlocks = (blocks: any) =>
	blocks.map((block: any) =>
		wp.blocks.createBlock(
			block.name,
			block.attributes,
			createBlocks(block.innerBlocks)
		)
	);

function pushEditorContentsToParent() {
	const blocks = wp.data.select('core/block-editor').getBlocks();
	window.opener.postMessage(
		{
			command: 'playgroundEditorTextChanged',
			format: format,
			text: formatConverters[format].fromBlocks(blocks),
			type: 'relay',
		},
		'*'
	);
}

const { subscribe, select } = wp.data;

// Store the current post visibility
let isSavingPost = false;

subscribe(() => {
	const currentPost = select('core/editor').getCurrentPost();
	const isSaving = select('core/editor').isSavingPost();

	// Detect when the user initiated a save (publish or update)
	if (!isSavingPost && isSaving) {
		const postStatus = currentPost.status;
		const postType = currentPost.type;

		// Check if it is an actual publish or update action
		if (postStatus === 'publish' && postType !== 'auto-draft') {
			onPublish();
		}
	}

	// Update the saving post flag
	isSavingPost = isSaving;
});

function onPublish() {
	pushEditorContentsToParent();
	window.close();
	window.opener.focus();
}

export {};
