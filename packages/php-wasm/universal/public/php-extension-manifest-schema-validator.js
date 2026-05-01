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
						'Additional URL-backed files shared by all artifacts.',
				},
			},
			required: ['name', 'artifacts'],
			additionalProperties: false,
			description:
				'Extension artifact manifest.\n\nA manifest lets callers publish a matrix of `.so` files and lets `resolvePHPExtension()` select the artifact that matches the current PHP version. External extension artifacts are JSPI-only.',
		},
		PHPExtensionManifestArtifact: {
			type: 'object',
			properties: {
				phpVersion: {
					type: 'string',
					description:
						'PHP major/minor version the artifact was compiled against, e.g. `8.4`.',
				},
				file: {
					type: 'string',
					description:
						'Relative to the manifest URL/base URL, or an absolute URL.',
				},
				sha256: {
					type: 'string',
					description:
						'Optional SHA-256 checksum for the fetched `.so` artifact.',
				},
				extraFiles: {
					$ref: '#/definitions/PHPExtensionManifestExtraFiles',
					description:
						'Additional URL-backed files to fetch for this artifact.\n\nUse this for files that differ by PHP version or async mode.',
				},
			},
			required: ['phpVersion', 'file'],
			additionalProperties: false,
			description: 'One compiled extension artifact in a manifest.',
		},
		PHPExtensionManifestExtraFiles: {
			type: 'object',
			properties: {
				targetPath: {
					type: 'string',
					description:
						'Files and directories are written here. Defaults to `/internal/shared/extensions/<name>-assets`.',
				},
				directories: {
					type: 'array',
					items: { type: 'string' },
					description:
						'Empty directories to create under `targetPath`.',
				},
				files: {
					type: 'array',
					items: {
						$ref: '#/definitions/PHPExtensionManifestExtraFile',
					},
					description: 'Files to fetch and stage under `targetPath`.',
				},
			},
			additionalProperties: false,
			description: 'URL-backed files to stage with a manifest extension.',
		},
		PHPExtensionManifestExtraFile: {
			type: 'object',
			properties: {
				path: {
					type: 'string',
					description:
						'Relative VFS path under `PHPExtensionManifestExtraFiles.targetPath`.',
				},
				file: {
					type: 'string',
					description:
						'Relative to the manifest URL/base URL, or an absolute URL.',
				},
			},
			required: ['path', 'file'],
			additionalProperties: false,
			description: 'One sidecar file declared by an extension manifest.',
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
			description: 'Additional URL-backed files shared by all artifacts.',
		},
	},
	required: ['name', 'artifacts'],
	additionalProperties: false,
	description:
		'Extension artifact manifest.\n\nA manifest lets callers publish a matrix of `.so` files and lets `resolvePHPExtension()` select the artifact that matches the current PHP version. External extension artifacts are JSPI-only.',
};
const schema13 = {
	type: 'object',
	properties: {
		phpVersion: {
			type: 'string',
			description:
				'PHP major/minor version the artifact was compiled against, e.g. `8.4`.',
		},
		file: {
			type: 'string',
			description:
				'Relative to the manifest URL/base URL, or an absolute URL.',
		},
		sha256: {
			type: 'string',
			description:
				'Optional SHA-256 checksum for the fetched `.so` artifact.',
		},
		extraFiles: {
			$ref: '#/definitions/PHPExtensionManifestExtraFiles',
			description:
				'Additional URL-backed files to fetch for this artifact.\n\nUse this for files that differ by PHP version or async mode.',
		},
	},
	required: ['phpVersion', 'file'],
	additionalProperties: false,
	description: 'One compiled extension artifact in a manifest.',
};
const schema14 = {
	type: 'object',
	properties: {
		targetPath: {
			type: 'string',
			description:
				'Files and directories are written here. Defaults to `/internal/shared/extensions/<name>-assets`.',
		},
		directories: {
			type: 'array',
			items: { type: 'string' },
			description: 'Empty directories to create under `targetPath`.',
		},
		files: {
			type: 'array',
			items: { $ref: '#/definitions/PHPExtensionManifestExtraFile' },
			description: 'Files to fetch and stage under `targetPath`.',
		},
	},
	additionalProperties: false,
	description: 'URL-backed files to stage with a manifest extension.',
};
const schema15 = {
	type: 'object',
	properties: {
		path: {
			type: 'string',
			description:
				'Relative VFS path under `PHPExtensionManifestExtraFiles.targetPath`.',
		},
		file: {
			type: 'string',
			description:
				'Relative to the manifest URL/base URL, or an absolute URL.',
		},
	},
	required: ['path', 'file'],
	additionalProperties: false,
	description: 'One sidecar file declared by an extension manifest.',
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
				if (
					!(
						key0 === 'targetPath' ||
						key0 === 'directories' ||
						key0 === 'files'
					)
				) {
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
				if (data.targetPath !== undefined) {
					const _errs2 = errors;
					if (typeof data.targetPath !== 'string') {
						validate13.errors = [
							{
								instancePath: instancePath + '/targetPath',
								schemaPath: '#/properties/targetPath/type',
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
					if (data.directories !== undefined) {
						let data1 = data.directories;
						const _errs4 = errors;
						if (errors === _errs4) {
							if (Array.isArray(data1)) {
								var valid1 = true;
								const len0 = data1.length;
								for (let i0 = 0; i0 < len0; i0++) {
									const _errs6 = errors;
									if (typeof data1[i0] !== 'string') {
										validate13.errors = [
											{
												instancePath:
													instancePath +
													'/directories/' +
													i0,
												schemaPath:
													'#/properties/directories/items/type',
												keyword: 'type',
												params: { type: 'string' },
												message: 'must be string',
											},
										];
										return false;
									}
									var valid1 = _errs6 === errors;
									if (!valid1) {
										break;
									}
								}
							} else {
								validate13.errors = [
									{
										instancePath:
											instancePath + '/directories',
										schemaPath:
											'#/properties/directories/type',
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
					if (valid0) {
						if (data.files !== undefined) {
							let data3 = data.files;
							const _errs8 = errors;
							if (errors === _errs8) {
								if (Array.isArray(data3)) {
									var valid2 = true;
									const len1 = data3.length;
									for (let i1 = 0; i1 < len1; i1++) {
										let data4 = data3[i1];
										const _errs10 = errors;
										const _errs11 = errors;
										if (errors === _errs11) {
											if (
												data4 &&
												typeof data4 == 'object' &&
												!Array.isArray(data4)
											) {
												let missing0;
												if (
													(data4.path === undefined &&
														(missing0 = 'path')) ||
													(data4.file === undefined &&
														(missing0 = 'file'))
												) {
													validate13.errors = [
														{
															instancePath:
																instancePath +
																'/files/' +
																i1,
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
													const _errs13 = errors;
													for (const key1 in data4) {
														if (
															!(
																key1 ===
																	'path' ||
																key1 === 'file'
															)
														) {
															validate13.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/files/' +
																			i1,
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
													if (_errs13 === errors) {
														if (
															data4.path !==
															undefined
														) {
															const _errs14 =
																errors;
															if (
																typeof data4.path !==
																'string'
															) {
																validate13.errors =
																	[
																		{
																			instancePath:
																				instancePath +
																				'/files/' +
																				i1 +
																				'/path',
																			schemaPath:
																				'#/definitions/PHPExtensionManifestExtraFile/properties/path/type',
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
															var valid4 =
																_errs14 ===
																errors;
														} else {
															var valid4 = true;
														}
														if (valid4) {
															if (
																data4.file !==
																undefined
															) {
																const _errs16 =
																	errors;
																if (
																	typeof data4.file !==
																	'string'
																) {
																	validate13.errors =
																		[
																			{
																				instancePath:
																					instancePath +
																					'/files/' +
																					i1 +
																					'/file',
																				schemaPath:
																					'#/definitions/PHPExtensionManifestExtraFile/properties/file/type',
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
																var valid4 =
																	_errs16 ===
																	errors;
															} else {
																var valid4 = true;
															}
														}
													}
												}
											} else {
												validate13.errors = [
													{
														instancePath:
															instancePath +
															'/files/' +
															i1,
														schemaPath:
															'#/definitions/PHPExtensionManifestExtraFile/type',
														keyword: 'type',
														params: {
															type: 'object',
														},
														message:
															'must be object',
													},
												];
												return false;
											}
										}
										var valid2 = _errs10 === errors;
										if (!valid2) {
											break;
										}
									}
								} else {
									validate13.errors = [
										{
											instancePath:
												instancePath + '/files',
											schemaPath:
												'#/properties/files/type',
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
				(data.file === undefined && (missing0 = 'file'))
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
							key0 === 'file' ||
							key0 === 'sha256' ||
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
						if (data.file !== undefined) {
							const _errs4 = errors;
							if (typeof data.file !== 'string') {
								validate12.errors = [
									{
										instancePath: instancePath + '/file',
										schemaPath: '#/properties/file/type',
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
							if (data.sha256 !== undefined) {
								const _errs6 = errors;
								if (typeof data.sha256 !== 'string') {
									validate12.errors = [
										{
											instancePath:
												instancePath + '/sha256',
											schemaPath:
												'#/properties/sha256/type',
											keyword: 'type',
											params: { type: 'string' },
											message: 'must be string',
										},
									];
									return false;
								}
								var valid0 = _errs6 === errors;
							} else {
								var valid0 = true;
							}
							if (valid0) {
								if (data.extraFiles !== undefined) {
									const _errs8 = errors;
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
												: vErrors.concat(
														validate13.errors
													);
										errors = vErrors.length;
									}
									var valid0 = _errs8 === errors;
								} else {
									var valid0 = true;
								}
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
