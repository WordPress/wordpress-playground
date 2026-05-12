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
const schema13 = {
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
												let data4 = data3[i0];
												const _errs10 = errors;
												if (errors === _errs10) {
													if (
														data4 &&
														typeof data4 ==
															'object' &&
														!Array.isArray(data4)
													) {
														let missing1;
														if (
															(data4.phpVersion ===
																undefined &&
																(missing1 =
																	'phpVersion')) ||
															(data4.sourcePath ===
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
															const _errs12 =
																errors;
															for (const key1 in data4) {
																if (
																	!(
																		key1 ===
																			'phpVersion' ||
																		key1 ===
																			'sourcePath' ||
																		key1 ===
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
															if (
																_errs12 ===
																errors
															) {
																if (
																	data4.phpVersion !==
																	undefined
																) {
																	const _errs13 =
																		errors;
																	if (
																		typeof data4.phpVersion !==
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
																	var valid2 =
																		_errs13 ===
																		errors;
																} else {
																	var valid2 = true;
																}
																if (valid2) {
																	if (
																		data4.sourcePath !==
																		undefined
																	) {
																		const _errs15 =
																			errors;
																		if (
																			typeof data4.sourcePath !==
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
																		var valid2 =
																			_errs15 ===
																			errors;
																	} else {
																		var valid2 = true;
																	}
																	if (
																		valid2
																	) {
																		if (
																			data4.extraFiles !==
																			undefined
																		) {
																			let data7 =
																				data4.extraFiles;
																			const _errs17 =
																				errors;
																			const _errs18 =
																				errors;
																			if (
																				errors ===
																				_errs18
																			) {
																				if (
																					data7 &&
																					typeof data7 ==
																						'object' &&
																					!Array.isArray(
																						data7
																					)
																				) {
																					const _errs20 =
																						errors;
																					for (const key2 in data7) {
																						if (
																							!(
																								key2 ===
																									'vfsRoot' ||
																								key2 ===
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
																												key2,
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
																						_errs20 ===
																						errors
																					) {
																						if (
																							data7.vfsRoot !==
																							undefined
																						) {
																							const _errs21 =
																								errors;
																							if (
																								typeof data7.vfsRoot !==
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
																							var valid4 =
																								_errs21 ===
																								errors;
																						} else {
																							var valid4 = true;
																						}
																						if (
																							valid4
																						) {
																							if (
																								data7.nodes !==
																								undefined
																							) {
																								let data9 =
																									data7.nodes;
																								const _errs23 =
																									errors;
																								if (
																									errors ===
																									_errs23
																								) {
																									if (
																										Array.isArray(
																											data9
																										)
																									) {
																										var valid5 = true;
																										const len1 =
																											data9.length;
																										for (
																											let i1 = 0;
																											i1 <
																											len1;
																											i1++
																										) {
																											let data10 =
																												data9[
																													i1
																												];
																											const _errs25 =
																												errors;
																											if (
																												errors ===
																												_errs25
																											) {
																												if (
																													data10 &&
																													typeof data10 ==
																														'object' &&
																													!Array.isArray(
																														data10
																													)
																												) {
																													let missing2;
																													if (
																														data10.vfsPath ===
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
																														const _errs27 =
																															errors;
																														for (const key3 in data10) {
																															if (
																																!(
																																	key3 ===
																																		'vfsPath' ||
																																	key3 ===
																																		'type' ||
																																	key3 ===
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
																															_errs27 ===
																															errors
																														) {
																															if (
																																data10.vfsPath !==
																																undefined
																															) {
																																const _errs28 =
																																	errors;
																																if (
																																	typeof data10.vfsPath !==
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
																																var valid6 =
																																	_errs28 ===
																																	errors;
																															} else {
																																var valid6 = true;
																															}
																															if (
																																valid6
																															) {
																																if (
																																	data10.type !==
																																	undefined
																																) {
																																	let data12 =
																																		data10.type;
																																	const _errs30 =
																																		errors;
																																	if (
																																		typeof data12 !==
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
																																			data12 ===
																																				'file' ||
																																			data12 ===
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
																																							schema13
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
																																	var valid6 =
																																		_errs30 ===
																																		errors;
																																} else {
																																	var valid6 = true;
																																}
																																if (
																																	valid6
																																) {
																																	if (
																																		data10.sourcePath !==
																																		undefined
																																	) {
																																		const _errs32 =
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
																																		var valid6 =
																																			_errs32 ===
																																			errors;
																																	} else {
																																		var valid6 = true;
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
																											var valid5 =
																												_errs25 ===
																												errors;
																											if (
																												!valid5
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
																								var valid4 =
																									_errs23 ===
																									errors;
																							} else {
																								var valid4 = true;
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
																			var valid2 =
																				_errs17 ===
																				errors;
																		} else {
																			var valid2 = true;
																		}
																	}
																}
															}
														}
													} else {
														validate11.errors = [
															{
																instancePath:
																	instancePath +
																	'/artifacts/' +
																	i0,
																schemaPath:
																	'#/properties/artifacts/items/type',
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
										let data14 = data.extraFiles;
										const _errs34 = errors;
										const _errs35 = errors;
										if (errors === _errs35) {
											if (
												data14 &&
												typeof data14 == 'object' &&
												!Array.isArray(data14)
											) {
												const _errs37 = errors;
												for (const key4 in data14) {
													if (
														!(
															key4 ===
																'vfsRoot' ||
															key4 === 'nodes'
														)
													) {
														validate11.errors = [
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
												if (_errs37 === errors) {
													if (
														data14.vfsRoot !==
														undefined
													) {
														const _errs38 = errors;
														if (
															typeof data14.vfsRoot !==
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
														var valid8 =
															_errs38 === errors;
													} else {
														var valid8 = true;
													}
													if (valid8) {
														if (
															data14.nodes !==
															undefined
														) {
															let data16 =
																data14.nodes;
															const _errs40 =
																errors;
															if (
																errors ===
																_errs40
															) {
																if (
																	Array.isArray(
																		data16
																	)
																) {
																	var valid9 = true;
																	const len2 =
																		data16.length;
																	for (
																		let i2 = 0;
																		i2 <
																		len2;
																		i2++
																	) {
																		let data17 =
																			data16[
																				i2
																			];
																		const _errs42 =
																			errors;
																		if (
																			errors ===
																			_errs42
																		) {
																			if (
																				data17 &&
																				typeof data17 ==
																					'object' &&
																				!Array.isArray(
																					data17
																				)
																			) {
																				let missing3;
																				if (
																					data17.vfsPath ===
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
																					const _errs44 =
																						errors;
																					for (const key5 in data17) {
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
																											'/extraFiles/nodes/' +
																											i2,
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
																						_errs44 ===
																						errors
																					) {
																						if (
																							data17.vfsPath !==
																							undefined
																						) {
																							const _errs45 =
																								errors;
																							if (
																								typeof data17.vfsPath !==
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
																							var valid10 =
																								_errs45 ===
																								errors;
																						} else {
																							var valid10 = true;
																						}
																						if (
																							valid10
																						) {
																							if (
																								data17.type !==
																								undefined
																							) {
																								let data19 =
																									data17.type;
																								const _errs47 =
																									errors;
																								if (
																									typeof data19 !==
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
																										data19 ===
																											'file' ||
																										data19 ===
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
																														schema13
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
																								var valid10 =
																									_errs47 ===
																									errors;
																							} else {
																								var valid10 = true;
																							}
																							if (
																								valid10
																							) {
																								if (
																									data17.sourcePath !==
																									undefined
																								) {
																									const _errs49 =
																										errors;
																									if (
																										typeof data17.sourcePath !==
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
																									var valid10 =
																										_errs49 ===
																										errors;
																								} else {
																									var valid10 = true;
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
																		var valid9 =
																			_errs42 ===
																			errors;
																		if (
																			!valid9
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
															var valid8 =
																_errs40 ===
																errors;
														} else {
															var valid8 = true;
														}
													}
												}
											} else {
												validate11.errors = [
													{
														instancePath:
															instancePath +
															'/extraFiles',
														schemaPath:
															'#/definitions/PHPExtensionManifestExtraFiles/type',
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
										var valid0 = _errs34 === errors;
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
