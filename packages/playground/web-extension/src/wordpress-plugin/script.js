var __esm = (fn, res) => () => (fn && (res = fn((fn = 0))), res);
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

// src/wordpress-plugin/blocky-formats.js
var exports_blocky_formats = {};
var supportedBlocks, go;
var init_blocky_formats = __esm(() => {
	supportedBlocks = [
		'core/quote',
		'core/code',
		'core/heading',
		'core/html',
		'core/image',
		'core/list',
		'core/list-item',
		'core/missing',
		'core/paragraph',
		'core/table',
		'core/separator',
	];
	go = () => {
		wp.blocks.getBlockTypes().forEach((blockType) => {
			console.log('blockType.name', blockType.name);
			if (!supportedBlocks.includes(blockType.name)) {
				wp.blocks.unregisterBlockType(blockType.name);
			} else if (blockType.name === 'core/list-item') {
				wp.blocks.unregisterBlockType(blockType.name);
				const { allowedBlocks, ...newBlockType } = blockType;
				wp.blocks.registerBlockType(newBlockType.name, {
					...newBlockType,
				});
			}
		});
	};
	setTimeout(go, 1000);
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
var populateEditorWithFormattedText = function (text) {
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
	wp2.data.dispatch('core/block-editor').resetBlocks(createBlocks(rawBlocks));
};
var wp2 = window.wp;
var format = 'markdown';
window.addEventListener('message', (event) => {
	if (typeof event.data !== 'object') {
		return;
	}
	const { command, text } = event.data;
	if (command === 'setEditorContent') {
		populateEditorWithFormattedText(text);
	} else if (command === 'getEditorContent') {
		const blocks = wp2.data.select('core/block-editor').getBlocks();
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
await Promise.resolve().then(
	() => (init_blocky_formats(), exports_blocky_formats)
);
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
var requestId = postMessageExpectReply(
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
var createBlocks = (blocks) =>
	blocks.map((block) =>
		wp2.blocks.createBlock(
			block.name,
			block.attributes,
			createBlocks(block.innerBlocks)
		)
	);
