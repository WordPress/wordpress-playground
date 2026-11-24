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
				title: 'Add your migration key',
				message:
					'The live site has not accepted this tab’s migration key. Add it in Reprint settings, then come back here. Trying again before that will not help.',
				action: 'settings',
				label: 'Open Reprint settings',
				resumeLabel: 'I’ve added the key — continue',
			};
		case 'REDIRECT':
			return {
				title: 'Check the live site address',
				message:
					'The site sent Reprint to a different address. Use the final WordPress address shown in your browser. Reprint does not follow redirects.',
				action: 'address',
				label: 'Edit site address',
			};
		case 'NOT_FOUND':
		case 'HTML_RESPONSE':
		case 'INVALID_PREFLIGHT_RESPONSE':
			return {
				title: 'The site did not return a Reprint response',
				message:
					'Check the WordPress address and make sure Reprint is active. A sign-in page or a security rule can also hide its response.',
				action: 'install',
				label: 'Check Reprint installation',
				resumeLabel: 'I’ve checked the site — continue',
			};
		case 'AUTH_KEY_UNSUPPORTED':
			return {
				title: 'Update Reprint on the live site',
				message:
					'The live site may be using an older Reprint plugin that cannot verify migration keys. Update the plugin, then continue with the same key.',
				action: 'plugins',
				label: 'Open installed plugins',
				resumeLabel: 'I’ve updated Reprint — continue',
			};
		case 'AUTH_REQUIRES_TOKEN':
			return {
				title: 'This host needs the Reprint CLI',
				message:
					'This host cannot verify migration keys. Use Reprint’s command-line tool with a connection token instead. Retrying in this browser will not help.',
				action: 'cli',
				label: 'Use the Reprint CLI',
			};
		case 'SITE_TOO_LARGE':
			return {
				title: 'This site is too large for a browser import',
				message:
					'The selected files and database exceed Playground’s 2 GiB limit. Use Reprint’s command-line tool to copy this site to your computer.',
				action: 'cli',
				label: 'Use the Reprint CLI',
			};
		case 'LOGIN_FAILED':
			return {
				title: 'Site cloned. Sign-in needs attention.',
				message:
					'Your files and database have been copied. Automatic admin sign-in did not finish. Open the copy to sign in yourself, or try automatic sign-in again. Your site will not be downloaded again.',
				action: 'open-copy',
				label: 'Open cloned site',
				resumeLabel: 'Try signing in again',
			};
		case 'AUTH_CLOCK_SKEW':
			return {
				title: 'Check the clocks',
				message:
					'The live site rejected the request’s time stamp. Check your computer’s date and time. Ask your host to check the server’s clock too.',
				action: 'resume',
				label: 'I’ve checked the clocks — continue',
			};
		case 'WORDFENCE_BLOCKED':
			return {
				title: 'Wordfence blocked the connection',
				message:
					'Wait for the temporary block to expire, or check Wordfence’s firewall rules on the live site. Then resume with this tab open. You do not need a new key.',
				action: 'wordfence',
				label: 'Open Wordfence',
				resumeLabel: 'Try resuming after the block clears',
			};
		case 'AUTH_REQUEST_REWRITTEN':
		case 'AUTH_HEADERS_STRIPPED':
		case 'AUTH_CONTENT_TAMPERED':
			return {
				title: 'The host is changing Reprint’s requests',
				message:
					'A proxy, firewall, or security plugin is changing the signed request before it reaches WordPress. Ask your host to pass the request path, headers, and body through unchanged. A new migration key will not help.',
				action: 'admin',
				label: 'Open WordPress admin',
				resumeLabel: 'The host settings changed — continue',
			};
		case 'REQUEST_TOO_LARGE':
		case 'UNSUPPORTED_MEDIA_TYPE':
			return {
				title: 'The host rejected Reprint’s request',
				message:
					'The live server rejected the request’s size or format. Ask your host to allow Reprint’s API requests before continuing. Retrying unchanged will not help.',
				action: 'admin',
				label: 'Open WordPress admin',
				resumeLabel: 'The host settings changed — continue',
			};
		case 'AUTH_FAILED':
			return {
				title: 'The live site refused the connection',
				message:
					'The response does not confirm a key problem. Check the live site’s security rules, or ask your host why the request was refused. Keep your current migration key.',
				action: 'admin',
				label: 'Open WordPress admin',
				resumeLabel: 'I’ve checked access — continue',
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
			title: 'The connection was interrupted',
			message:
				'The live site may be busy or the connection may have dropped. Wait a moment, then resume. Keep this tab open so Reprint can reuse its saved download position.',
			action: 'resume',
			label: 'Resume cloning',
		};
	}
	if (code === 'CURL_ERROR') {
		return {
			title: 'Check the connection to the live site',
			message:
				'Reprint could not make a secure connection. Check that the live site opens normally. Your host may need to correct its HTTPS settings. Retrying unchanged may fail again.',
			action: 'site',
			label: 'Open live site',
			resumeLabel: 'I’ve checked the connection — continue',
		};
	}
	return {
		title:
			stage === 'files-prepare' ? 'Local setup paused' : 'Cloning paused',
		message:
			stage === 'files-prepare'
				? 'The downloaded files are still here, but Playground could not finish setting them up. Check the details below. You can retry local setup without downloading those files again.'
				: 'We could not finish this step. Check the details below before trying again. Keep this tab open to retain the current transfer.',
		action: 'resume',
		label: stage === 'files-prepare' ? 'Retry local setup' : 'Try again',
	};
}
