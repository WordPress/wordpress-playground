import React from 'react';
import PathMappingControl from './PathMappingControl';

const fileStructure = [
	{
		name: '/',
		type: 'folder' as const,
		children: [
			{
				name: 'Documents',
				type: 'folder' as const,
				children: [
					{ name: 'Resume.pdf', type: 'file' as const },
					{ name: 'CoverLetter.docx', type: 'file' as const },
				],
			},
			{
				name: 'Pictures',
				type: 'folder' as const,
				children: [
					{
						name: 'Vacation',
						type: 'folder' as const,
						children: [
							{ name: 'beach.png', type: 'file' as const },
						],
					},
				],
			},
			{ name: 'todo.txt', type: 'file' as const },
		],
	},
];
export default function PathMappingControlDemo() {
	const [mapping, setMapping] = React.useState({});
	return (
		<div>
			<style>
				{`.path-mapping-control td:last-child {
					width: 500px;
				}`}
			</style>
			<PathMappingControl
				files={fileStructure}
				initialState={{ '/': { isOpen: true } }}
				onMappingChange={(newMapping) => setMapping(newMapping)}
			/>
			<h3>Mapping:</h3>
			<pre>{JSON.stringify(mapping, null, 2)}</pre>
		</div>
	);
}
