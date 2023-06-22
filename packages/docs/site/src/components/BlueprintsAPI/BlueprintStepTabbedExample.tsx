import React from 'react';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import { BlueprintStepFunctionExample } from './BlueprintStepFunctionExample';
import { BlueprintStepJsonExample } from './BlueprintStepJsonExample';

export function BlueprintStepTabbedExample({ name }) {
	return (
		<Tabs groupId="blueprints">
			<TabItem value="blueprint" label="Blueprint API" default>
				<BlueprintStepJsonExample name={name} />
			</TabItem>
			<TabItem value="function" label="Function API">
				<BlueprintStepFunctionExample name={name} />
			</TabItem>
		</Tabs>
	);
}
