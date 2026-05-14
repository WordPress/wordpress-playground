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
				loadWithIniDirective: {
					$ref: '#/definitions/PHPExtensionLoadDirective',
					description:
						'The first directive of the generated startup `.ini` file. Defaults to `extension`; use `zend_extension` for Zend extensions like Xdebug. Use `false` to stage the `.so` without registering it in php.ini.',
				},
				iniEntries: {
					type: 'object',
					additionalProperties: { type: 'string' },
					description:
						'Additional `key=value` lines for the generated startup `.ini` file.',
				},
				env: {
					type: 'object',
					additionalProperties: { type: 'string' },
					description:
						'Environment variables added before the extension is loaded.',
				},
				extensionDir: {
					type: 'string',
					description:
						'VFS directory where PHP.wasm writes the extension `.so` file and its per-extension ini file. Defaults to `PHP_EXTENSIONS_DIR`.',
				},
				artifacts: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							phpVersion: {
								type: 'string',
								description:
									'PHP major/minor version, e.g. `8.4`.',
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
		PHPExtensionLoadDirective: {
			anyOf: [
				{ $ref: '#/definitions/PHPExtensionIniDirective' },
				{ type: 'boolean', const: false },
			],
		},
		PHPExtensionIniDirective: {
			type: 'string',
			enum: ['extension', 'zend_extension'],
			description:
				'The php.ini directive used to load the extension. Use `extension` for regular PHP extensions and `zend_extension` for Zend extensions like Xdebug.',
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
			},
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
		loadWithIniDirective: {
			$ref: '#/definitions/PHPExtensionLoadDirective',
			description:
				'The first directive of the generated startup `.ini` file. Defaults to `extension`; use `zend_extension` for Zend extensions like Xdebug. Use `false` to stage the `.so` without registering it in php.ini.',
		},
		iniEntries: {
			type: 'object',
			additionalProperties: { type: 'string' },
			description:
				'Additional `key=value` lines for the generated startup `.ini` file.',
		},
		env: {
			type: 'object',
			additionalProperties: { type: 'string' },
			description:
				'Environment variables added before the extension is loaded.',
		},
		extensionDir: {
			type: 'string',
			description:
				'VFS directory where PHP.wasm writes the extension `.so` file and its per-extension ini file. Defaults to `PHP_EXTENSIONS_DIR`.',
		},
		artifacts: {
			type: 'array',
			items: {
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
const schema15 = {
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
	},
	additionalProperties: false,
};
const func2 = Object.prototype.hasOwnProperty;
const schema13 = {
	anyOf: [
		{ $ref: '#/definitions/PHPExtensionIniDirective' },
		{ type: 'boolean', const: false },
	],
};
const schema14 = {
	type: 'string',
	enum: ['extension', 'zend_extension'],
	description:
		'The php.ini directive used to load the extension. Use `extension` for regular PHP extensions and `zend_extension` for Zend extensions like Xdebug.',
};
function validate12(
	data,
	{ instancePath = '', parentData, parentDataProperty, rootData = data } = {}
) {
	let vErrors = null;
	let errors = 0;
	const _errs0 = errors;
	let valid0 = false;
	const _errs1 = errors;
	if (typeof data !== 'string') {
		const err0 = {
			instancePath,
			schemaPath: '#/definitions/PHPExtensionIniDirective/type',
			keyword: 'type',
			params: { type: 'string' },
			message: 'must be string',
		};
		if (vErrors === null) {
			vErrors = [err0];
		} else {
			vErrors.push(err0);
		}
		errors++;
	}
	if (!(data === 'extension' || data === 'zend_extension')) {
		const err1 = {
			instancePath,
			schemaPath: '#/definitions/PHPExtensionIniDirective/enum',
			keyword: 'enum',
			params: { allowedValues: schema14.enum },
			message: 'must be equal to one of the allowed values',
		};
		if (vErrors === null) {
			vErrors = [err1];
		} else {
			vErrors.push(err1);
		}
		errors++;
	}
	var _valid0 = _errs1 === errors;
	valid0 = valid0 || _valid0;
	if (!valid0) {
		const _errs4 = errors;
		if (typeof data !== 'boolean') {
			const err2 = {
				instancePath,
				schemaPath: '#/anyOf/1/type',
				keyword: 'type',
				params: { type: 'boolean' },
				message: 'must be boolean',
			};
			if (vErrors === null) {
				vErrors = [err2];
			} else {
				vErrors.push(err2);
			}
			errors++;
		}
		if (false !== data) {
			const err3 = {
				instancePath,
				schemaPath: '#/anyOf/1/const',
				keyword: 'const',
				params: { allowedValue: false },
				message: 'must be equal to constant',
			};
			if (vErrors === null) {
				vErrors = [err3];
			} else {
				vErrors.push(err3);
			}
			errors++;
		}
		var _valid0 = _errs4 === errors;
		valid0 = valid0 || _valid0;
	}
	if (!valid0) {
		const err4 = {
			instancePath,
			schemaPath: '#/anyOf',
			keyword: 'anyOf',
			params: {},
			message: 'must match a schema in anyOf',
		};
		if (vErrors === null) {
			vErrors = [err4];
		} else {
			vErrors.push(err4);
		}
		errors++;
		validate12.errors = vErrors;
		return false;
	} else {
		errors = _errs0;
		if (vErrors !== null) {
			if (_errs0) {
				vErrors.length = _errs0;
			} else {
				vErrors = null;
			}
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
					if (!func2.call(schema12.properties, key0)) {
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
								if (data.loadWithIniDirective !== undefined) {
									const _errs8 = errors;
									if (
										!validate12(data.loadWithIniDirective, {
											instancePath:
												instancePath +
												'/loadWithIniDirective',
											parentData: data,
											parentDataProperty:
												'loadWithIniDirective',
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
									var valid0 = _errs8 === errors;
								} else {
									var valid0 = true;
								}
								if (valid0) {
									if (data.iniEntries !== undefined) {
										let data4 = data.iniEntries;
										const _errs9 = errors;
										if (errors === _errs9) {
											if (
												data4 &&
												typeof data4 == 'object' &&
												!Array.isArray(data4)
											) {
												for (const key1 in data4) {
													const _errs12 = errors;
													if (
														typeof data4[key1] !==
														'string'
													) {
														validate11.errors = [
															{
																instancePath:
																	instancePath +
																	'/iniEntries/' +
																	key1
																		.replace(
																			/~/g,
																			'~0'
																		)
																		.replace(
																			/\//g,
																			'~1'
																		),
																schemaPath:
																	'#/properties/iniEntries/additionalProperties/type',
																keyword: 'type',
																params: {
																	type: 'string',
																},
																message:
																	'must be string',
															},
														];
														return false;
													}
													var valid1 =
														_errs12 === errors;
													if (!valid1) {
														break;
													}
												}
											} else {
												validate11.errors = [
													{
														instancePath:
															instancePath +
															'/iniEntries',
														schemaPath:
															'#/properties/iniEntries/type',
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
										var valid0 = _errs9 === errors;
									} else {
										var valid0 = true;
									}
									if (valid0) {
										if (data.env !== undefined) {
											let data6 = data.env;
											const _errs14 = errors;
											if (errors === _errs14) {
												if (
													data6 &&
													typeof data6 == 'object' &&
													!Array.isArray(data6)
												) {
													for (const key2 in data6) {
														const _errs17 = errors;
														if (
															typeof data6[
																key2
															] !== 'string'
														) {
															validate11.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/env/' +
																			key2
																				.replace(
																					/~/g,
																					'~0'
																				)
																				.replace(
																					/\//g,
																					'~1'
																				),
																		schemaPath:
																			'#/properties/env/additionalProperties/type',
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
														var valid2 =
															_errs17 === errors;
														if (!valid2) {
															break;
														}
													}
												} else {
													validate11.errors = [
														{
															instancePath:
																instancePath +
																'/env',
															schemaPath:
																'#/properties/env/type',
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
											var valid0 = _errs14 === errors;
										} else {
											var valid0 = true;
										}
										if (valid0) {
											if (
												data.extensionDir !== undefined
											) {
												const _errs19 = errors;
												if (
													typeof data.extensionDir !==
													'string'
												) {
													validate11.errors = [
														{
															instancePath:
																instancePath +
																'/extensionDir',
															schemaPath:
																'#/properties/extensionDir/type',
															keyword: 'type',
															params: {
																type: 'string',
															},
															message:
																'must be string',
														},
													];
													return false;
												}
												var valid0 = _errs19 === errors;
											} else {
												var valid0 = true;
											}
											if (valid0) {
												if (
													data.artifacts !== undefined
												) {
													let data9 = data.artifacts;
													const _errs21 = errors;
													if (errors === _errs21) {
														if (
															Array.isArray(data9)
														) {
															var valid3 = true;
															const len0 =
																data9.length;
															for (
																let i0 = 0;
																i0 < len0;
																i0++
															) {
																let data10 =
																	data9[i0];
																const _errs23 =
																	errors;
																if (
																	errors ===
																	_errs23
																) {
																	if (
																		data10 &&
																		typeof data10 ==
																			'object' &&
																		!Array.isArray(
																			data10
																		)
																	) {
																		let missing1;
																		if (
																			(data10.phpVersion ===
																				undefined &&
																				(missing1 =
																					'phpVersion')) ||
																			(data10.sourcePath ===
																				undefined &&
																				(missing1 =
																					'sourcePath'))
																		) {
																			validate11.errors =
																				[
																					{
																						instancePath:
																							instancePath +
																							'/artifacts/' +
																							i0,
																						schemaPath:
																							'#/properties/artifacts/items/required',
																						keyword:
																							'required',
																						params: {
																							missingProperty:
																								missing1,
																						},
																						message:
																							"must have required property '" +
																							missing1 +
																							"'",
																					},
																				];
																			return false;
																		} else {
																			const _errs25 =
																				errors;
																			for (const key3 in data10) {
																				if (
																					!(
																						key3 ===
																							'phpVersion' ||
																						key3 ===
																							'sourcePath' ||
																						key3 ===
																							'extraFiles'
																					)
																				) {
																					validate11.errors =
																						[
																							{
																								instancePath:
																									instancePath +
																									'/artifacts/' +
																									i0,
																								schemaPath:
																									'#/properties/artifacts/items/additionalProperties',
																								keyword:
																									'additionalProperties',
																								params: {
																									additionalProperty:
																										key3,
																								},
																								message:
																									'must NOT have additional properties',
																							},
																						];
																					return false;
																					break;
																				}
																			}
																			if (
																				_errs25 ===
																				errors
																			) {
																				if (
																					data10.phpVersion !==
																					undefined
																				) {
																					const _errs26 =
																						errors;
																					if (
																						typeof data10.phpVersion !==
																						'string'
																					) {
																						validate11.errors =
																							[
																								{
																									instancePath:
																										instancePath +
																										'/artifacts/' +
																										i0 +
																										'/phpVersion',
																									schemaPath:
																										'#/properties/artifacts/items/properties/phpVersion/type',
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
																						_errs26 ===
																						errors;
																				} else {
																					var valid4 = true;
																				}
																				if (
																					valid4
																				) {
																					if (
																						data10.sourcePath !==
																						undefined
																					) {
																						const _errs28 =
																							errors;
																						if (
																							typeof data10.sourcePath !==
																							'string'
																						) {
																							validate11.errors =
																								[
																									{
																										instancePath:
																											instancePath +
																											'/artifacts/' +
																											i0 +
																											'/sourcePath',
																										schemaPath:
																											'#/properties/artifacts/items/properties/sourcePath/type',
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
																							_errs28 ===
																							errors;
																					} else {
																						var valid4 = true;
																					}
																					if (
																						valid4
																					) {
																						if (
																							data10.extraFiles !==
																							undefined
																						) {
																							let data13 =
																								data10.extraFiles;
																							const _errs30 =
																								errors;
																							const _errs31 =
																								errors;
																							if (
																								errors ===
																								_errs31
																							) {
																								if (
																									data13 &&
																									typeof data13 ==
																										'object' &&
																									!Array.isArray(
																										data13
																									)
																								) {
																									const _errs33 =
																										errors;
																									for (const key4 in data13) {
																										if (
																											!(
																												key4 ===
																													'vfsRoot' ||
																												key4 ===
																													'nodes'
																											)
																										) {
																											validate11.errors =
																												[
																													{
																														instancePath:
																															instancePath +
																															'/artifacts/' +
																															i0 +
																															'/extraFiles',
																														schemaPath:
																															'#/definitions/PHPExtensionManifestExtraFiles/additionalProperties',
																														keyword:
																															'additionalProperties',
																														params: {
																															additionalProperty:
																																key4,
																														},
																														message:
																															'must NOT have additional properties',
																													},
																												];
																											return false;
																											break;
																										}
																									}
																									if (
																										_errs33 ===
																										errors
																									) {
																										if (
																											data13.vfsRoot !==
																											undefined
																										) {
																											const _errs34 =
																												errors;
																											if (
																												typeof data13.vfsRoot !==
																												'string'
																											) {
																												validate11.errors =
																													[
																														{
																															instancePath:
																																instancePath +
																																'/artifacts/' +
																																i0 +
																																'/extraFiles/vfsRoot',
																															schemaPath:
																																'#/definitions/PHPExtensionManifestExtraFiles/properties/vfsRoot/type',
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
																											var valid6 =
																												_errs34 ===
																												errors;
																										} else {
																											var valid6 = true;
																										}
																										if (
																											valid6
																										) {
																											if (
																												data13.nodes !==
																												undefined
																											) {
																												let data15 =
																													data13.nodes;
																												const _errs36 =
																													errors;
																												if (
																													errors ===
																													_errs36
																												) {
																													if (
																														Array.isArray(
																															data15
																														)
																													) {
																														var valid7 = true;
																														const len1 =
																															data15.length;
																														for (
																															let i1 = 0;
																															i1 <
																															len1;
																															i1++
																														) {
																															let data16 =
																																data15[
																																	i1
																																];
																															const _errs38 =
																																errors;
																															if (
																																errors ===
																																_errs38
																															) {
																																if (
																																	data16 &&
																																	typeof data16 ==
																																		'object' &&
																																	!Array.isArray(
																																		data16
																																	)
																																) {
																																	let missing2;
																																	if (
																																		data16.vfsPath ===
																																			undefined &&
																																		(missing2 =
																																			'vfsPath')
																																	) {
																																		validate11.errors =
																																			[
																																				{
																																					instancePath:
																																						instancePath +
																																						'/artifacts/' +
																																						i0 +
																																						'/extraFiles/nodes/' +
																																						i1,
																																					schemaPath:
																																						'#/definitions/PHPExtensionManifestExtraFiles/properties/nodes/items/required',
																																					keyword:
																																						'required',
																																					params: {
																																						missingProperty:
																																							missing2,
																																					},
																																					message:
																																						"must have required property '" +
																																						missing2 +
																																						"'",
																																				},
																																			];
																																		return false;
																																	} else {
																																		const _errs40 =
																																			errors;
																																		for (const key5 in data16) {
																																			if (
																																				!(
																																					key5 ===
																																						'vfsPath' ||
																																					key5 ===
																																						'type' ||
																																					key5 ===
																																						'sourcePath'
																																				)
																																			) {
																																				validate11.errors =
																																					[
																																						{
																																							instancePath:
																																								instancePath +
																																								'/artifacts/' +
																																								i0 +
																																								'/extraFiles/nodes/' +
																																								i1,
																																							schemaPath:
																																								'#/definitions/PHPExtensionManifestExtraFiles/properties/nodes/items/additionalProperties',
																																							keyword:
																																								'additionalProperties',
																																							params: {
																																								additionalProperty:
																																									key5,
																																							},
																																							message:
																																								'must NOT have additional properties',
																																						},
																																					];
																																				return false;
																																				break;
																																			}
																																		}
																																		if (
																																			_errs40 ===
																																			errors
																																		) {
																																			if (
																																				data16.vfsPath !==
																																				undefined
																																			) {
																																				const _errs41 =
																																					errors;
																																				if (
																																					typeof data16.vfsPath !==
																																					'string'
																																				) {
																																					validate11.errors =
																																						[
																																							{
																																								instancePath:
																																									instancePath +
																																									'/artifacts/' +
																																									i0 +
																																									'/extraFiles/nodes/' +
																																									i1 +
																																									'/vfsPath',
																																								schemaPath:
																																									'#/definitions/PHPExtensionManifestExtraFiles/properties/nodes/items/properties/vfsPath/type',
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
																																				var valid8 =
																																					_errs41 ===
																																					errors;
																																			} else {
																																				var valid8 = true;
																																			}
																																			if (
																																				valid8
																																			) {
																																				if (
																																					data16.type !==
																																					undefined
																																				) {
																																					let data18 =
																																						data16.type;
																																					const _errs43 =
																																						errors;
																																					if (
																																						typeof data18 !==
																																						'string'
																																					) {
																																						validate11.errors =
																																							[
																																								{
																																									instancePath:
																																										instancePath +
																																										'/artifacts/' +
																																										i0 +
																																										'/extraFiles/nodes/' +
																																										i1 +
																																										'/type',
																																									schemaPath:
																																										'#/definitions/PHPExtensionManifestExtraFiles/properties/nodes/items/properties/type/type',
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
																																							data18 ===
																																								'file' ||
																																							data18 ===
																																								'directory'
																																						)
																																					) {
																																						validate11.errors =
																																							[
																																								{
																																									instancePath:
																																										instancePath +
																																										'/artifacts/' +
																																										i0 +
																																										'/extraFiles/nodes/' +
																																										i1 +
																																										'/type',
																																									schemaPath:
																																										'#/definitions/PHPExtensionManifestExtraFiles/properties/nodes/items/properties/type/enum',
																																									keyword:
																																										'enum',
																																									params: {
																																										allowedValues:
																																											schema15
																																												.properties
																																												.nodes
																																												.items
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
																																					var valid8 =
																																						_errs43 ===
																																						errors;
																																				} else {
																																					var valid8 = true;
																																				}
																																				if (
																																					valid8
																																				) {
																																					if (
																																						data16.sourcePath !==
																																						undefined
																																					) {
																																						const _errs45 =
																																							errors;
																																						if (
																																							typeof data16.sourcePath !==
																																							'string'
																																						) {
																																							validate11.errors =
																																								[
																																									{
																																										instancePath:
																																											instancePath +
																																											'/artifacts/' +
																																											i0 +
																																											'/extraFiles/nodes/' +
																																											i1 +
																																											'/sourcePath',
																																										schemaPath:
																																											'#/definitions/PHPExtensionManifestExtraFiles/properties/nodes/items/properties/sourcePath/type',
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
																																						var valid8 =
																																							_errs45 ===
																																							errors;
																																					} else {
																																						var valid8 = true;
																																					}
																																				}
																																			}
																																		}
																																	}
																																} else {
																																	validate11.errors =
																																		[
																																			{
																																				instancePath:
																																					instancePath +
																																					'/artifacts/' +
																																					i0 +
																																					'/extraFiles/nodes/' +
																																					i1,
																																				schemaPath:
																																					'#/definitions/PHPExtensionManifestExtraFiles/properties/nodes/items/type',
																																				keyword:
																																					'type',
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
																															var valid7 =
																																_errs38 ===
																																errors;
																															if (
																																!valid7
																															) {
																																break;
																															}
																														}
																													} else {
																														validate11.errors =
																															[
																																{
																																	instancePath:
																																		instancePath +
																																		'/artifacts/' +
																																		i0 +
																																		'/extraFiles/nodes',
																																	schemaPath:
																																		'#/definitions/PHPExtensionManifestExtraFiles/properties/nodes/type',
																																	keyword:
																																		'type',
																																	params: {
																																		type: 'array',
																																	},
																																	message:
																																		'must be array',
																																},
																															];
																														return false;
																													}
																												}
																												var valid6 =
																													_errs36 ===
																													errors;
																											} else {
																												var valid6 = true;
																											}
																										}
																									}
																								} else {
																									validate11.errors =
																										[
																											{
																												instancePath:
																													instancePath +
																													'/artifacts/' +
																													i0 +
																													'/extraFiles',
																												schemaPath:
																													'#/definitions/PHPExtensionManifestExtraFiles/type',
																												keyword:
																													'type',
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
																							var valid4 =
																								_errs30 ===
																								errors;
																						} else {
																							var valid4 = true;
																						}
																					}
																				}
																			}
																		}
																	} else {
																		validate11.errors =
																			[
																				{
																					instancePath:
																						instancePath +
																						'/artifacts/' +
																						i0,
																					schemaPath:
																						'#/properties/artifacts/items/type',
																					keyword:
																						'type',
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
																var valid3 =
																	_errs23 ===
																	errors;
																if (!valid3) {
																	break;
																}
															}
														} else {
															validate11.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/artifacts',
																		schemaPath:
																			'#/properties/artifacts/type',
																		keyword:
																			'type',
																		params: {
																			type: 'array',
																		},
																		message:
																			'must be array',
																	},
																];
															return false;
														}
													}
													var valid0 =
														_errs21 === errors;
												} else {
													var valid0 = true;
												}
												if (valid0) {
													if (
														data.extraFiles !==
														undefined
													) {
														let data20 =
															data.extraFiles;
														const _errs47 = errors;
														const _errs48 = errors;
														if (
															errors === _errs48
														) {
															if (
																data20 &&
																typeof data20 ==
																	'object' &&
																!Array.isArray(
																	data20
																)
															) {
																const _errs50 =
																	errors;
																for (const key6 in data20) {
																	if (
																		!(
																			key6 ===
																				'vfsRoot' ||
																			key6 ===
																				'nodes'
																		)
																	) {
																		validate11.errors =
																			[
																				{
																					instancePath:
																						instancePath +
																						'/extraFiles',
																					schemaPath:
																						'#/definitions/PHPExtensionManifestExtraFiles/additionalProperties',
																					keyword:
																						'additionalProperties',
																					params: {
																						additionalProperty:
																							key6,
																					},
																					message:
																						'must NOT have additional properties',
																				},
																			];
																		return false;
																		break;
																	}
																}
																if (
																	_errs50 ===
																	errors
																) {
																	if (
																		data20.vfsRoot !==
																		undefined
																	) {
																		const _errs51 =
																			errors;
																		if (
																			typeof data20.vfsRoot !==
																			'string'
																		) {
																			validate11.errors =
																				[
																					{
																						instancePath:
																							instancePath +
																							'/extraFiles/vfsRoot',
																						schemaPath:
																							'#/definitions/PHPExtensionManifestExtraFiles/properties/vfsRoot/type',
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
																		var valid10 =
																			_errs51 ===
																			errors;
																	} else {
																		var valid10 = true;
																	}
																	if (
																		valid10
																	) {
																		if (
																			data20.nodes !==
																			undefined
																		) {
																			let data22 =
																				data20.nodes;
																			const _errs53 =
																				errors;
																			if (
																				errors ===
																				_errs53
																			) {
																				if (
																					Array.isArray(
																						data22
																					)
																				) {
																					var valid11 = true;
																					const len2 =
																						data22.length;
																					for (
																						let i2 = 0;
																						i2 <
																						len2;
																						i2++
																					) {
																						let data23 =
																							data22[
																								i2
																							];
																						const _errs55 =
																							errors;
																						if (
																							errors ===
																							_errs55
																						) {
																							if (
																								data23 &&
																								typeof data23 ==
																									'object' &&
																								!Array.isArray(
																									data23
																								)
																							) {
																								let missing3;
																								if (
																									data23.vfsPath ===
																										undefined &&
																									(missing3 =
																										'vfsPath')
																								) {
																									validate11.errors =
																										[
																											{
																												instancePath:
																													instancePath +
																													'/extraFiles/nodes/' +
																													i2,
																												schemaPath:
																													'#/definitions/PHPExtensionManifestExtraFiles/properties/nodes/items/required',
																												keyword:
																													'required',
																												params: {
																													missingProperty:
																														missing3,
																												},
																												message:
																													"must have required property '" +
																													missing3 +
																													"'",
																											},
																										];
																									return false;
																								} else {
																									const _errs57 =
																										errors;
																									for (const key7 in data23) {
																										if (
																											!(
																												key7 ===
																													'vfsPath' ||
																												key7 ===
																													'type' ||
																												key7 ===
																													'sourcePath'
																											)
																										) {
																											validate11.errors =
																												[
																													{
																														instancePath:
																															instancePath +
																															'/extraFiles/nodes/' +
																															i2,
																														schemaPath:
																															'#/definitions/PHPExtensionManifestExtraFiles/properties/nodes/items/additionalProperties',
																														keyword:
																															'additionalProperties',
																														params: {
																															additionalProperty:
																																key7,
																														},
																														message:
																															'must NOT have additional properties',
																													},
																												];
																											return false;
																											break;
																										}
																									}
																									if (
																										_errs57 ===
																										errors
																									) {
																										if (
																											data23.vfsPath !==
																											undefined
																										) {
																											const _errs58 =
																												errors;
																											if (
																												typeof data23.vfsPath !==
																												'string'
																											) {
																												validate11.errors =
																													[
																														{
																															instancePath:
																																instancePath +
																																'/extraFiles/nodes/' +
																																i2 +
																																'/vfsPath',
																															schemaPath:
																																'#/definitions/PHPExtensionManifestExtraFiles/properties/nodes/items/properties/vfsPath/type',
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
																											var valid12 =
																												_errs58 ===
																												errors;
																										} else {
																											var valid12 = true;
																										}
																										if (
																											valid12
																										) {
																											if (
																												data23.type !==
																												undefined
																											) {
																												let data25 =
																													data23.type;
																												const _errs60 =
																													errors;
																												if (
																													typeof data25 !==
																													'string'
																												) {
																													validate11.errors =
																														[
																															{
																																instancePath:
																																	instancePath +
																																	'/extraFiles/nodes/' +
																																	i2 +
																																	'/type',
																																schemaPath:
																																	'#/definitions/PHPExtensionManifestExtraFiles/properties/nodes/items/properties/type/type',
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
																														data25 ===
																															'file' ||
																														data25 ===
																															'directory'
																													)
																												) {
																													validate11.errors =
																														[
																															{
																																instancePath:
																																	instancePath +
																																	'/extraFiles/nodes/' +
																																	i2 +
																																	'/type',
																																schemaPath:
																																	'#/definitions/PHPExtensionManifestExtraFiles/properties/nodes/items/properties/type/enum',
																																keyword:
																																	'enum',
																																params: {
																																	allowedValues:
																																		schema15
																																			.properties
																																			.nodes
																																			.items
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
																												var valid12 =
																													_errs60 ===
																													errors;
																											} else {
																												var valid12 = true;
																											}
																											if (
																												valid12
																											) {
																												if (
																													data23.sourcePath !==
																													undefined
																												) {
																													const _errs62 =
																														errors;
																													if (
																														typeof data23.sourcePath !==
																														'string'
																													) {
																														validate11.errors =
																															[
																																{
																																	instancePath:
																																		instancePath +
																																		'/extraFiles/nodes/' +
																																		i2 +
																																		'/sourcePath',
																																	schemaPath:
																																		'#/definitions/PHPExtensionManifestExtraFiles/properties/nodes/items/properties/sourcePath/type',
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
																													var valid12 =
																														_errs62 ===
																														errors;
																												} else {
																													var valid12 = true;
																												}
																											}
																										}
																									}
																								}
																							} else {
																								validate11.errors =
																									[
																										{
																											instancePath:
																												instancePath +
																												'/extraFiles/nodes/' +
																												i2,
																											schemaPath:
																												'#/definitions/PHPExtensionManifestExtraFiles/properties/nodes/items/type',
																											keyword:
																												'type',
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
																						var valid11 =
																							_errs55 ===
																							errors;
																						if (
																							!valid11
																						) {
																							break;
																						}
																					}
																				} else {
																					validate11.errors =
																						[
																							{
																								instancePath:
																									instancePath +
																									'/extraFiles/nodes',
																								schemaPath:
																									'#/definitions/PHPExtensionManifestExtraFiles/properties/nodes/type',
																								keyword:
																									'type',
																								params: {
																									type: 'array',
																								},
																								message:
																									'must be array',
																							},
																						];
																					return false;
																				}
																			}
																			var valid10 =
																				_errs53 ===
																				errors;
																		} else {
																			var valid10 = true;
																		}
																	}
																}
															} else {
																validate11.errors =
																	[
																		{
																			instancePath:
																				instancePath +
																				'/extraFiles',
																			schemaPath:
																				'#/definitions/PHPExtensionManifestExtraFiles/type',
																			keyword:
																				'type',
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
														var valid0 =
															_errs47 === errors;
													} else {
														var valid0 = true;
													}
												}
											}
										}
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
