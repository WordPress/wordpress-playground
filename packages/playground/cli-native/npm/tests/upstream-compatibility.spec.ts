import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import ts from 'typescript';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const repositoryRoot = resolve(packageRoot, '../../..');
const universalPHPPath = join(
	repositoryRoot,
	'packages/php-wasm/universal/src/lib/universal-php.ts'
);
const upstreamIndexPath = join(packageRoot, '..', 'cli', 'src', 'index.ts');
const upstreamRunCLIPath = join(packageRoot, '..', 'cli', 'src', 'run-cli.ts');
const nativeApiPath = join(packageRoot, 'npm', 'src', 'api.ts');

interface InventoryEntry {
	name: string;
	status: 'supported' | 'native-only' | 'unsupported-by-design';
	kind?: 'value' | 'type';
	commands?: string[];
	allowFalse?: boolean;
}

describe('upstream-derived compatibility inventory', () => {
	it('keeps the native worker assignable to UniversalPHP', () => {
		const { checker, nativeApiSource, universalPHPSource } =
			createUpstreamProgram();
		expect(
			checker.isTypeAssignableTo(
				exportedType(
					checker,
					nativeApiSource,
					'NativePlaygroundWorker'
				),
				exportedType(checker, universalPHPSource, 'UniversalPHP')
			)
		).toBe(true);
	});

	it('classifies root exports, programmatic options, and nested API members', async () => {
		const inventory = await readInventory();
		const { checker, indexSource, runCLISource } = createUpstreamProgram();

		const upstreamExports = new Map(
			moduleExports(checker, indexSource).map((symbol) => {
				const target = resolveAlias(checker, symbol);
				return [
					symbol.getName(),
					(target.flags & ts.SymbolFlags.Value) !== 0
						? 'value'
						: 'type',
				] as const;
			})
		);
		const exportInventory = entryMap(inventory.exports);
		for (const [name, kind] of upstreamExports) {
			const entry = exportInventory.get(name);
			expect(
				entry,
				`upstream root export ${name} must be classified`
			).toBeDefined();
			expect(entry?.status, `${name} is not native-only`).not.toBe(
				'native-only'
			);
			expect(entry?.kind, `${name} export kind`).toBe(kind);
		}
		for (const entry of inventory.exports)
			if (!upstreamExports.has(entry.name))
				expect(
					entry.status,
					`${entry.name} is a native-only root addition`
				).toBe('native-only');

		const upstreamOptions = new Set(
			exportedType(checker, runCLISource, 'RunCLIArgs')
				.getProperties()
				.map((symbol) => symbol.getName())
		);
		const optionInventory = entryMap(inventory.options);
		for (const name of upstreamOptions)
			expect(
				optionInventory.has(name),
				`upstream RunCLIArgs.${name} must be classified`
			).toBe(true);
		for (const entry of inventory.options)
			if (!upstreamOptions.has(entry.name))
				expect(
					entry.status,
					`${entry.name} is a native-only option`
				).toBe('native-only');
		const supportedCommands = new Set(
			inventory.commands
				.filter(({ status }) => status === 'supported')
				.map(({ name }) => name)
		);
		const derivedOptions = deriveCLIOptions(runCLISource).options;
		const allowFalseOptions = new Set<string>();
		for (const [cliName, metadata] of derivedOptions) {
			for (const programmaticName of [
				cliName,
				camelCaseOptionName(cliName),
			]) {
				if (!upstreamOptions.has(programmaticName)) continue;
				const entry = optionInventory.get(programmaticName);
				assertCommands(
					entry,
					metadata.commands,
					supportedCommands,
					`RunCLIArgs.${programmaticName}`
				);
				if (entry?.allowFalse === true) {
					allowFalseOptions.add(programmaticName);
					expect(entry.status).toBe('unsupported-by-design');
					expect(
						metadata.boolean,
						`RunCLIArgs.${programmaticName} must be an upstream boolean option`
					).toBe(true);
				}
			}
		}
		expect([...allowFalseOptions].sort()).toEqual(
			inventory.options
				.filter(({ allowFalse }) => allowFalse === true)
				.map(({ name }) => name)
				.sort()
		);

		const upstreamServerMembers = flattenServerMembers(
			checker,
			exportedType(checker, runCLISource, 'RunCLIServer')
		);
		expect([...entryMap(inventory.serverMembers).keys()].sort()).toEqual(
			[...upstreamServerMembers].sort()
		);

		const upstreamWorkerMembers = publicPropertyNames(
			exportedType(checker, runCLISource, 'PlaygroundCliWorker')
		);
		expect([...entryMap(inventory.workerMembers).keys()].sort()).toEqual(
			[...upstreamWorkerMembers].sort()
		);
	});

	it('derives command applicability and every yargs boolean-negation alias', async () => {
		const inventory = await readInventory();
		const source = ts.createSourceFile(
			upstreamRunCLIPath,
			await readFile(upstreamRunCLIPath, 'utf8'),
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TS
		);
		const upstream = deriveCLIOptions(source);
		const supportedCommands = new Set(
			inventory.commands
				.filter(({ status }) => status === 'supported')
				.map(({ name }) => name)
		);
		expect(
			[...upstream.commands].sort(),
			'upstream yargs commands must all be classified'
		).toEqual(inventory.commands.map(({ name }) => name).sort());

		const cliInventory = entryMap(inventory.cliOptions);
		const derivedSpellings = new Set<string>();
		for (const [name, metadata] of upstream.options) {
			const spelling = `--${name}`;
			derivedSpellings.add(spelling);
			assertCommands(
				cliInventory.get(spelling),
				metadata.commands,
				supportedCommands,
				spelling
			);
			if (name.includes('-')) {
				const camelCase = `--${camelCaseOptionName(name)}`;
				derivedSpellings.add(camelCase);
				assertCommands(
					cliInventory.get(camelCase),
					metadata.commands,
					supportedCommands,
					camelCase
				);
			}
			if (!metadata.boolean) continue;
			const negated = `--no-${name}`;
			derivedSpellings.add(negated);
			assertCommands(
				cliInventory.get(negated),
				metadata.commands,
				supportedCommands,
				negated
			);
		}
		for (const entry of inventory.cliOptions)
			expect(
				derivedSpellings.has(entry.name),
				`CLI spelling ${entry.name} must come from upstream yargs`
			).toBe(true);
	});
});

