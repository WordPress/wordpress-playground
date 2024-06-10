var __require = ((x) =>
	typeof require !== 'undefined'
		? require
		: typeof Proxy !== 'undefined'
		? new Proxy(x, {
				get: (a, b) =>
					(typeof require !== 'undefined' ? require : a)[b],
		  })
		: x)(function (x) {
	if (typeof require !== 'undefined') return require.apply(this, arguments);
	throw Error('Dynamic require of "' + x + '" is not supported');
});

// ../../php-wasm/web-service-worker/src/messaging.ts
function postMessageExpectReply(target, message, ...postMessageArgs) {
	const requestId = getNextRequestId();
	target.postMessage(
		{
			...message,
			requestId,
		},
		...postMessageArgs
	);
	return requestId;
}
function getNextRequestId() {
	return ++lastRequestId;
}
function awaitReply(
	messageTarget,
	requestId,
	timeout = DEFAULT_RESPONSE_TIMEOUT
) {
	return new Promise((resolve, reject) => {
		const responseHandler = (event) => {
			if (
				event.data.type === 'response' &&
				event.data.requestId === requestId
			) {
				messageTarget.removeEventListener('message', responseHandler);
				clearTimeout(failOntimeout);
				resolve(event.data.response);
			}
		};
		const failOntimeout = setTimeout(() => {
			reject(new Error('Request timed out'));
			messageTarget.removeEventListener('message', responseHandler);
		}, timeout);
		messageTarget.addEventListener('message', responseHandler);
	});
}
function responseTo(requestId, response) {
	return {
		type: 'response',
		requestId,
		response,
	};
}
var DEFAULT_RESPONSE_TIMEOUT = 25000;
var lastRequestId = 0;
// src/wordpress-plugin/script.ts
async function populateEditorWithFormattedText(text) {
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
var onDraftSave = function (callback) {
	let wasSavingPost = false;
	wp.data.subscribe(function () {
		const postType = wp.data.select('core/editor').getCurrentPostType();
		if (!postType) {
			return;
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
		wasSavingPost = isSavingPost;
	});
};
var pushChangesAndCloseEditor = function () {
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
};
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
var wp = window.wp;
var format = 'markdown';
wp.plugins.registerPlugin('finish-editing', {
	render: () =>
		wp.editPost.PluginSidebar({
			name: 'finish-editing',
			title: 'Finish editing',
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
window.onbeforeunload = null;
window.addEventListener('beforeunload', (event) => {
	event.stopImmediatePropagation();
	pushChangesAndCloseEditor();
});
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
await import('../blocky-formats/src/blocky-formats.js');
await import('../blocky-formats/vendor/commonmark.min.js');
var { markdownToBlocks, blocks2markdown } = await import(
	'../blocky-formats/src/markdown.js'
);
var formatConverters = {
	markdown: {
		toBlocks: markdownToBlocks,
		fromBlocks: blocks2markdown,
	},
};
var createBlocks = (blocks) =>
	blocks.map((block) =>
		wp.blocks.createBlock(
			block.name,
			block.attributes,
			block.innerBlocks ? createBlocks(block.innerBlocks) : []
		)
	);
onDraftSave(pushChangesAndCloseEditor);
boot();
