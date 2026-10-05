import { readdir, readFile } from 'node:fs/promises';
import { basename, relative, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import validateBlueprintV2 from '../../../playground/blueprints/public/blueprint-v2-schema-validator.js';

const scriptDirectory = fileURLToPath(new URL('.', import.meta.url));
const examplesDirectory = resolve(
	scriptDirectory,
	'../src/examples/blueprints-v2'
);
const blueprintsDocsDirectory = resolve(scriptDirectory, '../docs/blueprints');
const v2DocsDirectory = resolve(blueprintsDocsDirectory, 'v2');
const blueprintSchemaUrl =
	'https://playground.wordpress.net/blueprint-schema.json';
const exampleFiles = (await readdir(examplesDirectory))
	.filter((filename) => filename.endsWith('.json'))
	.sort();
const fixturesByName = new Map();

let failed = false;
let validatedBlueprints = 0;

for (const filename of exampleFiles) {
	const path = resolve(examplesDirectory, filename);
	let blueprint;

	try {
		blueprint = JSON.parse(await readFile(path, 'utf8'));
	} catch (error) {
		failed = true;
		console.error(`${basename(path)} is not valid JSON: ${error.message}`);
		continue;
	}

	fixturesByName.set(filename.slice(0, -'.json'.length), blueprint);
	validateBlueprint(blueprint, basename(path));
}

const markdownFiles = [
	resolve(blueprintsDocsDirectory, 'intro.md'),
	...(await findMarkdownFiles(v2DocsDirectory)),
];
for (const path of markdownFiles) {
	const markdown = await readFile(path, 'utf8');
	const jsonBlocks = markdown.matchAll(
		/```json(?<metadata>[ \t][^\n]*)?\n(?<body>[\s\S]*?)```/g
	);
	let blockNumber = 0;

	for (const match of jsonBlocks) {
		blockNumber++;
		let value;
		const label = `${relative(
			blueprintsDocsDirectory,
			path
		)} JSON block ${blockNumber}`;

		try {
			value = JSON.parse(match.groups.body);
		} catch (error) {
			failed = true;
			console.error(`${label} is not valid JSON: ${error.message}`);
			continue;
		}

		const metadata = match.groups.metadata ?? '';
		const isMarkedV2Example = metadata.includes('blueprint-v2');
		const fixtureName = metadata.match(
			/(?:^|\s)fixture=([A-Za-z0-9_-]+)(?=\s|$)/
		)?.[1];
		if (fixtureName) {
			const fixture = fixturesByName.get(fixtureName);
			if (!fixture) {
				failed = true;
				console.error(
					`${label} references an unknown fixture: ${fixtureName}.`
				);
			} else if (!isDeepStrictEqual(value, fixture)) {
				failed = true;
				console.error(
					`${label} must match the ${fixtureName}.json fixture.`
				);
			}
		}
		const declaresBlueprintVersion =
			value?.$schema === blueprintSchemaUrl &&
			Object.prototype.hasOwnProperty.call(value, 'version');
		if (isMarkedV2Example || declaresBlueprintVersion) {
			validateBlueprint(value, label);
		}
	}
}

if (failed) {
	process.exitCode = 1;
} else {
	console.log(`Validated ${validatedBlueprints} Blueprint v2 example(s).`);
}

function validateBlueprint(blueprint, label) {
	if (blueprint.$schema !== blueprintSchemaUrl) {
		failed = true;
		console.error(
			`${label} must include the public Blueprint $schema URL.`
		);
		return;
	}

	if (!validateBlueprintV2(blueprint)) {
		failed = true;
		console.error(
			`${label} is not a valid Blueprint v2 declaration:\n${JSON.stringify(
				validateBlueprintV2.errors,
				null,
				2
			)}`
		);
		return;
	}

	validatedBlueprints++;
}

async function findMarkdownFiles(directory) {
	const paths = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const path = resolve(directory, entry.name);
		if (entry.isDirectory()) {
			paths.push(...(await findMarkdownFiles(path)));
		} else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
			paths.push(path);
		}
	}
	return paths.sort();
}