async function readInventory(): Promise<{
	commands: InventoryEntry[];
	options: InventoryEntry[];
	cliOptions: InventoryEntry[];
	exports: InventoryEntry[];
	serverMembers: InventoryEntry[];
	workerMembers: InventoryEntry[];
}> {
	return JSON.parse(
		await readFile(join(packageRoot, 'compatibility.json'), 'utf8')
	) as Awaited<ReturnType<typeof readInventory>>;
}

function createUpstreamProgram(): {
	checker: ts.TypeChecker;
	indexSource: ts.SourceFile;
	runCLISource: ts.SourceFile;
	nativeApiSource: ts.SourceFile;
	universalPHPSource: ts.SourceFile;
} {
	const configPath = join(repositoryRoot, 'tsconfig.base.json');
	const config = ts.readConfigFile(configPath, ts.sys.readFile);
	if (config.error)
		throw new Error(
			ts.flattenDiagnosticMessageText(config.error.messageText, '\n')
		);
	const parsed = ts.parseJsonConfigFileContent(
		config.config,
		ts.sys,
		repositoryRoot
	);
	const program = ts.createProgram(
		[
			upstreamIndexPath,
			upstreamRunCLIPath,
			nativeApiPath,
			universalPHPPath,
		],
		{
			...parsed.options,
			noEmit: true,
			skipLibCheck: true,
		}
	);
	const indexSource = program.getSourceFile(upstreamIndexPath);
	const runCLISource = program.getSourceFile(upstreamRunCLIPath);
	const nativeApiSource = program.getSourceFile(nativeApiPath);
	const universalPHPSource = program.getSourceFile(universalPHPPath);
	if (
		!indexSource ||
		!runCLISource ||
		!nativeApiSource ||
		!universalPHPSource
	)
		throw new Error('Could not load upstream CLI sources.');
	return {
		checker: program.getTypeChecker(),
		indexSource,
		runCLISource,
		nativeApiSource,
		universalPHPSource,
	};
}

