type ValidationError = {
	instancePath?: string;
	message?: string;
	params?: Record<string, unknown>;
};
type ValidateFunction = ((data: unknown) => boolean) & {
	errors?: ValidationError[] | null;
};
declare const validatePHPExtensionManifest: ValidateFunction;
export default validatePHPExtensionManifest;
