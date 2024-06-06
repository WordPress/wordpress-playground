describe('Remote Assets', () => {
	it('should load remote assets', () => {
		const expectedRemoteAssetPath =
			'wp-includes/blocks/navigation/style.min.css';

		cy.visit(
			'/?storage=browser#{"siteOptions":{"blogname":"remote asset test"}}'
		);
		// NOTE: This appears to be necessary for Cypress to wait until a WordPress page
		// is actually loaded. Otherwise, the document.styleSheets assertions hang.
		cy.wordPressDocument()
			.its('body')
			.should('contain', 'remote asset test');
		cy.window()
			.then((win: any) => {
				return win.playground
					.readFileAsText('/wordpress/wordpress-remote-asset-paths')
					.then((remoteAssetPaths: string) => {
						return cy.wrap(remoteAssetPaths.split('\n'));
					});
			})
			.should('include', expectedRemoteAssetPath);
		cy.wordPressDocument()
			.its('styleSheets')
			.then((styleSheets: StyleSheetList) =>
				cy.wrap(
					Array.from(styleSheets).find((sheet) =>
						sheet.href?.includes(expectedRemoteAssetPath)
					)
				)
			)
			.should('exist');
	});
});
