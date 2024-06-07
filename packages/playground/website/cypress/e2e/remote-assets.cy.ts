describe('Remote Assets', () => {
	const testedStorageOptions = ['none', 'browser'];
	testedStorageOptions.forEach((storage) => {
		it(`should load remote assets for storage=${storage}`, () => {
			const expectedRemoteAssetPath =
				'wp-includes/blocks/navigation/style.min.css';
			const blueprint =
				'{"siteOptions":{"blogname":"remote asset test"}}';

			cy.visit(`/?storage=${storage}#${blueprint}`);
			runAssertions();

			if (storage === 'browser') {
				// Reload and re-assert to test when loading from browser storage
				cy.reload();
				runAssertions();
			}

			function runAssertions() {
				// NOTE: This appears to be necessary for Cypress
				// to wait until a WordPress page is actually loaded.
				// Otherwise, the document.styleSheets assertions hang.
				cy.wordPressDocument()
					.its('body')
					.should('contain', 'remote asset test');

				cy.window()
					.then((win: any) => {
						return win.playground
							.readFileAsText(
								'/wordpress/wordpress-remote-asset-paths'
							)
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
			}
		});
	});
});
