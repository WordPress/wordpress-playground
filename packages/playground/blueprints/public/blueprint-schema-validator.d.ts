type ValidationError = {
	keyword: string;
	instancePath: string;
	schemaPath: string;
	message?: string;
	params: Record<string, unknown>;
};
type ValidateFunction = ((data: unknown) => boolean) & {
	errors?: ValidationError[] | null;
};
declare const validate: ValidateFunction;
export { validate };
export default validate;
