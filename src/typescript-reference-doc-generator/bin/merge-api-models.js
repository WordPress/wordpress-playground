const fs = require('fs');

// Iterate over the JSON files in the directory passed via the first argument
const extractedApis = process.argv
	.slice(2)
	.map((file) => JSON.parse(fs.readFileSync(file, 'utf8')));

const seen = new Set();

const firstEntryCloned = JSON.parse(JSON.stringify(extractedApis[0]));
const result = {
	...firstEntryCloned,
	members: [],
};

for (const api of extractedApis) {
	if (!seen.has(api.members[0].canonicalReference)) {
		api.members[0].name = api.members[0].canonicalReference.split('!')[0];
		result.members.push({
			...api.members[0],
			members: [],
		});
		seen.add(api.members[0].canonicalReference);
	}

	for (const apiMember of api.members[0].members) {
		if (!seen.has(apiMember.canonicalReference)) {
			// api-documenter only supports a single entrypoint per file
			result.members[0].members.push(
				fixCrossPackageReferences(apiMember, result.members[0].name)
			);
			seen.add(apiMember.canonicalReference);
		}
	}
}

function fixCrossPackageReferences(obj, currentPackage) {
	if (!obj) {
		return obj;
	} else if (Array.isArray(obj)) {
		return obj.map((subMember) =>
			fixCrossPackageReferences(subMember, currentPackage)
		);
	} else if (
		obj.kind === 'Reference' &&
		obj.canonicalReference.includes('!')
	) {
		const [packageName] = obj.canonicalReference.split('!');
		// if (packageName !== currentPackage)
		{
			return {
				...obj,
				canonicalReference: `${packageName}/${obj.canonicalReference}`,
			};
		}
	} else if (typeof obj === 'object') {
		const updatedObj = {};
		for (const [key, value] of Object.entries(obj)) {
			updatedObj[key] = fixCrossPackageReferences(value, currentPackage);
		}
		return updatedObj;
	}

	return obj;
}

// Write the result to stdout
console.log(JSON.stringify(result, null, 2));
