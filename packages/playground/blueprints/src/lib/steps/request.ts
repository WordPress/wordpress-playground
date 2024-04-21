import { PHPRequest, PHPResponse } from '@php-wasm/universal';
import { StepHandler } from '.';

/**
 * @private
 * @inheritDoc request
 * @needsLogin
 * @hasRunnableExample
 * @example
 *
 * <code>
 * {
 * 		"step": "request",
 * 		"request": {
 * 			"method": "POST",
 * 			"url": "/wp-admin/admin-ajax.php",
 * 			"formData": {
 * 				"action": "my_action",
 * 				"foo": "bar"
 * 			}
 * 		}
 * }
 * </code>
 */
export interface RequestStep {
	step: 'request';
	/**
	 * Request details (See /wordpress-playground/api/universal/interface/PHPRequest)
	 */
	request: PHPRequest;
}

/**
 * Sends a HTTP request to the Playground.
 */
export const request: StepHandler<RequestStep, Promise<PHPResponse>> = async (
	playground,
	{ request }
) => {
	console.warn(
		'Deprecated: The Blueprint step "request" is deprecated and will be removed in a future release.'
	);
	const response = await (playground as any).request(request);
	if (response.httpStatusCode > 399 || response.httpStatusCode < 200) {
		throw new Error(
			`Request failed with status ${response.httpStatusCode}`
		);
	}
	return response;
};
