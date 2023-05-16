export function slugify(text: string): string {
	return text
		.toLowerCase()
		.trim() // trim leading and trailing spaces
		.replace(/\s+/g, '-') // replace spaces with -
		.replace(/[^\w-]+/g, '') // remove all non-word chars
		.replace(/--+/g, '-'); // replace multiple - with single -
}
