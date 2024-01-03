import { StepHandler } from '.';

export type HelloWorldStep = {
	step: 'helloWorld';
	message: string;
};

/**
 * Prints a message to the console.
 * @param playground Playground client.
 * @param message The message to print.
 */
export const helloWorld: StepHandler<HelloWorldStep> = async (
	playground,
	{ message }
) => {
	await playground.helloWorld(message);
};