function moduleExports(
	checker: ts.TypeChecker,
	source: ts.SourceFile
): ts.Symbol[] {
	const module = checker.getSymbolAtLocation(source);
	if (!module) throw new Error(`Could not resolve module ${source.fileName}`);
	return checker.getExportsOfModule(module);
}

function resolveAlias(checker: ts.TypeChecker, symbol: ts.Symbol): ts.Symbol {
	return (symbol.flags & ts.SymbolFlags.Alias) !== 0
		? checker.getAliasedSymbol(symbol)
		: symbol;
}

function exportedType(
	checker: ts.TypeChecker,
	source: ts.SourceFile,
	name: string
): ts.Type {
	const symbol = moduleExports(checker, source).find(
		(entry) => entry.getName() === name
	);
	if (!symbol) throw new Error(`Missing upstream export ${name}`);
	return checker.getDeclaredTypeOfSymbol(resolveAlias(checker, symbol));
}

function propertyName(symbol: ts.Symbol): string | undefined {
	for (const declaration of symbol.declarations ?? []) {
		if (!('name' in declaration) || !declaration.name) continue;
		const name = declaration.name as ts.PropertyName;
		if (ts.isPrivateIdentifier(name)) return undefined;
		if (ts.isComputedPropertyName(name)) {
			const text = name.expression.getText().replaceAll(' ', '');
			if (text.includes('Symbol.asyncDispose'))
				return 'Symbol.asyncDispose';
			if (text.includes('internalsKeyForTesting'))
				return 'internalsKeyForTesting';
		}
		if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
	}
	const name = symbol.getName();
	return name.startsWith('__@') ? undefined : name;
}

function publicPropertyNames(type: ts.Type): Set<string> {
	const names = new Set<string>();
	for (const property of type.getProperties()) {
		if (
			(property.declarations ?? []).some((declaration) => {
				const flags = ts.getCombinedModifierFlags(declaration);
				return Boolean(
					flags &
					(ts.ModifierFlags.Private | ts.ModifierFlags.Protected)
				);
			})
		)
			continue;
		const name = propertyName(property);
		if (name) names.add(name);
	}
	return names;
}

function flattenServerMembers(
	checker: ts.TypeChecker,
	type: ts.Type
): Set<string> {
	const names = new Set<string>();
	for (const property of type.getProperties()) {
		const name = propertyName(property);
		if (!name) continue;
		if (name !== 'internalsKeyForTesting') {
			names.add(name);
			continue;
		}
		const location =
			property.valueDeclaration ?? property.declarations?.[0];
		if (!location)
			throw new Error('Missing internalsKeyForTesting declaration');
		const nested = checker.getTypeOfSymbolAtLocation(property, location);
		for (const child of publicPropertyNames(nested))
			names.add(`${name}.${child}`);
	}
	return names;
}

function entryMap(entries: InventoryEntry[]): Map<string, InventoryEntry> {
	return new Map(entries.map((entry) => [entry.name, entry]));
}

interface DerivedOption {
	commands: Set<string>;
	boolean: boolean;
}

function deriveCLIOptions(source: ts.SourceFile): {
	commands: Set<string>;
	options: Map<string, DerivedOption>;
} {
	const collections = new Map<string, ts.ObjectLiteralExpression>();
	const visitDeclarations = (node: ts.Node) => {
		if (
			ts.isVariableDeclaration(node) &&
			ts.isIdentifier(node.name) &&
			node.initializer &&
			ts.isObjectLiteralExpression(node.initializer)
		)
			collections.set(node.name.text, node.initializer);
		ts.forEachChild(node, visitDeclarations);
	};
	visitDeclarations(source);

	const commands = new Set<string>();
	const options = new Map<string, DerivedOption>();
	const visitCommands = (node: ts.Node) => {
		const commandArgument = ts.isCallExpression(node)
			? node.arguments[0]
			: undefined;
		if (
			ts.isCallExpression(node) &&
			ts.isPropertyAccessExpression(node.expression) &&
			node.expression.name.text === 'command' &&
			commandArgument &&
			ts.isStringLiteral(commandArgument)
		) {
			const command = commandArgument.text;
			commands.add(command);
			const builder = node.arguments[2];
			if (builder)
				collectBuilderOptions(
					builder,
					source,
					collections,
					(name, boolean) => {
						const metadata = options.get(name) ?? {
							commands: new Set<string>(),
							boolean: false,
						};
						metadata.commands.add(command);
						metadata.boolean ||= boolean;
						options.set(name, metadata);
					}
				);
		}
		ts.forEachChild(node, visitCommands);
	};
	visitCommands(source);
	return { commands, options };
}

