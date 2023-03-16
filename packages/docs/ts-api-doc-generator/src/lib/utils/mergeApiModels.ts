import type { ApiItem, ApiModel } from '@microsoft/api-extractor-model';
import * as path from 'path';
import * as fs from 'fs';

type ReferencesToPackages = Map<string, string>;

/**
 * Rewrites multiple API models as one per package.
 *
 * @param apiModels Ungrouped raw API models
 * @returns Merged API models
 */
export function mergeApiModelsGroups(apiModels: ApiModel[]) {
	// 1. Map each reference to the package it resides in
	const referencesToPackages = mapReferencesToPackages(apiModels);

	// 2. Group all API models by package
	const apiModelsGroups = groupApiModels(apiModels);

	// 3. Merge all models in each group
	const mergedApiModels: Record<string, ApiModel> = {};
	const seenApiMembers = new Set<string>();
	for (const [packageName, apiModels] of Object.entries(apiModelsGroups)) {
		mergedApiModels[packageName] = mergeApiModels(
			apiModels,
			seenApiMembers,
			referencesToPackages
		);
	}
	return mergedApiModels;
}

export function groupApiModels(
	apiModels: ApiModel[]
): Record<string, ApiModel[]> {
	const groups: Record<string, ApiModel[]> = {};
	for (const model of apiModels) {
		let groupName;
		try {
			groupName = getPackageNameFromModel(model);
		} catch (e) {
			continue;
		}
		if (!groups[groupName]) {
			groups[groupName] = [];
		}
		groups[groupName].push(model);
	}
	return groups;
}

export function mergeApiModels(
	apiModels: ApiModel[],
	seenApiMembers: Set<string>,
	referencesToPackages: ReferencesToPackages
): ApiModel {
	const clonedStructure = JSON.parse(JSON.stringify(apiModels[0]));
	const packageName = getPackageNameFromModel(apiModels[0]);
	const merged = {
		...clonedStructure,
		name: packageName,
		members: [
			// The entrypoint:
			{
				...apiModels[0].members[0],
				canonicalReference: forgeCanonicalReference(
					apiModels[0].members[0],
					referencesToPackages
				),
				name: packageName,
				members: [],
			},
		],
	};

	// Now, merge the API model members to the singular "merged" model,
	// but also remap it to use the correct source package
	for (const model of apiModels) {
		// Merge each member of the entrypoint:
		for (const apiMember of model.members[0].members) {
			const comparableReference = toComparableReference(
				apiMember.canonicalReference.toString()
			);
			if (!seenApiMembers.has(comparableReference)) {
				seenApiMembers.add(comparableReference);
				// Let's merge everything into a single entrypoint for now as
				// api-documenter only supports a single entrypoint per API model.
				merged.members[0].members.push(
					fixAllCanonicalReferences(
						apiMember,
						referencesToPackages,
						packageName
					)
				);
			}
		}
	}
	return merged;
}

export function mapReferencesToPackages(
	apiModels: ApiModel[]
): ReferencesToPackages {
	// First, let's take note of each unique reference alongside the
	// package name it needs to be attributed to.
	const referencePackages = new Map();

	for (const model of apiModels) {
		// Figure out the current package name
		let packageName;
		try {
			packageName = getPackageNameFromModel(model);
		} catch (e) {
			continue;
		}

		const stack: ApiItem[] = [model];
		while (stack.length) {
			const member = stack.pop()!;
			if (member?.members?.length) {
				stack.push(...member.members);
			}
			if (member.kind.toLowerCase() === 'reference') {
				continue;
			}
			if (member.canonicalReference) {
				const comparableReference = toComparableReference(
					member.canonicalReference + ''
				);
				if (!referencePackages.has(comparableReference)) {
					referencePackages.set(comparableReference, packageName);
				}
			}
		}
	}
	return referencePackages;
}

function getPackageNameFromModel(apiModel: ApiModel): string {
	for (const apiMember of apiModel.members[0].members) {
		if ('fileUrlPath' in apiMember && apiMember.fileUrlPath) {
			const typesPath = apiMember.fileUrlPath as string;
			const packageJsonPath = findNearestFile('package.json', typesPath);
			if (!packageJsonPath) {
				return 'unknown';
			}
			const packageJson = JSON.parse(
				fs.readFileSync(packageJsonPath).toString()
			);
			return packageJson.name;
		}
	}
	throw new Error('Could not find package name from API model');
}

function findNearestFile(filename: string, basePath = process.cwd()) {
	let filePath;
	do {
		filePath = path.join(basePath, filename);
		if (fs.existsSync(filePath)) {
			break;
		}
		basePath = path.dirname(basePath);
	} while (true && basePath !== '/');
	return filePath;
}

function fixAllCanonicalReferences(
	obj: unknown,
	referencesToPackages: ReferencesToPackages,
	topLevelPackageName: string
): any {
	if (!obj) {
		return obj;
	} else if (Array.isArray(obj)) {
		return obj.map((subMember) =>
			fixAllCanonicalReferences(
				subMember,
				referencesToPackages,
				topLevelPackageName
			)
		);
	} else if (typeof obj === 'object') {
		const updatedObj: any = {};
		for (const [key, value] of Object.entries(obj)) {
			updatedObj[key] = fixAllCanonicalReferences(
				value,
				referencesToPackages,
				topLevelPackageName
			);
		}

		if (updatedObj.canonicalReference?.includes('!')) {
			updatedObj.canonicalReference = forgeCanonicalReference(
				updatedObj,
				referencesToPackages
			);
		}
		return updatedObj;
	}

	return obj;
}

function forgeCanonicalReference(
	apiItem: ApiItem,
	referencesToPackages: Map<string, string>
): any {
	let updatedReference = apiItem.canonicalReference.toString();
	const comparableInitialRef = toComparableReference(
		apiItem.canonicalReference.toString()
	);
	const parts = updatedReference.split('!');
	if (parts.length > 1 && parts[0]) {
		if (apiItem.kind.toString().toLowerCase() === 'reference') {
			if (referencesToPackages.has(comparableInitialRef)) {
				// Package references must point to `package-name/package-name!identifier` and NOT just `package-name!identifier`
				updatedReference = [
					referencesToPackages.get(comparableInitialRef) +
						'/' +
						referencesToPackages.get(comparableInitialRef),
					// '',
					...parts.slice(1),
				].join('!');
			} else {
				// References to globals can point to just `!identifier`
				updatedReference = ['', ...parts.slice(1)].join('!');
			}
		} else {
			// Declarations must be in `package-name!identifier` format and NOT in the `package-name/package-name!identifier` format
			updatedReference = [
				referencesToPackages.get(comparableInitialRef),
				...parts.slice(1),
			].join('!');
		}
		// Don't use the tilda character – it introduces two possible ways to reference the same thing
		updatedReference = updatedReference.replace(/!~/g, '!');
	}
	return updatedReference;
}

function toComparableReference(reference: string) {
	return reference.replace(/!~/g, '!');
}
