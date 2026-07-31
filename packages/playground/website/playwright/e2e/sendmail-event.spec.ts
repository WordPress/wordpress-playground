import { test, expect } from '../playground-fixtures.ts';

test('forwards sendmail streams from HTTP requests through the web client', async ({
	website,
}) => {
	await website.goto('./?storage=temp');
	await website.page.waitForFunction(() =>
		Boolean((window as any).playground)
	);

	const result = await website.page.evaluate(async () => {
		const playground = (window as any).playground;
		let eventCount = 0;
		let resolveMessage!: (message: string) => void;
		const message = new Promise<string>((resolve) => {
			resolveMessage = resolve;
		});
		const subscriptionId = await playground.subscribeToPHPEvent(
			'sendmail.spawned',
			async (event: { stdin: ReadableStream<Uint8Array> }) => {
				eventCount++;
				resolveMessage(await new Response(event.stdin).text());
			}
		);

		await playground.writeFile(
			'/wordpress/sendmail-event.php',
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
		const response = await playground.request({
			url: '/sendmail-event.php',
		});
		const rawMessage = await message;
		await playground.unsubscribeFromPHPEvent(subscriptionId);

		let resolveSecondMessage!: () => void;
		const secondMessage = new Promise<void>((resolve) => {
			resolveSecondMessage = resolve;
		});
		const secondSubscriptionId = await playground.subscribeToPHPEvent(
			'sendmail.spawned',
			async (event: { stdin: ReadableStream<Uint8Array> }) => {
				await new Response(event.stdin).arrayBuffer();
				resolveSecondMessage();
			}
		);
		const secondResponse = await playground.request({
			url: '/sendmail-event.php',
		});
		await secondMessage;
		await playground.unsubscribeFromPHPEvent(secondSubscriptionId);
		await new Promise((resolve) => setTimeout(resolve, 50));

		return {
			eventCount,
			rawMessage,
			responseText: response.text,
			secondResponseText: secondResponse.text,
		};
	});

	expect(result.responseText).toBe('SENT');
	expect(result.secondResponseText).toBe('SENT');
	expect(result.eventCount).toBe(1);
	expect(result.rawMessage).toContain('Subject: Captured email subject');
	expect(result.rawMessage).toContain('Captured email body.');
});
