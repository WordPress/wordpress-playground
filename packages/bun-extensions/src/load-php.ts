import { plugin } from 'bun';

plugin({
	name: 'PHPTextPlugin',
	setup(build) {
		build.onLoad({ filter: /\?(.*&|)raw(&.*|)$/ }, async (args) => {
			const path = args.path.split('?')[0];
			// Use Bun.file to read the .php file as text
			const text = await Bun.file(path).text();

			// Return the file content as a module exporting the text
			return {
				contents: `export default ${JSON.stringify(text)};`,
				loader: 'js', // Treat the content as JavaScript
			};
		});
	},
});
