import React from 'react';
import { getStepAPI } from './model';
import { BlueprintStepRunButton } from './BlueprintStepRunButton';
import { BlueprintStepTabbedExample } from './BlueprintStepTabbedExample';
import { BlueprintStepParameters } from './BlueprintStepParameters';
import { BlueprintStepDescription } from './BlueprintStepDescription';

export default function BlueprintStep({ name }) {
	const stepApi = getStepAPI(name);
	return (
		<section className="margin-vert--md markdown">
			<h2 className="anchor anchorWithStickyNavbar_blueprint" id={name}>
				{stepApi.fnDetails.name}
				<a
					href={`#${name}`}
					className="hash-link"
					ariaLabel={`Direct link to ${name}`}
					title={`Direct link to ${name}`}
				>
					​
				</a>
			</h2>
			<BlueprintStepDescription name={name} />

			<h3>Parameters</h3>
			<BlueprintStepParameters name={name} />

			{stepApi.stepExample || stepApi.fnExample ? (
				<>
					<h3>Example</h3>
					<BlueprintStepTabbedExample name={name} />
					{stepApi.stepDetails.hasRunnableExample ? (
						<BlueprintStepRunButton name={name} />
					) : null}
				</>
			) : null}
		</section>
	);
}
