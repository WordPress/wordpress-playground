import {
	awaitReply,
	postMessageExpectReply,
	responseTo,
} from '@php-wasm/web-service-worker';

const wp = (window as any).wp;
let format: keyof typeof formatConverters = 'markdown';

wp.plugins.registerPlugin('finish-editing', {
	render: () =>
		wp.editPost.PluginSidebar({
			name: 'finish-editing',
			title: 'Finish editing',
			// A hack to get something looking like a primary button
			// into the edit post header.
			icon: () =>
				wp.element.createElement(
					'span',
					{
						className: 'components-button is-compact is-primary',
						variant: 'primary',
						onClick: () => {
							window.close();
						},
					},
					'Finish editing'
				),
			children: wp.element.createElement(() => {
				pushChangesAndCloseEditor();
				window.close();
			}),
		}),
});

// Prevent the "Are you sure you want to leave this page?" dialog.
// This is a low-stakes situation, the changes are synchronized with
// the editor in the parent window, let's just close the window.
window.onbeforeunload = null;
window.addEventListener('beforeunload', (event) => {
	event.stopImmediatePropagation();
	pushChangesAndCloseEditor();
});

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

async function populateEditorWithFormattedText(text: string) {
	if (!(format in formatConverters)) {
		throw new Error('Unsupported format');
	}

	const rawBlocks = text.trim()
		? formatConverters[format].toBlocks(text)
		: [];
	if (!rawBlocks.length) {
		rawBlocks.push({
			name: 'core/paragraph',
			attributes: {
				content: '',
			},
			innerBlocks: [],
		});
	}
	await wp.data
		.dispatch('core/block-editor')
		.resetBlocks(createBlocks(rawBlocks));
}

// @TODO: Figure out why this import is needed – blocky formats should hook this
//        file on its own. Do we need WP nightly with modules support?
// @ts-expect-error
await import('../blocky-formats/src/blocky-formats.js');
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

const createBlocks = (blocks: any) =>
	blocks.map((block: any) =>
		wp.blocks.createBlock(
			block.name,
			block.attributes,
			block.innerBlocks ? createBlocks(block.innerBlocks) : []
		)
	);

function onDraftSave(callback: any) {
	let wasSavingPost = false;
	wp.data.subscribe(function () {
		const postType = wp.data.select('core/editor').getCurrentPostType();
		if (!postType) {
			return; // Exit early if no post type (prevents running on non-post editor screens).
		}

		const isSavingPost = wp.data.select('core/editor').isSavingPost();
		const isAutosavingPost = wp.data
			.select('core/editor')
			.isAutosavingPost();
		const currentPost = wp.data.select('core/editor').getCurrentPost();
		const saveStatus = currentPost.status;

		if (
			wasSavingPost &&
			!isSavingPost &&
			!isAutosavingPost &&
			saveStatus === 'draft' &&
			currentPost.id !== 0
		) {
			callback();
		}

		// Update the wasSavingPost variable to the current state for the next call.
		wasSavingPost = isSavingPost;
	});
}

onDraftSave(pushChangesAndCloseEditor);

function pushChangesAndCloseEditor() {
	const blocks = wp.data.select('core/block-editor').getBlocks();
	window.opener.postMessage(
		{
			command: 'updateBeforeClose',
			text: formatConverters[format].fromBlocks(blocks),
			type: 'relay',
		},
		'*'
	);
	window.close();
}

async function boot() {
	const requestId = postMessageExpectReply(
		window.opener,
		{
			command: 'getBootParameters',
		},
		'*'
	);
	const response = await awaitReply(self, requestId);
	format = response.format;

	await populateEditorWithFormattedText(response.value);
	const firstBlockClientId = wp.data
		.select('core/block-editor')
		.getBlocks()[0]?.clientId;
	if (firstBlockClientId) {
		wp.data.dispatch('core/block-editor').selectBlock(firstBlockClientId);
	}
}

boot();

// Make this script an ES module
export {};
