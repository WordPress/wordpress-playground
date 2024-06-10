/**
 * Converter of all things.
 *
 * @todo Preserve language for code blocks.
 */

// https://core.trac.wordpress.org/search?q=&noquickjump=1&ticket=on
// https://core.trac.wordpress.org/search?q=57381&noquickjump=1&changeset=on

const supportedBlocks = [
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

const go = () => {
	wp.blocks.getBlockTypes().forEach((blockType) => {
		if (!supportedBlocks.includes(blockType.name)) {
			wp.blocks.unregisterBlockType(blockType.name);
		} else if (blockType.name === 'core/list-item') {
			// Remove restrictions on list item child blocks.
			wp.blocks.unregisterBlockType(blockType.name);
			const { allowedBlocks, ...newBlockType } = blockType;
			wp.blocks.registerBlockType(newBlockType.name, { ...newBlockType });
		}
	});

	const TracExportSidebar = () =>
		wp.editPost.PluginSidebar({
			name: 'blocky-formats-sidebar',
			title: 'Export Post',
			icon: 'edit',
			children: React.createElement(
				'ul',
				{},
				[
					React.createElement(
						wp.components.Button,
						{
							label: 'Import from Markdown',
							variant: 'primary',
							onClick: () => {
								navigator.clipboard
									.readText()
									.then((markdown) =>
										window.loadFromMarkdown(markdown)
									);
							},
						},
						'Import from Markdown'
					),
					React.createElement(
						wp.components.Button,
						{
							label: 'Export to Markdown',
							variant: 'primary',
							onClick: async () => {
								const markdown = await window.saveToMarkdown();

								navigator.clipboard.writeText(markdown);
							},
						},
						'Export to Markdown'
					),
					React.createElement(
						wp.components.Button,
						{
							label: 'Export to Trac',
							variant: 'primary',
							onClick: async () => {
								const trac = await window.saveToTrac();

								navigator.clipboard.writeText(trac);
							},
						},
						'Export to Trac'
					),
				].map((e, i) => React.createElement('li', { key: i }, e))
			),
		});

	wp.plugins.registerPlugin('blocky-formats-sidebar', {
		render: TracExportSidebar,
	});
};

window.saveToTrac = async () => {
	const { blocks2trac } = await import('./trac.js');
	const blocks = wp.data.select('core/block-editor').getBlocks();
	const trac = blocks2trac(blocks);
	console.log(trac);
	return trac;
};

window.saveToMarkdown = async () => {
	await import('../vendor/commonmark.min.js');
	const { blocks2markdown } = await import('./markdown.js');
	const blocks = wp.data.select('core/block-editor').getBlocks();
	const markdown = blocks2markdown(blocks);
	console.log(markdown);
	return markdown;
};

window.loadFromMarkdown = async (input) => {
	const { markdownToBlocks } = await import('./markdown.js');

	const createBlocks = (blocks) =>
		blocks.map((block) =>
			wp.blocks.createBlock(
				block.name,
				block.attributes,
				createBlocks(block.innerBlocks)
			)
		);
	const blocks = markdownToBlocks(input);

	wp.data.dispatch('core/block-editor').resetBlocks(createBlocks(blocks));
};

setTimeout(go, 1000);
