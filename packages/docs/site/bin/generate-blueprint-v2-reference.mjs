import { readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';

const scriptDirectory = fileURLToPath(new URL('.', import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '../../../..');
const schemaPath = resolve(
	scriptDirectory,
	'../../../playground/blueprints/public/blueprint-schema.json'
);
const mode = process.argv[2];

if (mode !== '--check' && mode !== '--write') {
	console.error(
		'Usage: node packages/docs/site/bin/generate-blueprint-v2-reference.mjs --check|--write'
	);
	process.exit(1);
}

const blueprintSchema = JSON.parse(await readFile(schemaPath, 'utf8'));
const blueprintV2Schema = resolveReference(
	blueprintSchema,
	blueprintSchema.definitions.BlueprintV2Declaration
);
const prettierConfig =
	(await resolveConfig(
		resolve(scriptDirectory, '../docs/blueprints/v2/reference/01-schema.md')
	)) ?? {};
const targets = [
	{
		path: resolve(
			scriptDirectory,
			'../docs/blueprints/v2/reference/01-schema.md'
		),
		marker: 'BLUEPRINT V2 TOP-LEVEL REFERENCE',
		contents: await formatGeneratedMarkdown(
			generateTopLevelReference(blueprintV2Schema),
			prettierConfig
		),
	},
	{
		path: resolve(
			scriptDirectory,
			'../docs/blueprints/v2/reference/02-additional-steps.md'
		),
		marker: 'BLUEPRINT V2 ADDITIONAL STEPS REFERENCE',
		contents: await formatGeneratedMarkdown(
			generateAdditionalStepsReference(blueprintV2Schema),
			prettierConfig
		),
	},
];
const driftedPaths = [];

for (const target of targets) {
	const currentDocument = await readFile(target.path, 'utf8');
	const generatedDocument = replaceGeneratedSection(
		currentDocument,
		target.marker,
		target.contents
	);

	if (generatedDocument === currentDocument) {
		continue;
	}

	if (mode === '--write') {
		await writeFile(target.path, generatedDocument);
	} else {
		driftedPaths.push(relative(repositoryRoot, target.path));
	}
}

if (driftedPaths.length > 0) {
	console.error(
		`Blueprint v2 reference is out of date:\n${driftedPaths
			.map((path) => `- ${path}`)
			.join(
				'\n'
			)}\nRun this command to update it:\nnode packages/docs/site/bin/generate-blueprint-v2-reference.mjs --write`
	);
	process.exit(1);
}

console.log(
	mode === '--write'
		? 'Generated the Blueprint v2 reference.'
		: 'Blueprint v2 reference is up to date.'
);

function generateTopLevelReference(schema) {
	const requiredProperties = new Set(schema.required ?? []);
	const rows = Object.entries(schema.properties ?? {}).map(
		([propertyName, propertySchema]) =>
			formatTableRow([
				`<a id="blueprint-v2-property-${slugify(
					propertyName
				)}"></a>${formatCode(propertyName)}`,
				requiredProperties.has(propertyName) ? 'Yes' : 'No',
				formatCode(describeShape(propertySchema)),
				formatDefault(propertySchema),
				describeTopLevelProperty(propertyName, propertySchema),
			])
	);

	return [
		'| Property | Required | Type or shape | Schema default | Description |',
		'| --- | --- | --- | --- | --- |',
		...rows,
	].join('\n');
}

function generateAdditionalStepsReference(schema) {
	const variants =
		schema.properties?.additionalStepsAfterExecution?.items?.oneOf ?? [];

	return variants
		.map((variant) => {
			const stepName = String(variant.properties?.step?.const);
			const requiredProperties = new Set(variant.required ?? []);
			const rows = Object.entries(variant.properties ?? {}).map(
				([propertyName, propertySchema]) =>
					formatTableRow([
						formatCode(propertyName),
						requiredProperties.has(propertyName) ? 'Yes' : 'No',
						formatCode(describeShape(propertySchema)),
						formatDefault(propertySchema),
						describeStepField(
							stepName,
							propertyName,
							propertySchema
						),
					])
			);

			return [
				`### \`${stepName}\` {#blueprint-v2-step-${slugify(stepName)}}`,
				'',
				describeStep(variant, stepName),
				'',
				'| Field | Required | Type or shape | Schema default | Description |',
				'| --- | --- | --- | --- | --- |',
				...rows,
			].join('\n');
		})
		.join('\n\n');
}

function replaceGeneratedSection(document, marker, contents) {
	const startMarker = `<!-- BEGIN GENERATED ${marker} -->`;
	const endMarker = `<!-- END GENERATED ${marker} -->`;
	const start = document.indexOf(startMarker);
	const end = document.indexOf(endMarker);

	if (start === -1 || end === -1 || end < start) {
		throw new Error(`Missing or invalid generated markers for ${marker}.`);
	}
	if (
		document.indexOf(startMarker, start + startMarker.length) !== -1 ||
		document.indexOf(endMarker, end + endMarker.length) !== -1
	) {
		throw new Error(`Duplicate generated markers for ${marker}.`);
	}

	return `${document.slice(0, start + startMarker.length)}\n\n${contents}\n\n${document.slice(end)}`;
}

function resolveReference(rootSchema, schema) {
	let resolvedSchema = schema;
	const visitedReferences = new Set();

	while (resolvedSchema?.$ref) {
		const definitionName = resolvedSchema.$ref.replace(
			'#/definitions/',
			''
		);
		if (
			definitionName === resolvedSchema.$ref ||
			!rootSchema.definitions[definitionName] ||
			visitedReferences.has(definitionName)
		) {
			throw new Error(
				'Blueprint v2 declaration is missing from the schema.'
			);
		}
		visitedReferences.add(definitionName);
		resolvedSchema = rootSchema.definitions[definitionName];
	}

	return resolvedSchema;
}

function describeShape(schema, depth = 0) {
	if (typeof schema === 'boolean') {
		return schema ? 'any' : 'never';
	}
	if (schema.$ref) {
		const referenceName = schema.$ref.replace('#/definitions/', '');
		return referenceName.startsWith('alias-')
			? 'JSON value'
			: referenceName.replace('DataSources.', '');
	}
	if (schema.const !== undefined) {
		return JSON.stringify(schema.const);
	}
	if (schema.enum) {
		return schema.enum.map((value) => JSON.stringify(value)).join(' | ');
	}
	if (schema.discriminator && schema.oneOf) {
		return `${schema.discriminator.propertyName}-discriminated object (${schema.oneOf.length} variants)`;
	}

	const alternatives = schema.anyOf ?? schema.oneOf;
	if (alternatives) {
		const discriminatedShape =
			describeDiscriminatedAlternatives(alternatives);
		if (discriminatedShape) {
			return discriminatedShape;
		}
		return [
			...new Set(
				alternatives.map((alternative) =>
					describeShape(alternative, depth + 1)
				)
			),
		].join(' | ');
	}
	if (schema.type === 'array') {
		const itemShape = schema.items
			? describeShape(schema.items, depth)
			: 'value';
		const needsParentheses =
			schema.items?.anyOf ||
			schema.items?.oneOf ||
			(schema.items?.enum?.length ?? 0) > 1;
		return `${needsParentheses ? `(${itemShape})` : itemShape}[]`;
	}
	if (schema.type === 'object') {
		if (!schema.properties || depth > 1) {
			return schema.additionalProperties &&
				typeof schema.additionalProperties === 'object'
				? `Record<string, ${describeShape(
						schema.additionalProperties,
						depth + 1
					)}>`
				: 'object';
		}

		const requiredProperties = new Set(schema.required ?? []);
		const propertyShapes = Object.entries(schema.properties)
			.slice(0, 4)
			.map(
				([propertyName, propertySchema]) =>
					`${propertyName}${
						requiredProperties.has(propertyName) ? '' : '?'
					}: ${describeShape(propertySchema, depth + 1)}`
			);
		if (
			Object.keys(schema.properties).length > propertyShapes.length ||
			schema.additionalProperties
		) {
			propertyShapes.push('…');
		}
		return `{ ${propertyShapes.join('; ')} }`;
	}
	if (Array.isArray(schema.type)) {
		return schema.type.join(' | ');
	}
	return schema.type ?? 'value';
}

function describeDiscriminatedAlternatives(alternatives) {
	for (const propertyName of ['type', 'step']) {
		const values = alternatives.map(
			(alternative) => alternative.properties?.[propertyName]?.const
		);
		if (values.every((value) => value !== undefined)) {
			return `${propertyName}-discriminated object (${
				new Set(values.map((value) => JSON.stringify(value))).size
			} values)`;
		}
	}
	return undefined;
}

function formatDefault(schema) {
	if (!Object.prototype.hasOwnProperty.call(schema, 'default')) {
		return '—';
	}
	const normalizedDefault = normalizeDefault(schema.default, schema);
	return formatCode(
		JSON.stringify(normalizedDefault) ?? String(normalizedDefault)
	);
}

function normalizeDefault(value, schema) {
	if (typeof value !== 'string') {
		return value;
	}

	if (schema.type === 'boolean') {
		const booleanValue = value.replace(/\.$/, '');
		if (booleanValue === 'true' || booleanValue === 'false') {
			return booleanValue === 'true';
		}
	}

	const quotedValue = value.match(/^("(?:\\.|[^"\\])*")\./);
	if (quotedValue) {
		return JSON.parse(quotedValue[1]);
	}

	const singleQuotedValue = value.match(/^'([^']*)'\.$/);
	return singleQuotedValue ? singleQuotedValue[1] : value;
}

function describeTopLevelProperty(propertyName, schema) {
	const fallbacks = {
		version:
			'Selects Blueprint v2. Use the number `2`, not the string `"2"`.',
		$schema: 'Points editors and other tools to the Blueprint JSON Schema.',
		blueprintMeta: 'Metadata describing the Blueprint and its authors.',
		applicationOptions:
			'Playground options for the landing page, login, network access, and optional PHP extensions.',
		contentBaseline:
			'Controls which starter posts, pages, and comments are kept before declared content is added.',
		usersBaseline:
			'Controls whether the starter administrator is kept before declared users are created.',
		siteLanguage:
			'Sets the WordPress locale and downloads available translations.',
		siteOptions: 'WordPress option names mapped to JSON-compatible values.',
		constants:
			'WordPress constant names mapped to string, number, or boolean values.',
		wordpressVersion:
			'Selects WordPress for a new site or sets compatibility bounds for an existing site.',
		phpVersion: 'Selects or constrains the PHP runtime.',
		activeTheme: 'Installs and activates one theme.',
		themes: 'Themes to install without activating them.',
		plugins: 'Plugins to install. Entries activate by default.',
		muPlugins: 'Must-use plugins to install.',
		postTypes: 'Custom post types to register.',
		fonts: 'Fonts or font collections to add to the WordPress Font Library.',
		media: 'Files to add to the WordPress Media Library.',
		content: 'Content imports to apply to the site.',
		users: 'Users to create or update by username.',
		roles: 'Roles to create or update with string-valued capabilities.',
		additionalStepsAfterExecution:
			'Final setup steps to run in order after all top-level site fields.',
	};
	return fallbacks[propertyName] ?? describeSchema(schema);
}

function describeStepField(stepName, propertyName, schema) {
	const schemaDescription = describeSchema(schema);
	if (schemaDescription !== '—') {
		return schemaDescription;
	}

	const stepFields = {
		cp: {
			fromPath: 'Path to copy from inside WordPress.',
			toPath: 'Path to copy to inside WordPress.',
		},
		defineConstants: {
			constants: 'Constant names mapped to their values.',
		},
		importContent: {
			content: 'Content entries to import.',
		},
		importMedia: {
			media: 'Media sources and metadata to import.',
		},
		installPlugin: {
			source: 'Plugin source to install.',
		},
		installTheme: {
			source: 'Theme source to install.',
		},
		mkdir: {
			path: 'Directory path to create inside WordPress.',
		},
		mv: {
			fromPath: 'Path to move from inside WordPress.',
			toPath: 'Path to move to inside WordPress.',
		},
		rm: {
			path: 'File path to remove inside WordPress.',
		},
		rmdir: {
			path: 'Directory path to remove inside WordPress.',
		},
		runSQL: {
			source: 'SQL file to execute.',
		},
		setSiteOptions: {
			options: 'WordPress option names mapped to their new values.',
		},
		'wp-cli': {
			command: 'WP-CLI command, including the leading `wp`.',
			wpCliPath: 'Optional path to the WP-CLI executable.',
		},
		writeFiles: {
			files: 'Target paths mapped to source data.',
		},
	};

	if (propertyName === 'step') {
		return `Selects the \`${stepName}\` step.`;
	}
	return stepFields[stepName]?.[propertyName] ?? '—';
}

function describeStep(variant, stepName) {
	const fallbacks = {
		activatePlugin: 'Activates an installed plugin.',
		activateTheme: 'Activates an installed theme.',
		cp: 'Copies a file within the target WordPress filesystem.',
		defineConstants: 'Defines WordPress constants, at runtime by default.',
		enableMultisite:
			'Converts the WordPress installation to a multisite network.',
		importContent: 'Imports one or more supported content sources.',
		importMedia: 'Imports files into the WordPress Media Library.',
		importThemeStarterContent:
			"Imports the active theme's starter content.",
		installPlugin: 'Installs a plugin and optionally activates it.',
		installTheme: 'Installs a theme and optionally activates it.',
		mkdir: 'Creates a directory in the target WordPress filesystem.',
		mv: 'Moves a path within the target WordPress filesystem.',
		rm: 'Unlinks a file in the target WordPress filesystem.',
		rmdir: 'Removes a directory from the target WordPress filesystem.',
		resetData:
			'Removes selected site content, or all content when no types are given.',
		runPHP: 'Runs a PHP file with optional environment variables.',
		runSQL: 'Runs SQL from a file source.',
		setSiteLanguage: 'Sets the site language and downloads translations.',
		setSiteOptions: 'Updates WordPress site options.',
		unzip: 'Extracts a zip file into the target WordPress filesystem.',
		'wp-cli': 'Runs a WP-CLI command.',
		writeFiles: 'Writes data references to target filesystem paths.',
	};
	if (fallbacks[stepName]) {
		return fallbacks[stepName];
	}

	const schemaDescription =
		variant.description ?? variant.properties?.step?.description;
	return schemaDescription && /[a-z]/i.test(schemaDescription)
		? conciseDescription(schemaDescription)
		: '—';
}

function describeSchema(schema) {
	return schema.description ? conciseDescription(schema.description) : '—';
}

function conciseDescription(description) {
	const firstParagraph = description
		.split('\n\n')
		.find((paragraph) => paragraph.trim().length > 10);
	const normalizedDescription = (firstParagraph ?? description)
		.replaceAll(/\s+/g, ' ')
		.trim();
	if (normalizedDescription.length <= 240) {
		return normalizedDescription;
	}
	const lastSpace = normalizedDescription.lastIndexOf(' ', 239);
	return `${normalizedDescription.slice(0, lastSpace)}…`;
}

function formatTableRow(cells) {
	return `| ${cells.map(escapeTableCell).join(' | ')} |`;
}

function escapeTableCell(value) {
	return String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function formatCode(value) {
	return `\`${value}\``;
}

function slugify(value) {
	return value
		.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

async function formatGeneratedMarkdown(markdown, prettierConfig) {
	return (
		await format(markdown, {
			...prettierConfig,
			parser: 'markdown',
		})
	).trim();
}
