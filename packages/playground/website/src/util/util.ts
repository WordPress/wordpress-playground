/**
 * @description: Utility functions to support the website.
 */

/**
 * @description: Set a cookie.
 * @param {string} name - The name of the cookie.
 * @param {string} value - The value of the cookie.
 * @param {number} days - The number of days until the cookie expires.
 * @returns {void}
*/
const setCookie = (name: string ,value: string, days: number): void => {

	// Set the expiration date.
	let expiresDateString = "";
	
	// If the number of days is provided, set the expiration date.
	if (days) {
			const date = new Date();

			// Calculate the expiration date.
			date.setTime(date.getTime() + (days*24*60*60*1000));

			// Set the expiration date.
			expiresDateString = "; expires=" + date.toUTCString();
	}

	// Set the cookie.
	document.cookie = name + "=" + (value || "")  + expiresDateString + "; path=/";
}

/**
 * @description: Get a cookie.
 * @param {string} name - The name of the cookie.
 * @returns {string | null} The value of the cookie if found, null otherwise.
*/
const getCookie = (name: string): string | null => {
	const input = name + "=";
	const allCookies = document.cookie.split(';');
	
	// Loop through all the cookies.
	for(let i=0 ; i<allCookies.length ; i++) {

		// Get the current cookie.
		let c = allCookies[i];

		// Remove leading spaces.
		while (c.charAt(0) === ' ') c = c.substring(1, c.length);
		
		// If the cookie is found, return its value.
		if (c.indexOf(input) === 0) {
			// Return the value of the cookie.
			return c.substring(input.length, c.length);
		}
	};

	// If the cookie is not found, return null.
	return null;
}

export { setCookie, getCookie };
