describe('playground-website', () => {
	beforeEach(() => cy.visit('/?networking=no'));

	it('should navigate to WordPress sites when a URL is updated', () => {
		cy.get('input[name=url]').type('/wp-admin');
		cy.get('input[name=url]').type('{enter}');
		cy.get('iframe')
			.should('have.attr', 'src')
			.and('match', /\/wp-admin$/);
	});

	it('should switch PHP versions', () => {
		cy.get('button#configurator').click();
		cy.get('select#php-version').select('7.4');
		cy.get('#modal-content button[type=submit]').click();

		// Page reload

		// Go to phpinfo
		cy.get('input[name=url]').type('/phpinfo.php');
		cy.get('input[name=url]').type('{enter}');
	});
});
