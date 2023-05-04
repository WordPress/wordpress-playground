import * as React from '@wordpress/element';
import { useBlockProps } from '@wordpress/block-editor';
import { registerBlockType } from '@wordpress/blocks';
import { installEntities } from '../pages/entities';

import EditInteractiveCodeSnippet from './edit';

import * as metadata from './block.json';
import { InteractiveCodeSnippetBlockAttributes } from '../types';

// Rollup crashes if this import, that is only needed
// in hooks/use-php.ts, isn't repeated here:
// @ts-ignore
import '../php-worker?url&worker';

// Rollup crashes if this import, that is only needed
// in hooks/use-php.ts, isn't repeated here:
// @ts-ignore
import '../block/view?url&worker';

// Make vite copy the block.json file to the build folder:
// @ts-ignore
export * as blockJsonUrl from './block.json?url';

const { name } = metadata;

export { metadata, name };

installEntities();
registerBlockType<InteractiveCodeSnippetBlockAttributes>(metadata as any, {
	icon: 'shield',
	edit: EditInteractiveCodeSnippet,
	save: ({ attributes }) => {
		return <div {...useBlockProps.save()}>{attributes.code}</div>;
	},
});
