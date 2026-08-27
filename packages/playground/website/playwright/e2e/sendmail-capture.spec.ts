import { test, expect } from '../playground-fixtures';

test('shows email captured from PHP mail()', async ({ website }) => {
	await website.goto('./?storage=temp');

	const responseText = await website.page.evaluate(async () => {
		const sitesApi = (window as any).playgroundSites;
		await sitesApi.isReady();
		const client = sitesApi.getClient();
		await client.writeFile(
			'/wordpress/sendmail-capture.php',
			`<?php
			$result = mail(
				'recipient@test.com',
				'Captured email subject',
				'Captured email body.',
				'From: sender@test.com'
			);
			echo $result ? 'SENT' : 'FAILED';
			`
		);
		const response = await client.request({
			url: '/sendmail-capture.php',
		});
		return response.text;
	});

	expect(responseText).toBe('SENT');
	await website.openDockPane('Email', 'Email pane');
	const emailPane = website.page.getByRole('dialog', {
		name: 'Email pane',
	});
	await expect(
		emailPane.getByText('Captured email subject').first()
	).toBeVisible();
	await expect(emailPane).toContainText('Captured email body.');
});
