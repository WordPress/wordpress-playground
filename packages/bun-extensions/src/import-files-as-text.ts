import { plugin, BunPlugin } from 'bun';

/**
 * Adds support for `import contents from "file.php?raw"`.
 *
 * It matches Vite's behavior, which is to read the file as text
 * and return its textual content. This allows us to run Bun and
 * Vite on the same codebase.
 */
export const ImportFilesAsTextPlugin: BunPlugin = {
	name: 'ImportFilesAsTextPlugin',
	setup(build) {
		build.onLoad(
			{
				// Looks for paths with a `raw` query parameter.
				filter: /[?&]raw(?:[&=]|$)/,
			},
			async (args) => {
				const path = args.path.split('?')[0];
				// Use Bun.file to read the .php file as text
				const text = await Bun.file(path).text();

				// Return the file content as a module exporting the text
				return {
					contents: `export default ${JSON.stringify(text)};`,
					loader: 'js', // Treat the content as JavaScript
				};
			}
		);
	},
};

plugin(ImportFilesAsTextPlugin);
