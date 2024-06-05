import type { ReferenceType, ReflectionType, Type } from 'typedoc';
import { getModule, ReflectionKind } from '../../typedoc-model';

const BlueprintsApi = getModule('@wp-playground/blueprints');
export const BlueprintSteps = BlueprintsApi.children
	.filter((entry) => entry.name.match(/Step$/))
	.filter(
		(entry) => !['CompiledStep', 'GenericStep', 'Step'].includes(entry.name)
	)
	.filter((entry) => !entry?.flags?.isPrivate)
	.map((entry) => entry.name)
	.sort();

const parsedSteps = {};
export function getStepAPI(name) {
	if (!(name in parsedSteps)) {
		const stepDetails = getBlueprintStepDetails(name);
		const fnDetails = getBlueprintFunctionDetails(stepDetails);

		const stepExample =
			stepDetails?.examples?.[0]?.inBlueprint ||
			stepDetails.examples?.[0]?.raw;
		const fnExample = fnDetails?.examples?.[0];

		const stepId = stepDetails.props?.find((prop) => prop.name === 'step')
			?.type?.value;

		parsedSteps[name] = {
			stepId,
			stepDetails,
			fnDetails,
			stepExample,
			fnExample,
		};
	}
	return JSON.parse(JSON.stringify(parsedSteps[name]));
}

function getBlueprintFunctionDetails(StepDetails: BlueprintStepDetails) {
	// Parse function
	const FunctionDefinition = BlueprintsApi.children?.find(
		(entry) =>
			entry.kind === ReflectionKind.Function &&
			(entry.signatures?.[0]?.parameters?.[0]?.type as ReferenceType)
				?.name === 'UniversalPHP' &&
			(
				(entry.signatures?.[0]?.parameters?.[1]?.type as ReferenceType)
					?.typeArguments?.[0] as ReferenceType
			)?.name === StepDetails.name
	);
	if (!FunctionDefinition) {
		throw new Error(`Blueprint function ${StepDetails.name} not found`);
		return {};
	}
	const Signature = FunctionDefinition?.signatures?.[0];

	const examples = StepDetails?.examples
		?.filter((entry) => entry.json)
		?.map((entry) => entry.json)
		?.map(({ ...exampleJson }) => {
			const { clone, placeholder } =
				replaceResourcesWithPlaceholders(exampleJson);
			const formatted = JSON.stringify(clone, null, 4)
				.split('\n')
				.map((line) => `    ${line}`)
				.join('\n')
				.replace(`${placeholder}`, 'await fetchMyFile()');
			return `import { ${FunctionDefinition.name} } from '@wp-playground/blueprints';

${FunctionDefinition.name}(
    playground,
${formatted},
    progress
)
`;
		});
	return {
		name: FunctionDefinition.name,
		description: Signature.comment?.summary?.[0]?.text || '',
		parameters: Signature.parameters.map((entry) => ({
			name: entry.name,
			type: entry.type,
			description: entry.comment?.summary?.[0]?.text || '',
		})),
		examples,
	};
}

function replaceResourcesWithPlaceholders(json) {
	const placeholder = 987123874;
	const clone = JSON.parse(JSON.stringify(json));
	for (const key in clone) {
		if (typeof clone[key] === 'object' && 'resource' in clone[key]) {
			clone[key] = placeholder;
		}
	}
	return { clone, placeholder };
}

interface BlueprintStepDetails {
	name: string;
	summary: Array<{ kind: string; text: string }>;
	examples: Array<{
		raw: string;
		json?: Record<string, any> & { step: string };
		inBlueprint?: string;
	}>;
	props: Array<{
		name: string;
		type: any;
		description: string;
	}>;
	needsLogin?: boolean;
	hasRunnableExample: boolean;
}

function getBlueprintStepDetails(name: string): BlueprintStepDetails {
	// Parse step
	const StepDefinitions = BlueprintsApi.children.filter((entry) =>
		entry.name.match(/Step$/)
	);
	const Step = StepDefinitions.find((entry) => entry.name === name);
	const summary = Step?.comment?.summary?.filter((part) => part);

	const children =
		Step?.children ||
		((Step as any as Type)?.type as any as ReflectionType)?.declaration
			?.children;
	const props = children?.map((entry) => ({
		name: entry.name,
		type: entry.type,
		description: entry.comment?.summary?.[0]?.text || '',
	}));

	const hasRunnableExample = !!Step?.comment?.blockTags?.find(
		(tag) => tag.tag === '@hasRunnableExample'
	);

	return {
		name,
		summary,
		examples: parseExamples(Step),
		hasRunnableExample,
		props,
	};
}

function parseExamples(Step) {
	const needsLogin = !!Step?.comment?.blockTags?.find(
		(tag) => tag.tag === '@needsLogin'
	);
	const landingPage = Step?.comment?.blockTags?.find(
		(tag) => tag.tag === '@landingPage'
	)?.content?.[0]?.text;
	const examples = Step?.comment?.blockTags
		?.filter((tag) => tag.tag === '@example')
		.map((tag) => tag.content?.[0]?.text)
		.filter(Boolean)
		.map((example) =>
			example
				.trim()
				.replace(/^```ts/g, '')
				.replace(/```$/g, '')
				.trim()
				.replace(/^<code>/g, '')
				.replace(/<\/code>$/g, '')
				.trim()
		)
		.map((example) => {
			try {
				const parsed = JSON.parse(example);
				return {
					raw: example,
					json: parsed,
					inBlueprint: JSON.stringify(
						{
							landingPage: landingPage || undefined,
							steps: [
								needsLogin ? { step: 'login' } : null,
								parsed,
							].filter(Boolean),
						},
						null,
						4
					),
				};
			} catch (e) {
				console.log(example);
				console.error(e);
				return { raw: example };
			}
		});
	return examples;
}
