import { DEFAULT_CODE } from './constants';

export type PlaygroundUrlState = {
	code?: string;
	php?: string;
	wp?: string;
};

const encodeBase64UTF8 = (str: string) =>
	btoa(
		encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
			String.fromCharCode(Number(`0x${p1}`))
		)
	);

const decodeBase64UTF8 = (base64: string) => {
	try {
		return decodeURIComponent(
			atob(base64)
				.split('')
				.map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
				.join('')
		);
	} catch {
		return null;
	}
};

export const loadStateFromURL = () => {
	const fragment = window.location.hash.slice(1);
	if (!fragment) {
		return {
			code: DEFAULT_CODE,
			phpVersion: undefined,
			wpVersion: undefined,
		};
	}
	const decoded = decodeBase64UTF8(fragment);
	if (decoded === null) {
		return {
			code: DEFAULT_CODE,
			phpVersion: undefined,
			wpVersion: undefined,
		};
	}
	try {
		const state = JSON.parse(decoded) as PlaygroundUrlState;
		return {
			code: state.code ?? DEFAULT_CODE,
			phpVersion: state.php,
			wpVersion: state.wp,
		};
	} catch {
		return {
			code: decoded || DEFAULT_CODE,
			phpVersion: undefined,
			wpVersion: undefined,
		};
	}
};

export const saveStateToURL = (state: PlaygroundUrlState) => {
	const json = JSON.stringify(state);
	const encoded = encodeBase64UTF8(json);
	window.history.replaceState(
		null,
		'',
		`${window.location.pathname}${window.location.search}#${encoded}`
	);
};
