import {
	createClient,
	overwritePath,
	filesListToObject,
	getFilesFromDirectory,
	filesSubObject,
	changeset,
	iterateFiles,
} from '@wp-playground/storage';
import { login, startPlaygroundWeb } from '@wp-playground/client';

const client = await startPlaygroundWeb({
	iframe: document.getElementById('wp')!,
	remoteUrl: `https://playground.wordpress.net/remote.html`,
});
await client.isReady();

const TOKEN_KEY = 'githubToken';
const token = localStorage.getItem(TOKEN_KEY);
const octokit = createClient(token!);

await login(client, { username: 'admin', password: 'password' });

const themes = await getThemesFilesFromPR('Automattic', 'themes', 7434);
for (const [theme, files] of Object.entries(themes)) {
	console.log(files);
	await overwritePath(client, `/wordpress/wp-content/themes/${theme}`, files);
}

await client.goTo('/wp-admin/themes.php');

await client.writeFile(
	`/wordpress/wp-content/themes/hevor/new-file.md`,
	'test'
);
await client.writeFile(
	`/wordpress/wp-content/themes/hevor/style.css`,
	'overriding'
);
await client.unlink(`/wordpress/wp-content/themes/hevor/readme.txt`);

const changes = await changeset(
	new Map(Object.entries(themes['hevor'])),
	iterateFiles(client, '/wordpress/wp-content/themes/hevor')
);
console.log(changes);

async function getThemesFilesFromPR(
	owner: string,
	repo: string,
	pull_number: number
) {
	const updatedFiles = await octokit.rest.pulls.listFiles({
		owner,
		repo,
		pull_number,
	});
	const updatedThemes = Array.from(
		new Set(
			updatedFiles.data.map((file: any) => file.filename.split('/')[0])
		)
	);
	const { data: pullRequest } = await octokit.rest.pulls.get({
		owner,
		repo,
		pull_number,
	});
	const allThemes: Record<string, Record<string, Uint8Array>> = {};
	for (const theme of updatedThemes) {
		const files = await getFilesFromDirectory(
			octokit,
			owner,
			repo,
			pullRequest.head.ref,
			theme
		);
		allThemes[theme] = filesSubObject(filesListToObject(files), theme);
	}
	return allThemes;
}
