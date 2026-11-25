import React from 'react';
import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import { getStepAPI } from './model';
import { BlueprintStepRunButton } from './BlueprintStepRunButton';
import { BlueprintStepTabbedExample } from './BlueprintStepTabbedExample';
import { BlueprintStepParameters } from './BlueprintStepParameters';
import { BlueprintStepDescription } from './BlueprintStepDescription';

export default function BlueprintStep({ name }) {
	const stepApi = getStepAPI(name);
	return (
		<section className="margin-vert--md markdown">
			<Heading
				as="h2"
				className="anchorWithStickyNavbar_blueprint"
				id={name}
			>
				<Link
					id={stepApi.stepId}
					className="anchorWithStickyNavbar_blueprint"
				/>
				{stepApi.stepId}
			</Heading>
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
