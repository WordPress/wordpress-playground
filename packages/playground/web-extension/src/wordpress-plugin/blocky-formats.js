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
			// removing allowedBlocks for all blocks turns a nice inserter into a
			// less presentable appender
			// Allow nesting any block inside a list item.
			wp.blocks.unregisterBlockType(blockType.name);
			const { allowedBlocks, ...newBlockType } = blockType;
			wp.blocks.registerBlockType(newBlockType.name, { ...newBlockType });
		}
	});
};

setTimeout(go, 1000);
