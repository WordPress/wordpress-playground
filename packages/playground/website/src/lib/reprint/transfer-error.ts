import { __ } from '@wordpress/i18n';
import { redactReprintPrivateKeys } from './keys';

export type TransferErrorDetails = {
	code?: string;
	stage?: string;
	httpStatus?: number;
	curlError?: number;
};

/** Keep Reprint's diagnosis across the PHP, transfer, and UI boundaries. */
export class ReprintTransferError extends Error {
	readonly details: TransferErrorDetails;

	constructor(message: string, details: TransferErrorDetails = {}) {
		super(redactReprintPrivateKeys(message));
		this.name = 'ReprintTransferError';
		this.details = details;
	}
}

type RecoveryAction =
	| 'settings'
	| 'address'
	| 'install'
	| 'plugins'
	| 'admin'
	| 'wordfence'
	| 'site'
	| 'cli'
	| 'resume'
	| 'open-copy';

type TransferRecovery = {
	title: string;
	message: string;
	action: RecoveryAction;
	label: string;
	/** Present only when another attempt can help, possibly after a stated change. */
	resumeLabel?: string;
};

/** Choose recovery from codes, never from the server's English error text. */
export function getTransferRecovery({
	code,
	stage,
	httpStatus,
	curlError,
}: TransferErrorDetails): TransferRecovery {
	switch (code) {
		case 'AUTH_REQUIRES_KEY':
		case 'AUTH_NOT_CONFIGURED':
		case 'AUTH_UNKNOWN_KEY':
		case 'AUTH_NO_CREDENTIAL':
		case 'EXPORT_NOT_CONFIGURED':
			return {
				title: __('Add your migration key', 'playground-website'),
				message: __(
					'The live site has not accepted this tab’s migration key. Add it in Reprint settings, then come back here. Trying again before that will not help.',
					'playground-website'
				),
				action: 'settings',
				label: __('Open Reprint settings', 'playground-website'),
				resumeLabel: __(
					'I’ve added the key — continue',
					'playground-website'
				),
			};
		case 'REDIRECT':
			return {
				title: __('Check the live site address', 'playground-website'),
				message: __(
					'The site sent Reprint to a different address. Use the final WordPress address shown in your browser. Reprint does not follow redirects.',
					'playground-website'
				),
				action: 'address',
				label: __('Edit site address', 'playground-website'),
			};
		case 'NOT_FOUND':
		case 'HTML_RESPONSE':
		case 'INVALID_PREFLIGHT_RESPONSE':
			return {
				title: __(
					'The site did not return a Reprint response',
					'playground-website'
				),
				message: __(
					'Check the WordPress address and make sure Reprint is active. A sign-in page or a security rule can also hide its response.',
					'playground-website'
				),
				action: 'install',
				label: __('Check Reprint installation', 'playground-website'),
				resumeLabel: __(
					'I’ve checked the site — continue',
					'playground-website'
				),
			};
		case 'AUTH_KEY_UNSUPPORTED':
			return {
				title: __(
					'Update Reprint on the live site',
					'playground-website'
				),
				message: __(
					'The live site may be using an older Reprint plugin that cannot verify migration keys. Update the plugin, then continue with the same key.',
					'playground-website'
				),
				action: 'plugins',
				label: __('Open installed plugins', 'playground-website'),
				resumeLabel: __(
					'I’ve updated Reprint — continue',
					'playground-website'
				),
			};
		case 'AUTH_REQUIRES_TOKEN':
			return {
				title: __(
					'This host needs the Reprint CLI',
					'playground-website'
				),
				message: __(
					'This host cannot verify migration keys. Use Reprint’s command-line tool with a connection token instead. Retrying in this browser will not help.',
					'playground-website'
				),
				action: 'cli',
				label: __('Use the Reprint CLI', 'playground-website'),
			};
		case 'SITE_TOO_LARGE':
			return {
				title: __(
					'This site is too large for a browser import',
					'playground-website'
				),
				message: __(
					'The selected files and database exceed Playground’s 2 GiB limit. Use Reprint’s command-line tool to copy this site to your computer.',
					'playground-website'
				),
				action: 'cli',
				label: __('Use the Reprint CLI', 'playground-website'),
			};
		case 'LOGIN_FAILED':
			return {
				title: __(
					'Site cloned. Sign-in needs attention.',
					'playground-website'
				),
				message: __(
					'Your files and database have been copied. Automatic admin sign-in did not finish. Open the copy to sign in yourself, or try automatic sign-in again. Your site will not be downloaded again.',
					'playground-website'
				),
				action: 'open-copy',
				label: __('Open cloned site', 'playground-website'),
				resumeLabel: __('Try signing in again', 'playground-website'),
			};
		case 'AUTH_CLOCK_SKEW':
			return {
				title: __('Check the clocks', 'playground-website'),
				message: __(
					'The live site rejected the request’s time stamp. Check your computer’s date and time. Ask your host to check the server’s clock too.',
					'playground-website'
				),
				action: 'resume',
				label: __(
					'I’ve checked the clocks — continue',
					'playground-website'
				),
			};
		case 'WORDFENCE_BLOCKED':
			return {
				title: __(
					'Wordfence blocked the connection',
					'playground-website'
				),
				message: __(
					'Wait for the temporary block to expire, or check Wordfence’s firewall rules on the live site. Then resume with this tab open. You do not need a new key.',
					'playground-website'
				),
				action: 'wordfence',
				label: __('Open Wordfence', 'playground-website'),
				resumeLabel: __(
					'Try resuming after the block clears',
					'playground-website'
				),
			};
		case 'AUTH_REQUEST_REWRITTEN':
		case 'AUTH_HEADERS_STRIPPED':
		case 'AUTH_CONTENT_TAMPERED':
			return {
				title: __(
					'The host is changing Reprint’s requests',
					'playground-website'
				),
				message: __(
					'A proxy, firewall, or security plugin is changing the signed request before it reaches WordPress. Ask your host to pass the request path, headers, and body through unchanged. A new migration key will not help.',
					'playground-website'
				),
				action: 'admin',
				label: __('Open WordPress admin', 'playground-website'),
				resumeLabel: __(
					'The host settings changed — continue',
					'playground-website'
				),
			};
		case 'REQUEST_TOO_LARGE':
		case 'UNSUPPORTED_MEDIA_TYPE':
			return {
				title: __(
					'The host rejected Reprint’s request',
					'playground-website'
				),
				message: __(
					'The live server rejected the request’s size or format. Ask your host to allow Reprint’s API requests before continuing. Retrying unchanged will not help.',
					'playground-website'
				),
				action: 'admin',
				label: __('Open WordPress admin', 'playground-website'),
				resumeLabel: __(
					'The host settings changed — continue',
					'playground-website'
				),
			};
		case 'AUTH_FAILED':
			return {
				title: __(
					'The live site refused the connection',
					'playground-website'
				),
				message: __(
					'The response does not confirm a key problem. Check the live site’s security rules, or ask your host why the request was refused. Keep your current migration key.',
					'playground-website'
				),
				action: 'admin',
				label: __('Open WordPress admin', 'playground-website'),
				resumeLabel: __(
					'I’ve checked access — continue',
					'playground-website'
				),
			};
	}
	// A cURL failure is not always temporary: certificate and URL errors also
	// use CURL_ERROR. Offer a plain resume only for interrupted connections.
	if (
		(code === 'CURL_ERROR' &&
			curlError !== undefined &&
			[6, 7, 16, 18, 28, 52, 55, 56, 61, 92, 95].includes(curlError)) ||
		(code === 'SERVER_ERROR' &&
			(httpStatus === undefined ||
				[500, 502, 503, 504].includes(httpStatus))) ||
		((!code || code === 'HTTP_ERROR') &&
			[408, 429, 500, 502, 503, 504].includes(httpStatus ?? 0))
	) {
		return {
			title: __('The connection was interrupted', 'playground-website'),
			message: __(
				'The live site may be busy or the connection may have dropped. Wait a moment, then resume. Keep this tab open so Reprint can reuse its saved download position.',
				'playground-website'
			),
			action: 'resume',
			label: __('Resume cloning', 'playground-website'),
		};
	}
	if (code === 'CURL_ERROR') {
		return {
			title: __(
				'Check the connection to the live site',
				'playground-website'
			),
			message: __(
				'Reprint could not make a secure connection. Check that the live site opens normally. Your host may need to correct its HTTPS settings. Retrying unchanged may fail again.',
				'playground-website'
			),
			action: 'site',
			label: __('Open live site', 'playground-website'),
			resumeLabel: __(
				'I’ve checked the connection — continue',
				'playground-website'
			),
		};
	}
	return {
		title:
			stage === 'files-prepare'
				? __('Local setup paused', 'playground-website')
				: __('Cloning paused', 'playground-website'),
		message:
			stage === 'files-prepare'
				? __(
						'The downloaded files are still here, but Playground could not finish setting them up. Check the details below. You can retry local setup without downloading those files again.',
						'playground-website'
					)
				: __(
						'We could not finish this step. Check the details below before trying again. Keep this tab open to retain the current transfer.',
						'playground-website'
					),
		action: 'resume',
		label:
			stage === 'files-prepare'
				? __('Retry local setup', 'playground-website')
				: __('Try again', 'playground-website'),
	};
}
