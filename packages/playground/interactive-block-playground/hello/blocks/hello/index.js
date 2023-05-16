const { registerBlockType } = wp.blocks;
const { useBlockProps } = wp.blockEditor;
const { createElement } = wp.element;

const Edit = () => {
	return createElement(
		'p',
		useBlockProps(),
		'Hello World! (from the editor).'
	);
};

registerBlockType('hello/log-block', {
	edit: Edit,
	save: () => null,
});
