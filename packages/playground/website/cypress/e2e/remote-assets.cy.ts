// We can't import the WordPress versions directly from the remote package because
// of ESModules vs CommonJS incompatibilities. Let's just import the JSON file
// directly.
// @ts-ignore
// eslint-disable-next-line @nx/enforce-module-boundaries
import * as SupportedWordPressVersions from '../../../wordpress-builds/src/wordpress/wp-versions.json';

const wordPressVersions = Object.keys(SupportedWordPressVersions);
const testedStorageOptions = ['none', 'browser'];

describe('Remote Assets', () => {
	wordPressVersions.forEach((wpVersion) => {
		testedStorageOptions.forEach((storage) => {
			it(`should load remote assets for WordPress-${wpVersion} and storage=${storage}`, () => {
				const expectedRemoteAssetPath =
					'wp-includes/blocks/navigation/style.min.css';
				const blueprint =
					'{"siteOptions":{"blogname":"remote asset test"}}';

				cy.visit(`/?wp=${wpVersion}&storage=${storage}#${blueprint}`);
				runAssertions();

				if (storage === 'browser') {
					cy.reload();
					runAssertions();
				}

				function runAssertions() {
					// NOTE: This appears to be necessary for Cypress to wait until a WordPress page
					// is actually loaded. Otherwise, the document.styleSheets assertions hang.
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
									return cy.wrap(
										remoteAssetPaths.split('\n')
									);
								});
						})
						.should('include', expectedRemoteAssetPath);

					cy.wordPressDocument()
						.its('styleSheets')
						.then((styleSheets: StyleSheetList) =>
							cy.wrap(
								Array.from(styleSheets).find((sheet) =>
									sheet.href?.includes(
										expectedRemoteAssetPath
									)
								)
							)
						)
						.should('exist');
				}
			});
		});
	});
});
