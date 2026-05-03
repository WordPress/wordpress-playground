'use strict';
export const validate = validate10;
export default validate10;
const schema11 = {
	$schema: 'http://json-schema.org/schema',
	$ref: '#/definitions/PHPExtensionManifest',
	definitions: {
		PHPExtensionManifest: {
			type: 'object',
			properties: {
				name: { type: 'string' },
				version: { type: 'string' },
				mode: { type: 'string', const: 'php-extension' },
				artifacts: {
					type: 'array',
					items: {
						$ref: '#/definitions/PHPExtensionManifestArtifact',
					},
				},
				extraFiles: {
					$ref: '#/definitions/PHPExtensionManifestExtraFiles',
					description:
						'URL-backed files shared by every artifact in this manifest.',
				},
			},
			required: ['name', 'artifacts'],
			additionalProperties: false,
			description:
				'Extension artifact manifest. Lets callers publish a matrix of `.so` files and lets `resolvePHPExtension()` select the artifact matching the current PHP version. External extension artifacts are JSPI-only.',
		},
		PHPExtensionManifestArtifact: {
			type: 'object',
			properties: {
				phpVersion: {
					type: 'string',
					description: 'PHP major/minor version, e.g. `8.4`.',
				},
				sourcePath: {
					type: 'string',
					description:
						'Relative to the manifest URL/base URL, or an absolute URL.',
				},
				extraFiles: {
					$ref: '#/definitions/PHPExtensionManifestExtraFiles',
					description:
						'URL-backed files needed only by this artifact.',
				},
			},
			required: ['phpVersion', 'sourcePath'],
			additionalProperties: false,
		},
		PHPExtensionManifestExtraFiles: {
			type: 'object',
			properties: {
				vfsRoot: {
					type: 'string',
					description:
						'Absolute VFS path where files and directories are written. When a manifest declares both top-level and per-artifact `extraFiles`, the first declared `targetPath` wins. Defaults to `<extensionDir>/<name>-assets`.',
				},
				nodes: {
					type: 'array',
					items: {
						$ref: '#/definitions/PHPExtensionManifestExtraFile',
					},
				},
			},
			additionalProperties: false,
		},
		PHPExtensionManifestExtraFile: {
			type: 'object',
			properties: {
				vfsPath: {
					type: 'string',
					description:
						"Joined with the group's `vfsRoot` to form the final VFS path.",
				},
				type: {
					type: 'string',
					enum: ['file', 'directory'],
					description:
						'Defaults to "file". Only file nodes need a `sourcePath`.',
				},
				sourcePath: {
					type: 'string',
					description:
						'Relative to the manifest URL/base URL, or an absolute URL.',
				},
			},
			required: ['vfsPath'],
			additionalProperties: false,
		},
	},
};
const schema12 = {
	type: 'object',
	properties: {
		name: { type: 'string' },
		version: { type: 'string' },
		mode: { type: 'string', const: 'php-extension' },
		artifacts: {
			type: 'array',
			items: { $ref: '#/definitions/PHPExtensionManifestArtifact' },
		},
		extraFiles: {
			$ref: '#/definitions/PHPExtensionManifestExtraFiles',
			description:
				'URL-backed files shared by every artifact in this manifest.',
		},
	},
	required: ['name', 'artifacts'],
	additionalProperties: false,
	description:
		'Extension artifact manifest. Lets callers publish a matrix of `.so` files and lets `resolvePHPExtension()` select the artifact matching the current PHP version. External extension artifacts are JSPI-only.',
};
const schema13 = {
	type: 'object',
	properties: {
		phpVersion: {
			type: 'string',
			description: 'PHP major/minor version, e.g. `8.4`.',
		},
		sourcePath: {
			type: 'string',
			description:
				'Relative to the manifest URL/base URL, or an absolute URL.',
		},
		extraFiles: {
			$ref: '#/definitions/PHPExtensionManifestExtraFiles',
			description: 'URL-backed files needed only by this artifact.',
		},
	},
	required: ['phpVersion', 'sourcePath'],
	additionalProperties: false,
};
const schema14 = {
	type: 'object',
	properties: {
		vfsRoot: {
			type: 'string',
			description:
				'Absolute VFS path where files and directories are written. When a manifest declares both top-level and per-artifact `extraFiles`, the first declared `targetPath` wins. Defaults to `<extensionDir>/<name>-assets`.',
		},
		nodes: {
			type: 'array',
			items: { $ref: '#/definitions/PHPExtensionManifestExtraFile' },
		},
	},
	additionalProperties: false,
};
const schema15 = {
	type: 'object',
	properties: {
		vfsPath: {
			type: 'string',
			description:
				"Joined with the group's `vfsRoot` to form the final VFS path.",
		},
		type: {
			type: 'string',
			enum: ['file', 'directory'],
			description:
				'Defaults to "file". Only file nodes need a `sourcePath`.',
		},
		sourcePath: {
			type: 'string',
			description:
				'Relative to the manifest URL/base URL, or an absolute URL.',
		},
	},
	required: ['vfsPath'],
	additionalProperties: false,
};
function validate13(
	data,
	{ instancePath = '', parentData, parentDataProperty, rootData = data } = {}
) {
	let vErrors = null;
	let errors = 0;
	if (errors === 0) {
		if (data && typeof data == 'object' && !Array.isArray(data)) {
			const _errs1 = errors;
			for (const key0 in data) {
				if (!(key0 === 'vfsRoot' || key0 === 'nodes')) {
					validate13.errors = [
						{
							instancePath,
							schemaPath: '#/additionalProperties',
							keyword: 'additionalProperties',
							params: { additionalProperty: key0 },
							message: 'must NOT have additional properties',
						},
					];
					return false;
					break;
				}
			}
			if (_errs1 === errors) {
				if (data.vfsRoot !== undefined) {
					const _errs2 = errors;
					if (typeof data.vfsRoot !== 'string') {
						validate13.errors = [
							{
								instancePath: instancePath + '/vfsRoot',
								schemaPath: '#/properties/vfsRoot/type',
								keyword: 'type',
								params: { type: 'string' },
								message: 'must be string',
							},
						];
						return false;
					}
					var valid0 = _errs2 === errors;
				} else {
					var valid0 = true;
				}
				if (valid0) {
					if (data.nodes !== undefined) {
						let data1 = data.nodes;
						const _errs4 = errors;
						if (errors === _errs4) {
							if (Array.isArray(data1)) {
								var valid1 = true;
								const len0 = data1.length;
								for (let i0 = 0; i0 < len0; i0++) {
									let data2 = data1[i0];
									const _errs6 = errors;
									const _errs7 = errors;
									if (errors === _errs7) {
										if (
											data2 &&
											typeof data2 == 'object' &&
											!Array.isArray(data2)
										) {
											let missing0;
											if (
												data2.vfsPath === undefined &&
												(missing0 = 'vfsPath')
											) {
												validate13.errors = [
													{
														instancePath:
															instancePath +
															'/nodes/' +
															i0,
														schemaPath:
															'#/definitions/PHPExtensionManifestExtraFile/required',
														keyword: 'required',
														params: {
															missingProperty:
																missing0,
														},
														message:
															"must have required property '" +
															missing0 +
															"'",
													},
												];
												return false;
											} else {
												const _errs9 = errors;
												for (const key1 in data2) {
													if (
														!(
															key1 ===
																'vfsPath' ||
															key1 === 'type' ||
															key1 ===
																'sourcePath'
														)
													) {
														validate13.errors = [
															{
																instancePath:
																	instancePath +
																	'/nodes/' +
																	i0,
																schemaPath:
																	'#/definitions/PHPExtensionManifestExtraFile/additionalProperties',
																keyword:
																	'additionalProperties',
																params: {
																	additionalProperty:
																		key1,
																},
																message:
																	'must NOT have additional properties',
															},
														];
														return false;
														break;
													}
												}
												if (_errs9 === errors) {
													if (
														data2.vfsPath !==
														undefined
													) {
														const _errs10 = errors;
														if (
															typeof data2.vfsPath !==
															'string'
														) {
															validate13.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/nodes/' +
																			i0 +
																			'/vfsPath',
																		schemaPath:
																			'#/definitions/PHPExtensionManifestExtraFile/properties/vfsPath/type',
																		keyword:
																			'type',
																		params: {
																			type: 'string',
																		},
																		message:
																			'must be string',
																	},
																];
															return false;
														}
														var valid3 =
															_errs10 === errors;
													} else {
														var valid3 = true;
													}
													if (valid3) {
														if (
															data2.type !==
															undefined
														) {
															let data4 =
																data2.type;
															const _errs12 =
																errors;
															if (
																typeof data4 !==
																'string'
															) {
																validate13.errors =
																	[
																		{
																			instancePath:
																				instancePath +
																				'/nodes/' +
																				i0 +
																				'/type',
																			schemaPath:
																				'#/definitions/PHPExtensionManifestExtraFile/properties/type/type',
																			keyword:
																				'type',
																			params: {
																				type: 'string',
																			},
																			message:
																				'must be string',
																		},
																	];
																return false;
															}
															if (
																!(
																	data4 ===
																		'file' ||
																	data4 ===
																		'directory'
																)
															) {
																validate13.errors =
																	[
																		{
																			instancePath:
																				instancePath +
																				'/nodes/' +
																				i0 +
																				'/type',
																			schemaPath:
																				'#/definitions/PHPExtensionManifestExtraFile/properties/type/enum',
																			keyword:
																				'enum',
																			params: {
																				allowedValues:
																					schema15
																						.properties
																						.type
																						.enum,
																			},
																			message:
																				'must be equal to one of the allowed values',
																		},
																	];
																return false;
															}
															var valid3 =
																_errs12 ===
																errors;
														} else {
															var valid3 = true;
														}
														if (valid3) {
															if (
																data2.sourcePath !==
																undefined
															) {
																const _errs14 =
																	errors;
																if (
																	typeof data2.sourcePath !==
																	'string'
																) {
																	validate13.errors =
																		[
																			{
																				instancePath:
																					instancePath +
																					'/nodes/' +
																					i0 +
																					'/sourcePath',
																				schemaPath:
																					'#/definitions/PHPExtensionManifestExtraFile/properties/sourcePath/type',
																				keyword:
																					'type',
																				params: {
																					type: 'string',
																				},
																				message:
																					'must be string',
																			},
																		];
																	return false;
																}
																var valid3 =
																	_errs14 ===
																	errors;
															} else {
																var valid3 = true;
															}
														}
													}
												}
											}
										} else {
											validate13.errors = [
												{
													instancePath:
														instancePath +
														'/nodes/' +
														i0,
													schemaPath:
														'#/definitions/PHPExtensionManifestExtraFile/type',
													keyword: 'type',
													params: { type: 'object' },
													message: 'must be object',
												},
											];
											return false;
										}
									}
									var valid1 = _errs6 === errors;
									if (!valid1) {
										break;
									}
								}
							} else {
								validate13.errors = [
									{
										instancePath: instancePath + '/nodes',
										schemaPath: '#/properties/nodes/type',
										keyword: 'type',
										params: { type: 'array' },
										message: 'must be array',
									},
								];
								return false;
							}
						}
						var valid0 = _errs4 === errors;
					} else {
						var valid0 = true;
					}
				}
			}
		} else {
			validate13.errors = [
				{
					instancePath,
					schemaPath: '#/type',
					keyword: 'type',
					params: { type: 'object' },
					message: 'must be object',
				},
			];
			return false;
		}
	}
	validate13.errors = vErrors;
	return errors === 0;
}
function validate12(
	data,
	{ instancePath = '', parentData, parentDataProperty, rootData = data } = {}
) {
	let vErrors = null;
	let errors = 0;
	if (errors === 0) {
		if (data && typeof data == 'object' && !Array.isArray(data)) {
			let missing0;
			if (
				(data.phpVersion === undefined && (missing0 = 'phpVersion')) ||
				(data.sourcePath === undefined && (missing0 = 'sourcePath'))
			) {
				validate12.errors = [
					{
						instancePath,
						schemaPath: '#/required',
						keyword: 'required',
						params: { missingProperty: missing0 },
						message:
							"must have required property '" + missing0 + "'",
					},
				];
				return false;
			} else {
				const _errs1 = errors;
				for (const key0 in data) {
					if (
						!(
							key0 === 'phpVersion' ||
							key0 === 'sourcePath' ||
							key0 === 'extraFiles'
						)
					) {
						validate12.errors = [
							{
								instancePath,
								schemaPath: '#/additionalProperties',
								keyword: 'additionalProperties',
								params: { additionalProperty: key0 },
								message: 'must NOT have additional properties',
							},
						];
						return false;
						break;
					}
				}
				if (_errs1 === errors) {
					if (data.phpVersion !== undefined) {
						const _errs2 = errors;
						if (typeof data.phpVersion !== 'string') {
							validate12.errors = [
								{
									instancePath: instancePath + '/phpVersion',
									schemaPath: '#/properties/phpVersion/type',
									keyword: 'type',
									params: { type: 'string' },
									message: 'must be string',
								},
							];
							return false;
						}
						var valid0 = _errs2 === errors;
					} else {
						var valid0 = true;
					}
					if (valid0) {
						if (data.sourcePath !== undefined) {
							const _errs4 = errors;
							if (typeof data.sourcePath !== 'string') {
								validate12.errors = [
									{
										instancePath:
											instancePath + '/sourcePath',
										schemaPath:
											'#/properties/sourcePath/type',
										keyword: 'type',
										params: { type: 'string' },
										message: 'must be string',
									},
								];
								return false;
							}
							var valid0 = _errs4 === errors;
						} else {
							var valid0 = true;
						}
						if (valid0) {
							if (data.extraFiles !== undefined) {
								const _errs6 = errors;
								if (
									!validate13(data.extraFiles, {
										instancePath:
											instancePath + '/extraFiles',
										parentData: data,
										parentDataProperty: 'extraFiles',
										rootData,
									})
								) {
									vErrors =
										vErrors === null
											? validate13.errors
											: vErrors.concat(validate13.errors);
									errors = vErrors.length;
								}
								var valid0 = _errs6 === errors;
							} else {
								var valid0 = true;
							}
						}
					}
				}
			}
		} else {
			validate12.errors = [
				{
					instancePath,
					schemaPath: '#/type',
					keyword: 'type',
					params: { type: 'object' },
					message: 'must be object',
				},
			];
			return false;
		}
	}
	validate12.errors = vErrors;
	return errors === 0;
}
function validate11(
	data,
	{ instancePath = '', parentData, parentDataProperty, rootData = data } = {}
) {
	let vErrors = null;
	let errors = 0;
	if (errors === 0) {
		if (data && typeof data == 'object' && !Array.isArray(data)) {
			let missing0;
			if (
				(data.name === undefined && (missing0 = 'name')) ||
				(data.artifacts === undefined && (missing0 = 'artifacts'))
			) {
				validate11.errors = [
					{
						instancePath,
						schemaPath: '#/required',
						keyword: 'required',
						params: { missingProperty: missing0 },
						message:
							"must have required property '" + missing0 + "'",
					},
				];
				return false;
			} else {
				const _errs1 = errors;
				for (const key0 in data) {
					if (
						!(
							key0 === 'name' ||
							key0 === 'version' ||
							key0 === 'mode' ||
							key0 === 'artifacts' ||
							key0 === 'extraFiles'
						)
					) {
						validate11.errors = [
							{
								instancePath,
								schemaPath: '#/additionalProperties',
								keyword: 'additionalProperties',
								params: { additionalProperty: key0 },
								message: 'must NOT have additional properties',
							},
						];
						return false;
						break;
					}
				}
				if (_errs1 === errors) {
					if (data.name !== undefined) {
						const _errs2 = errors;
						if (typeof data.name !== 'string') {
							validate11.errors = [
								{
									instancePath: instancePath + '/name',
									schemaPath: '#/properties/name/type',
									keyword: 'type',
									params: { type: 'string' },
									message: 'must be string',
								},
							];
							return false;
						}
						var valid0 = _errs2 === errors;
					} else {
						var valid0 = true;
					}
					if (valid0) {
						if (data.version !== undefined) {
							const _errs4 = errors;
							if (typeof data.version !== 'string') {
								validate11.errors = [
									{
										instancePath: instancePath + '/version',
										schemaPath: '#/properties/version/type',
										keyword: 'type',
										params: { type: 'string' },
										message: 'must be string',
									},
								];
								return false;
							}
							var valid0 = _errs4 === errors;
						} else {
							var valid0 = true;
						}
						if (valid0) {
							if (data.mode !== undefined) {
								let data2 = data.mode;
								const _errs6 = errors;
								if (typeof data2 !== 'string') {
									validate11.errors = [
										{
											instancePath:
												instancePath + '/mode',
											schemaPath:
												'#/properties/mode/type',
											keyword: 'type',
											params: { type: 'string' },
											message: 'must be string',
										},
									];
									return false;
								}
								if ('php-extension' !== data2) {
									validate11.errors = [
										{
											instancePath:
												instancePath + '/mode',
											schemaPath:
												'#/properties/mode/const',
											keyword: 'const',
											params: {
												allowedValue: 'php-extension',
											},
											message:
												'must be equal to constant',
										},
									];
									return false;
								}
								var valid0 = _errs6 === errors;
							} else {
								var valid0 = true;
							}
							if (valid0) {
								if (data.artifacts !== undefined) {
									let data3 = data.artifacts;
									const _errs8 = errors;
									if (errors === _errs8) {
										if (Array.isArray(data3)) {
											var valid1 = true;
											const len0 = data3.length;
											for (let i0 = 0; i0 < len0; i0++) {
												const _errs10 = errors;
												if (
													!validate12(data3[i0], {
														instancePath:
															instancePath +
															'/artifacts/' +
															i0,
														parentData: data3,
														parentDataProperty: i0,
														rootData,
													})
												) {
													vErrors =
														vErrors === null
															? validate12.errors
															: vErrors.concat(
																	validate12.errors
																);
													errors = vErrors.length;
												}
												var valid1 = _errs10 === errors;
												if (!valid1) {
													break;
												}
											}
										} else {
											validate11.errors = [
												{
													instancePath:
														instancePath +
														'/artifacts',
													schemaPath:
														'#/properties/artifacts/type',
													keyword: 'type',
													params: { type: 'array' },
													message: 'must be array',
												},
											];
											return false;
										}
									}
									var valid0 = _errs8 === errors;
								} else {
									var valid0 = true;
								}
								if (valid0) {
									if (data.extraFiles !== undefined) {
										const _errs11 = errors;
										if (
											!validate13(data.extraFiles, {
												instancePath:
													instancePath +
													'/extraFiles',
												parentData: data,
												parentDataProperty:
													'extraFiles',
												rootData,
											})
										) {
											vErrors =
												vErrors === null
													? validate13.errors
													: vErrors.concat(
															validate13.errors
														);
											errors = vErrors.length;
										}
										var valid0 = _errs11 === errors;
									} else {
										var valid0 = true;
									}
								}
							}
						}
					}
				}
			}
		} else {
			validate11.errors = [
				{
					instancePath,
					schemaPath: '#/type',
					keyword: 'type',
					params: { type: 'object' },
					message: 'must be object',
				},
			];
			return false;
		}
	}
	validate11.errors = vErrors;
	return errors === 0;
}
function validate10(
	data,
	{ instancePath = '', parentData, parentDataProperty, rootData = data } = {}
) {
	let vErrors = null;
	let errors = 0;
	if (
		!validate11(data, {
			instancePath,
			parentData,
			parentDataProperty,
			rootData,
		})
	) {
		vErrors =
			vErrors === null
				? validate11.errors
				: vErrors.concat(validate11.errors);
		errors = vErrors.length;
	}
	validate10.errors = vErrors;
	return errors === 0;
}
