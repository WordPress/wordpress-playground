import React from 'react';
import { useRef, useState } from 'react';
import { PlaygroundClient, importWordPressFiles } from '@wp-playground/client';
import { Button, Flex, TextControl } from '@wordpress/components';

interface PreviewPRFormProps {
	playground: PlaygroundClient;
	onImported: () => void;
	onClose: () => void;
}

export default function PreviewPRForm({
	playground,
	onImported,
	onClose,
}: PreviewPRFormProps) {
	const form = useRef<any>();

	const [error, setError] = useState<string>('');

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		onImported();
	}

	// TODO:
	// - fill input
	// - get PR
	// - open playground with PR
	// - error handling
	// - detect `pr=` from queryString

	return (
		<form id="import-playground-form" ref={form} onSubmit={handleSubmit}>
			<div>
				<TextControl
					label="Pull request number or URL"
					value={''}
					onChange={() => {}}
				/>
				{error ? <div>{error}</div> : null}
			</div>
			<Flex
				justify={'end'}
			>
					<Button
						variant="link"
					>
						Cancel
					</Button>
					<Button
						variant="primary"
					>
						Preview
					</Button>
			</Flex>
		</form>
	);
}
