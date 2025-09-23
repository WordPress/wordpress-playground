import React from 'react';

export function BlueprintRunButton({ blueprint }) {
	const [href, setHref] = React.useState<string | null>(null);
	const [isLoading, setIsLoading] = React.useState(true);

	React.useEffect(() => {
		if (!blueprint) {
			setIsLoading(false);
			return;
		}

		// Simulate async computation of the href
		const computeHref = async () => {
			try {
				// Compute the URL asynchronously
				const blueprintString =
					typeof blueprint === 'string'
						? blueprint
						: JSON.stringify(blueprint);
				const encodedBlueprint = btoa(blueprintString);
				const url = `https://playground.wordpress.net/?mode=seamless#${encodedBlueprint}`;

				setHref(url);
			} catch (error) {
				console.error('Error computing blueprint URL:', error);
			} finally {
				setIsLoading(false);
			}
		};

		computeHref();
	}, [blueprint]);

	if (!blueprint) {
		return null;
	}

	if (isLoading || !href) {
		return (
			<button className="button button--primary" disabled>
				View Blueprint (loading)
			</button>
		);
	}

	return (
		<a
			href={href}
			className="button button--primary"
			target="_blank"
			rel="noopener noreferrer"
		>
			View Blueprint
		</a>
	);
}
