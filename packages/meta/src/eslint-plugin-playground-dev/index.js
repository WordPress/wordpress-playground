const wpBuildsDepRule = require('./avoid-wordpress-builds-dependency');
const noUnsupportedTypescriptSyntaxRule = require('./no-unsupported-typescript-syntax');
const plugin = {
	rules: {
		'avoid-wordpress-builds-dependency': wpBuildsDepRule,
		'no-unsupported-typescript-syntax': noUnsupportedTypescriptSyntaxRule,
	},
};
module.exports = plugin;
