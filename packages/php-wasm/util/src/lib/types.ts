// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type PromisedMethod<T extends (...args: any[]) => any> = (
	...args: Parameters<T>
) => Promise<ReturnType<T>>;

export type Promised<T> = {
	[P in keyof T]: T[P] extends (...args: any[]) => any
		? PromisedMethod<T[P]>
		: T[P];
};