function collectBuilderOptions(
	builder: ts.Node,
	source: ts.SourceFile,
	collections: Map<string, ts.ObjectLiteralExpression>,
	add: (name: string, boolean: boolean) => void
): void {
	const visit = (node: ts.Node) => {
		if (
			ts.isCallExpression(node) &&
			ts.isPropertyAccessExpression(node.expression) &&
			node.expression.name.text === 'options' &&
			node.arguments[0]
		)
			for (const option of optionsFromExpression(
				node.arguments[0],
				source,
				collections
			))
				add(option.name, option.boolean);
		ts.forEachChild(node, visit);
	};
	visit(builder);
}

function optionsFromExpression(
	expression: ts.Expression,
	source: ts.SourceFile,
	collections: Map<string, ts.ObjectLiteralExpression>
): Array<{ name: string; boolean: boolean }> {
	if (ts.isIdentifier(expression)) {
		const collection = collections.get(expression.text);
		return collection
			? optionsFromObject(collection, source, collections)
			: [];
	}
	return ts.isObjectLiteralExpression(expression)
		? optionsFromObject(expression, source, collections)
		: [];
}

function optionsFromObject(
	object: ts.ObjectLiteralExpression,
	source: ts.SourceFile,
	collections: Map<string, ts.ObjectLiteralExpression>
): Array<{ name: string; boolean: boolean }> {
	const output: Array<{ name: string; boolean: boolean }> = [];
	for (const property of object.properties) {
		if (ts.isSpreadAssignment(property)) {
			output.push(
				...optionsFromExpression(
					property.expression,
					source,
					collections
				)
			);
			continue;
		}
		if (!ts.isPropertyAssignment(property)) continue;
		const name = literalPropertyName(property.name, source);
		if (!name) continue;
		output.push({
			name,
			boolean: optionIsBoolean(property.initializer, source, collections),
		});
	}
	return output;
}

function optionIsBoolean(
	initializer: ts.Expression,
	source: ts.SourceFile,
	collections: Map<string, ts.ObjectLiteralExpression>
): boolean {
	if (ts.isObjectLiteralExpression(initializer)) {
		const type = initializer.properties.find(
			(property): property is ts.PropertyAssignment =>
				ts.isPropertyAssignment(property) &&
				literalPropertyName(property.name, source) === 'type'
		);
		return Boolean(
			type &&
			ts.isStringLiteral(type.initializer) &&
			type.initializer.text === 'boolean'
		);
	}
	if (
		ts.isElementAccessExpression(initializer) &&
		ts.isIdentifier(initializer.expression) &&
		initializer.argumentExpression &&
		ts.isStringLiteral(initializer.argumentExpression)
	) {
		const collection = collections.get(initializer.expression.text);
		if (!collection) return false;
		const referencedName = initializer.argumentExpression.text;
		return (
			optionsFromObject(collection, source, collections).find(
				({ name }) => name === referencedName
			)?.boolean ?? false
		);
	}
	return false;
}

function literalPropertyName(
	name: ts.PropertyName,
	source: ts.SourceFile
): string | undefined {
	if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
	return ts.isComputedPropertyName(name)
		? name.expression.getText(source)
		: undefined;
}

function camelCaseOptionName(name: string): string {
	return name.replaceAll(/-([a-z])/g, (_, letter: string) =>
		letter.toUpperCase()
	);
}

function assertCommands(
	entry: InventoryEntry | undefined,
	upstreamCommands: Set<string>,
	supportedCommands: Set<string>,
	spelling: string
): void {
	expect(entry, `${spelling} must be classified`).toBeDefined();
	expect(
		[...(entry?.commands ?? [])].sort(),
		`${spelling} command applicability`
	).toEqual(
		[...upstreamCommands]
			.filter((command) => supportedCommands.has(command))
			.sort()
	);
}
