const API_URL = 'https://playground.wordpress.net/puzzle.php';
const API_KEY: string | undefined = process.env.REACT_APP_API_KEY;

const apiRequest = async (
	action: string,
	data?: {
		[key: string]: any;
	}
) => {
	if (!API_KEY) {
		throw new Error('API key not found');
	}
	const formdata = new FormData();
	formdata.append('action', action);
	formdata.append('api_key', API_KEY);
	if (data) {
		Object.keys(data).forEach((key) => {
			formdata.append(key, data[key]);
		});
	}
	return fetch(API_URL, {
		method: 'POST',
		body: formdata,
	})
		.then((response) => response.json())
		.then((result) => {
			if (result.error) {
				throw new Error(result.error);
			}
			if (result.status === 'error') {
				return Promise.reject(result.message);
			}
			return result.message;
		});
};

export const post = async () => {
	return apiRequest('post');
};

export const siteName = async () => {
	return apiRequest('site-name');
};

export const readImageContent = async (image: string) => {
	return apiRequest('read-image', { image });
};
