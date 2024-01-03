import { StepHandler } from '.';

export type HelloWorldStep = {
	step: 'helloWorld';
	message: string;
};

export const helloWorld: StepHandler<HelloWorldStep> = async (
	playground,
	{ message }
) => {
	await playground.helloWorld(message);
};
