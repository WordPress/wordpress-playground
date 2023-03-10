export default (api, options) => {
	return {
		name: 'add-import-extension',
		visitor: {
			ImportDeclaration: (path) => {
				const newImportPathString = updateImportPath(path);
				if (newImportPathString) {
					path.replaceWith(
						api.types.importDeclaration(
							path.node.specifiers,
							api.types.stringLiteral(newImportPathString)
						)
					);
					path.skip();
				}
			},
			ExportNamedDeclaration: (path) => {
				const newImportPathString = updateImportPath(path);
				if (newImportPathString) {
					path.replaceWith(
						api.types.exportNamedDeclaration(
							path.node.declaration,
							path.node.specifiers,
							api.types.stringLiteral(newImportPathString)
						)
					);
					path.skip();
				}
			},
			ExportAllDeclaration: (path) => {
				const newImportPathString = updateImportPath(path);
				if (newImportPathString) {
					path.replaceWith(
						api.types.exportAllDeclaration(
							api.types.stringLiteral(newImportPathString)
						)
					);
					path.skip();
				}
			},
		},
	};
};

function updateImportPath({ node: { source, exportKind, importKind } }) {
	const isTypeOnly = exportKind === 'type' || importKind === 'type';

	if (!source || isTypeOnly) {
		return;
	}

	const module = source && source.value;
	if (!module.startsWith('.')) {
		return;
	}
	const segments = module.split('/');
	const lastSegment = segments[segments.length - 1] || 'index.js';
	const pieces = lastSegment.split('.');
	const nameWithoutExtension =
		pieces.length > 1
			? pieces.slice(0, pieces.length - 1).join('.')
			: pieces[0];
	const extension = pieces.length > 1 ? pieces[pieces.length - 1] : null;
	const newExtension = !extension ? 'js' : extension;

	return segments
		.slice(0, -1)
		.concat(`${nameWithoutExtension}.${newExtension}`)
		.join('/');
}
