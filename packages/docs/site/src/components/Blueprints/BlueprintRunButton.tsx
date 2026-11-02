import React from 'react';

export function BlueprintRunButton({ blueprint, blueprintUrl }) {
	const [isRunning, setIsRunning] = React.useState(false);
	if (!blueprint && !blueprintUrl) {
		return null;
	}
	if (!isRunning) {
		return (
			<button
				className="button button--primary"
				onClick={() => {
					setIsRunning(true);
				}}
			>
				Try it out!
			</button>
		);
	}
	const url = blueprintUrl
		? `https://playground.wordpress.net/?mode=seamless&blueprint-url=${encodeURIComponent(
				blueprintUrl
			)}`
		: `https://playground.wordpress.net/?mode=seamless#${btoa(
				typeof blueprint === 'string'
					? blueprint
					: JSON.stringify(blueprint)
			)}`;
	return (
		<iframe
			style={{
				width: '100%',
				height: '500px',
				border: '1px solid #ccc',
			}}
			src={url}
		/>
	);
}
