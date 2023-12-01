import { PHPRequest } from '@php-wasm/universal';
import { StepHandler } from '.';

/**
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
export const request: StepHandler<RequestStep> = async (
	playground,
	{ request }
) => {
	return await playground.request(request);
};
