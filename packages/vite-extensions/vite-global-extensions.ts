import fs from 'node:fs';

const vitePlugins = [
	{
		name: 'base64-loader',
		transform(_: any, id: string) {
			// Vite ids already contain native paths; URL parsing would encode spaces as %20.
			const [path, query = ''] = id.split('?', 2);
			if (!new URLSearchParams(query).has('base64')) return null;

			const data = fs.readFileSync(path);
			const base64 = data.toString('base64');

			return `export default Uint8Array.from(atob('${base64}'), c => c.charCodeAt(0));`;
		},
	},
];

export default vitePlugins;
