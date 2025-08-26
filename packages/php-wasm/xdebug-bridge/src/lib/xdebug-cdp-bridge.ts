import path from 'path';
import { parseStringPromise } from 'xml2js';
import type { DbgpSession } from './dbgp-session';
import type { CDPServer } from './cdp-server';

interface PendingCommand {
	cdpId?: number;
	cdpMethod?: string;
	// Additional fields to help with response if needed
	params?: any;
}

interface BreakpointInfo {
	cdpId: string;
	xdebugId: string | null;
	file: string;
	line: number;
}

interface ObjectHandle {
	type: 'context' | 'property';
	contextId?: number;
	depth: number;
	fullname?: string;
	// Add pagination support
	currentPage?: number;
	totalPages?: number;
	aggregatedProps?: any[];
}

export interface XdebugCDPBridgeConfig {
	knownScriptUrls: string[];
	remoteRoot?: string;
	localRoot?: string;
	getPHPFile(path: string): string | Promise<string>;
}

export class XdebugCDPBridge {
	private dbgp: DbgpSession;
	public cdp: CDPServer;
	private nextTxnId = 1;
	private pendingCommands: Map<string, PendingCommand> = new Map();
	private breakpoints: Map<string, BreakpointInfo> = new Map(); // key: cdp breakpointId
	private scriptIdByUrl: Map<string, string> = new Map();
	private nextScriptId = 1;
	private objectHandles: Map<string, ObjectHandle> = new Map();
	private nextObjectId = 1;
	private callFramesMap: Map<string, number> = new Map(); // callFrameId -> stack depth
	private xdebugConnected = false;
	private xdebugStatus = 'starting';
	private initFileUri: string | null = null;
	private readPHPFile: (path: string) => string | Promise<string>;
	private remoteRoot: string;
	private localRoot: string;

	constructor(
		dbgp: DbgpSession,
		cdp: CDPServer,
		config: XdebugCDPBridgeConfig
	) {
		this.dbgp = dbgp;
		this.cdp = cdp;
		this.readPHPFile = config.getPHPFile;
		this.remoteRoot = config.remoteRoot || '';
		this.localRoot = config.localRoot || '';
		for (const url of config.knownScriptUrls) {
			this.scriptIdByUrl.set(url, this.getOrCreateScriptId(url));
		}
	}

	start() {
		// Xdebug connected
		this.dbgp.on('connected', () => {
			this.xdebugConnected = true;
			this.sendDbgpCommand('stdout', '-c 1'); // copies PHP stdout to IDE
			this.sendDbgpCommand('stderr', '-c 1'); // copies PHP stderr to IDE
		});
		// Xdebug messages
		this.dbgp.on('message', async (xml: string) => {
			try {
				const msgObj = await parseStringPromise(xml, {
					explicitArray: false,
				});
				await this.handleDbgpMessage(msgObj);
			} catch {
				// Parsing error, ignore or log
			}
		});
		// Xdebug closed
		this.dbgp.on('close', () => {
			this.xdebugConnected = false;
			// If DevTools is still connected, inform or close
			this.cdp.sendMessage({
				method: 'Debugger.paused',
				params: { reason: 'terminated', callFrames: [] },
			});
			// Close the DevTools connection
			// Note: Alternatively, could keep it open and allow reconnect
			// But here we assume one session and close the WS.
			// We schedule close after sending terminated event.
			setTimeout(() => {
				// @ts-ignore: access private ws for immediate close
				if (this.cdp['ws']) this.cdp['ws'].close();
			}, 100);
		});

		// DevTools client connected
		this.cdp.on('clientConnected', () => {
			// If Xdebug already connected and paused (starting or break), send script(s) and pause status
			if (this.xdebugConnected) {
				this.sendInitialScripts();

				if (
					this.xdebugStatus === 'starting' ||
					this.xdebugStatus === 'break'
				) {
					// Retrieve stack and send paused event
					const txn = this.sendDbgpCommand(`stack_get`);
					this.pendingCommands.set(txn, {
						/* internal stack get (no cdpId) */
					});
					// We'll handle sending paused event when stack_get response arrives
				} else {
					// If script is running, we might send an initial resumed state or nothing.
					// DevTools by default considers it running if no paused event.
				}
			}
		});
		// DevTools messages (requests)
		this.cdp.on('message', (msg: any) => {
			this.handleCdpMessage(msg);
		});
		// DevTools disconnected
		this.cdp.on('clientDisconnected', () => {
			// If Xdebug still connected, detach from it
			if (this.xdebugConnected) {
				this.sendDbgpCommand(`detach`);
				// After detach, Xdebug will likely close connection
			}
		});
	}

	stop() {
		this.dbgp.close();
		this.cdp.close();
	}

	private sendInitialScripts() {
		// Send scriptParsed for the main file if not already sent
		if (this.initFileUri && !this.scriptIdByUrl.has(this.initFileUri)) {
			const scriptId = this.getOrCreateScriptId(this.initFileUri);
			this.cdp.sendMessage({
				method: 'Debugger.scriptParsed',
				params: {
					scriptId: scriptId,
					url: this.initFileUri,
					startLine: 0,
					startColumn: 0,
					// Assuming unknown end, skip endLine/endColumn
					executionContextId: 1,
				},
			});
		}

		// Send every script we already know about
		for (const [url, scriptId] of this.scriptIdByUrl.entries()) {
			this.cdp.sendMessage({
				method: 'Debugger.scriptParsed',
				params: {
					scriptId,
					url,
					startLine: 0,
					startColumn: 0,
					executionContextId: 1,
				},
			});
		}
	}

	private getOrCreateScriptId(fileUri: string): string {
		let scriptId = this.scriptIdByUrl.get(fileUri);
		if (!scriptId) {
			scriptId = String(this.nextScriptId++);
			this.scriptIdByUrl.set(fileUri, scriptId);
		}
		return scriptId;
	}

	// Utility: escape and quote Xdebug fullname for property_get
	private formatPropertyFullName(fullname: string): string {
		// Escape quotes, backslashes, and nulls
		let needsQuotes = false;
		let result = '';
		for (const ch of fullname) {
			if (ch === '"' || ch === '\\' || ch === '\x00') {
				result += '\\' + ch;
				needsQuotes = true;
			} else if (ch === ' ') {
				result += ch;
				needsQuotes = true;
			} else {
				result += ch;
			}
		}
		if (needsQuotes || fullname.includes("'")) {
			// If contains single quote or spaces or special chars, wrap in double quotes
			result = `"${result}"`;
		}
		return result;
	}

	private sendDbgpCommand(command: string, data?: string): string {
		const txnId = this.nextTxnId++;
		const txnIdStr = txnId.toString();
		let cmdStr = `${command} -i ${txnIdStr}`;
		if (data !== undefined) {
			cmdStr += ` ${data}`;
		}
		this.dbgp.sendCommand(cmdStr);
		return txnIdStr;
	}

	private async handleCdpMessage(message: any) {
		const { id, method, params } = message;
		let result: any = {};
		let sendResponse = true;
		switch (method) {
			case 'Debugger.enable':
			case 'Runtime.enable':
				// Acknowledge enabling of domains
				result = {};
				break;
			case 'Debugger.setBreakpointByUrl': {
				const { url, lineNumber } = params;
				const fileUri = url;
				const line =
					(typeof lineNumber === 'number' ? lineNumber : 0) + 1; // CDP lineNumber is 0-based, Xdebug expects 1-based
				// Generate a new breakpoint ID for DevTools
				const cdpBreakpointId = String(this.breakpoints.size + 1);
				// If Xdebug connected, send breakpoint_set now
				if (this.xdebugConnected) {
					const cmd = `breakpoint_set -t line -f ${this.formatPropertyFullName(
						fileUri
					)} -n ${line}`;
					const txn = this.sendDbgpCommand(cmd);
					this.pendingCommands.set(txn, {
						cdpId: id,
						cdpMethod: method,
						params: {
							breakpointId: cdpBreakpointId,
							fileUri,
							line,
						},
					});
					// We'll send response when we get confirmation from Xdebug
					sendResponse = false;
				} else {
					// Xdebug not yet connected: store breakpoint to set later
					this.breakpoints.set(cdpBreakpointId, {
						cdpId: cdpBreakpointId,
						xdebugId: null,
						file: fileUri,
						line: line,
					});
					result = {
						breakpointId: cdpBreakpointId,
						locations: [
							{
								scriptId: this.getOrCreateScriptId(fileUri),
								lineNumber: line - 1,
								columnNumber: 0,
							},
						],
					};
				}
				break;
			}
			case 'Debugger.removeBreakpoint': {
				const { breakpointId } = params;
				const bpIdStr = String(breakpointId);
				const bp = this.breakpoints.get(bpIdStr);
				if (bp) {
					if (bp.xdebugId && this.xdebugConnected) {
						// Remove from Xdebug if it was set
						const cmd = `breakpoint_remove -d ${bp.xdebugId}`;
						const txn = this.sendDbgpCommand(cmd);
						this.pendingCommands.set(txn, {
							cdpId: id,
							cdpMethod: method,
						});
						sendResponse = false;
					}
					// Remove from our map
					this.breakpoints.delete(bpIdStr);
				}
				result = {};
				break;
			}
			case 'Debugger.resume': {
				if (this.xdebugConnected) {
					// Continue execution
					this.xdebugStatus = 'running';
					this.sendDbgpCommand('run');
				}
				result = {};
				break;
			}
			case 'Debugger.stepOver': {
				if (this.xdebugConnected) {
					this.xdebugStatus = 'running';
					this.sendDbgpCommand('step_over');
				}
				result = {};
				break;
			}
			case 'Debugger.stepInto': {
				if (this.xdebugConnected) {
					this.xdebugStatus = 'running';
					this.sendDbgpCommand('step_into');
				}
				result = {};
				break;
			}
			case 'Debugger.stepOut': {
				if (this.xdebugConnected) {
					this.xdebugStatus = 'running';
					this.sendDbgpCommand('step_out');
				}
				result = {};
				break;
			}
			case 'Debugger.pause': {
				if (this.xdebugConnected) {
					// Attempt to break running script
					this.sendDbgpCommand('break');
				}
				result = {};
				break;
			}
			case 'Runtime.evaluate':
			case 'Debugger.evaluateOnCallFrame': {
				const expression: string = params.expression || '';
				const callFrameId: string | undefined = params.callFrameId;
				// If evaluateOnCallFrame, check if supported frame
				if (method === 'Debugger.evaluateOnCallFrame') {
					if (
						callFrameId === undefined ||
						!this.callFramesMap.has(callFrameId)
					) {
						// Invalid frame
						this.cdp.sendMessage({
							id,
							error: {
								code: -32000,
								message: 'No such call frame',
							},
						});
						return;
					}
					const frameDepth = this.callFramesMap.get(callFrameId)!;
					if (frameDepth !== 0) {
						// Only support evaluation in top frame for simplicity
						this.cdp.sendMessage({
							id,
							error: {
								code: -32000,
								message:
									'Evaluation in this frame not supported',
							},
						});
						return;
					}
				}
				if (this.xdebugConnected) {
					// Xdebug eval expects code in base64
					const code = Buffer.from(expression).toString('base64');
					const txn = this.sendDbgpCommand('eval', `-- ${code}`);
					this.pendingCommands.set(txn, {
						cdpId: id,
						cdpMethod: method,
					});
					sendResponse = false;
				} else {
					// If no Xdebug, return undefined result
					result = {
						result: { type: 'undefined', value: undefined },
					};
				}
				break;
			}
			case 'Runtime.getProperties': {
				const { objectId } = params;
				const handle = this.objectHandles.get(objectId);
				if (handle && this.xdebugConnected) {
					if (handle.type === 'context') {
						const contextId = handle.contextId ?? 0;
						const depth = handle.depth;
						// Get variables in the context with pagination support (32 items per page)
						const cmd = `context_get -d ${depth} -c ${contextId} -p 0 -m 32`;
						const txn = this.sendDbgpCommand(cmd);
						// Initialize pagination state
						const updatedHandle = {
							...handle,
							currentPage: 0,
							aggregatedProps: [],
						};
						this.objectHandles.set(objectId, updatedHandle);
						this.pendingCommands.set(txn, {
							cdpId: id,
							cdpMethod: method,
							params: { objectId: objectId },
						});
						sendResponse = false;
					} else if (handle.type === 'property') {
						const depth = handle.depth;
						const fullname = handle.fullname!;
						const fmtName = this.formatPropertyFullName(fullname);
						// Get property with pagination support (32 items per page)
						const cmd = `property_get -d ${depth} -n ${fmtName} -p 0 -m 32`;
						const txn = this.sendDbgpCommand(cmd);
						// Initialize pagination state
						const updatedHandle = {
							...handle,
							currentPage: 0,
							aggregatedProps: [],
						};
						this.objectHandles.set(objectId, updatedHandle);
						this.pendingCommands.set(txn, {
							cdpId: id,
							cdpMethod: method,
							params: { parentObjectId: objectId },
						});
						sendResponse = false;
					} else {
						// Unknown handle type
						result = { result: [] };
					}
				} else {
					result = { result: [] };
				}
				break;
			}
			case 'Debugger.getScriptSource': {
				const sid = params.scriptId;
				const uri = [...this.scriptIdByUrl.entries()].find(
					([, v]) => v === sid
				)?.[0];
				let scriptSource = '';
				if (uri) {
					scriptSource = await this.readPHPFile(
						this.uriToRemotePath(uri)
					);
				}
				result = { scriptSource };
				break;
			}
			default:
				// Unknown or unimplemented method
				result = {};
				break;
		}
		if (sendResponse) {
			this.cdp.sendMessage({ id, result });
		}
	}

	/* ---------- path mapping ---------- */

	private uriToRemotePath(uri: string) {
		return uri.startsWith('file://') ? uri.slice(7) : uri;
	}

	private remoteToLocal(remote: string) {
		let p = remote;
		if (this.remoteRoot && p.startsWith(this.remoteRoot))
			p = path.join(
				this.localRoot || '',
				p.slice(this.remoteRoot.length)
			);
		if (process.platform === 'win32' && p.startsWith('/')) p = p.slice(1);
		return p;
	}

	private async handleDbgpMessage(msgObj: any) {
		if (msgObj.init) {
			// Xdebug initial handshake
			const initAttr = msgObj.init.$;
			this.initFileUri = initAttr.fileuri || initAttr.fileuri;
			this.xdebugStatus = 'starting';

			const firstBreakTxn = this.sendDbgpCommand('step_into');
			this.pendingCommands.set(firstBreakTxn, {
				/* auto step_into after init */
			});

			// Optionally send scriptParsed for the main file if DevTools already connected
			if (this.cdp['ws']) {
				this.sendInitialScripts();
			}
			return;
		}
		if (msgObj.response) {
			const response = msgObj.response;
			const attrs = response.$;
			const command = attrs.command;
			const transId = attrs.transaction_id;
			const pending = this.pendingCommands.get(transId);
			// If this is a response to a command we sent
			switch (command) {
				case 'breakpoint_set': {
					if (
						pending &&
						pending.cdpId !== undefined &&
						pending.cdpMethod === 'Debugger.setBreakpointByUrl'
					) {
						// Map Xdebug breakpoint id to our cdp breakpoint id
						const xdebugBpId = attrs.id;
						const bpInfo = pending.params;
						if (bpInfo) {
							const {
								breakpointId: cdpBpId,
								fileUri,
								line,
							} = bpInfo;
							// Store mapping
							this.breakpoints.set(cdpBpId, {
								cdpId: cdpBpId,
								xdebugId: xdebugBpId,
								file: fileUri,
								line: line,
							});
							// Prepare CDP response
							const scriptId = this.getOrCreateScriptId(fileUri);
							const result = {
								breakpointId: cdpBpId,
								locations: [
									{
										scriptId: scriptId,
										lineNumber: line - 1,
										columnNumber: 0,
									},
								],
							};
							this.cdp.sendMessage({ id: pending.cdpId, result });
						}
						this.pendingCommands.delete(transId);
					}
					break;
				}
				case 'breakpoint_remove': {
					if (pending && pending.cdpId !== undefined) {
						// No specific result content needed
						this.cdp.sendMessage({ id: pending.cdpId, result: {} });
						this.pendingCommands.delete(transId);
					}
					break;
				}
				case 'run':
				case 'step_into':
				case 'step_over':
				case 'step_out': {
					// These come when execution stops or ends
					const status = attrs.status; // 'break' or 'stopping'
					// const reason = attrs.reason; // 'ok', 'breakpoint', 'exception', etc. // Note: not currently needed
					this.xdebugStatus = status;

					// NEW: send scriptParsed for any newly discovered file
					if (response['xdebug:message']) {
						const fileUri = response['xdebug:message'].$.filename;
						if (fileUri && !this.scriptIdByUrl.has(fileUri)) {
							const scriptId = this.getOrCreateScriptId(fileUri);
							this.cdp.sendMessage({
								method: 'Debugger.scriptParsed',
								params: {
									scriptId,
									url: fileUri,
									startLine: 0,
									startColumn: 0,
									executionContextId: 1,
								},
							});
						}
					}
					if (status === 'break') {
						// Paused at breakpoint or step or exception
						// Get more info: which breakpoint or where
						// Use stack_get to retrieve call stack
						const txn = this.sendDbgpCommand(`stack_get`);
						this.pendingCommands.set(txn, {
							/* internal stack get */
						});
						// If reason indicates exception, we might handle after stack
						this.pendingCommands.delete(transId);
					} else if (status === 'stopping' || status === 'stopped') {
						// Script execution finished or engine detached
						// We can treat as resumed and terminated
						this.cdp.sendMessage({
							method: 'Debugger.resumed',
							params: {},
						});
						// Xdebug might close connection after this, which triggers our close handler
					}
					break;
				}
				case 'eval': {
					if (pending && pending.cdpId !== undefined) {
						// Handle evaluation result
						let resultValue: any;
						if (response.property) {
							// The eval response may have a <property> with result
							const property = response.property;
							const type = property.$.type;
							const encoding = property.$.encoding;
							let valueStr: string | null = null;
							if (
								Object.prototype.hasOwnProperty.call(
									property,
									'_'
								)
							) {
								valueStr = property._;
							} else if (typeof property.$value !== 'undefined') {
								// Some responses might carry value in attribute or differently, but usually in _ or in value tag
								valueStr = property.$value;
							}
							if (encoding === 'base64' && valueStr !== null) {
								try {
									const buf = Buffer.from(valueStr, 'base64');
									valueStr = buf.toString();
								} catch {
									/* ignore decoding errors */
								}
							}
							if (type === 'string') {
								resultValue = {
									type: 'string',
									value: valueStr ?? '',
								};
							} else if (
								type === 'int' ||
								type === 'float' ||
								type === 'bool' ||
								type === 'boolen' ||
								type === 'integer' ||
								type === 'double'
							) {
								// Map basic types
								let parsed: any = valueStr;
								if (
									type.startsWith('int') ||
									type === 'integer'
								) {
									parsed = parseInt(valueStr || '0', 10);
								} else if (
									type === 'float' ||
									type === 'double'
								) {
									parsed = parseFloat(valueStr || '0');
								} else if (type.startsWith('bool')) {
									parsed =
										valueStr === '1' || valueStr === 'true';
								}
								resultValue = { type: 'number', value: parsed };
							} else if (type === 'array' || type === 'object') {
								// Complex object: create a handle for it
								const className =
									property.$.classname ||
									(type === 'array' ? 'Array' : 'Object');
								const objectId = String(this.nextObjectId++);
								const fullname = property.$.fullname || '';
								// Store handle for later property retrieval
								this.objectHandles.set(objectId, {
									type: 'property',
									depth: 0,
									contextId: 0,
									fullname: fullname,
								});
								resultValue = {
									type: 'object',
									objectId: objectId,
									className: className,
									description: className,
								};
							} else if (type === 'null') {
								resultValue = {
									type: 'object',
									subtype: 'null',
									value: null,
								};
							} else {
								// Other types (resource, etc)
								resultValue = {
									type: 'undefined',
									value: undefined,
								};
							}
						} else {
							// No property in response (maybe an error or empty)
							resultValue = {
								type: 'undefined',
								value: undefined,
							};
						}
						const result = { result: resultValue };
						this.cdp.sendMessage({ id: pending.cdpId, result });
						this.pendingCommands.delete(transId);
					}
					break;
				}
				case 'context_get':
				case 'property_get': {
					if (pending && pending.cdpId !== undefined) {
						// Handle variables or object properties retrieval with pagination
						const objectId =
							pending.params?.objectId ||
							pending.params?.parentObjectId;
						const handle = objectId
							? this.objectHandles.get(objectId)
							: null;

						// @TODO: This is hacky. It enables browsing arrays. Without it,
						// the debugger shows $_SERVER as an array with a single property called
						// $_SERVER.
						const responseProps =
							response.property?.property ?? response.property;

						const currentProps: any[] = [];
						if (responseProps) {
							const propertiesArray = Array.isArray(responseProps)
								? responseProps
								: [responseProps];

							for (const prop of propertiesArray) {
								const name =
									prop.$.name || prop.$.fullname || '';
								let type = prop.$.type || 'undefined';
								const hasChildren = prop.$.children === '1';
								const encoding = prop.$.encoding;
								let valueStr: string | null = null;
								if (typeof prop._ !== 'undefined') {
									valueStr = prop._;
								}
								if (
									encoding === 'base64' &&
									valueStr !== null
								) {
									try {
										const buf = Buffer.from(
											valueStr,
											'base64'
										);
										valueStr = buf.toString();
									} catch {
										/* ignore base64 decode errors */
									}
								}
								if (hasChildren) {
									// Object or array
									const className =
										prop.$.classname ||
										(type === 'array' ? 'Array' : 'Object');
									const childObjectId = String(
										this.nextObjectId++
									);
									// Store handle
									const contextId =
										pending.cdpMethod ===
											'Runtime.getProperties' &&
										pending.params?.parentObjectId
											? this.objectHandles.get(
													pending.params
														.parentObjectId
											  )?.contextId || 0
											: 0;
									const depth =
										pending.cdpMethod ===
											'Runtime.getProperties' &&
										pending.params?.parentObjectId
											? this.objectHandles.get(
													pending.params
														.parentObjectId
											  )?.depth || 0
											: 0;
									// Use same depth/context as parent
									this.objectHandles.set(childObjectId, {
										type: 'property',
										depth: depth,
										contextId: contextId,
										fullname: prop.$.fullname || name,
									});

									currentProps.push({
										name: prop.$.key || name,
										value: {
											type: 'object',
											className: className,
											description: className,
											objectId: childObjectId,
										},
										writable: false,
										configurable: false,
										enumerable: true,
									});
								} else {
									// Primitive or null
									let value: any;
									let subtype: string | undefined;
									if (type === 'string') {
										value = valueStr ?? '';
									} else if (
										type === 'int' ||
										type === 'integer'
									) {
										value = parseInt(valueStr || '0', 10);
									} else if (
										type === 'float' ||
										type === 'double'
									) {
										value = parseFloat(valueStr || '0');
									} else if (
										type === 'bool' ||
										type === 'boolean'
									) {
										value =
											valueStr === '1' ||
											valueStr === 'true';
										type = 'boolean';
									} else if (type === 'null') {
										value = null;
										subtype = 'null';
									} else {
										// other types like resource
										value = valueStr;
									}
									const valueObj: any = {
										type:
											type === 'integer'
												? 'number'
												: type,
									};
									if (subtype) valueObj.subtype = subtype;
									valueObj.value = value;
									currentProps.push({
										name: prop.$.key || name,
										value: valueObj,
										writable: false,
										configurable: false,
										enumerable: true,
									});
								}
							}
						}

						// Handle pagination
						if (handle) {
							// Add current page props to aggregated results
							const aggregatedProps = (
								handle.aggregatedProps || []
							).concat(currentProps);

							// Check if there are more pages - if we got exactly 32 items (page size), there might be more
							const pageSize = 32;
							const hasMorePages =
								currentProps.length === pageSize;

							if (hasMorePages) {
								// More pages available, fetch next page
								const nextPage = (handle.currentPage || 0) + 1;
								const updatedHandle = {
									...handle,
									currentPage: nextPage,
									aggregatedProps: aggregatedProps,
								};
								this.objectHandles.set(
									objectId!,
									updatedHandle
								);

								// Send command for next page
								let nextCmd: string;
								if (command === 'context_get') {
									const contextId = handle.contextId ?? 0;
									const depth = handle.depth;
									nextCmd = `context_get -d ${depth} -c ${contextId} -p ${nextPage} -m ${pageSize}`;
								} else {
									// property_get
									const depth = handle.depth;
									const fullname = handle.fullname!;
									const fmtName =
										this.formatPropertyFullName(fullname);
									nextCmd = `property_get -d ${depth} -n ${fmtName} -p ${nextPage} -m ${pageSize}`;
								}

								const txn = this.sendDbgpCommand(nextCmd);
								this.pendingCommands.set(txn, {
									cdpId: pending.cdpId,
									cdpMethod: pending.cdpMethod,
									params: pending.params,
								});
								// Don't send response yet, wait for more pages
								this.pendingCommands.delete(transId);
								return;
							} else {
								// No more pages or last page, send final response
								const result = { result: aggregatedProps };
								this.cdp.sendMessage({
									id: pending.cdpId,
									result,
								});
								this.pendingCommands.delete(transId);
							}
						} else {
							// No handle, send current props
							const result = { result: currentProps };
							this.cdp.sendMessage({ id: pending.cdpId, result });
							this.pendingCommands.delete(transId);
						}
					}
					break;
				}
				case 'stack_get': {
					// Build callFrames for paused state
					if (response.stack) {
						const stackEntries = Array.isArray(response.stack)
							? response.stack
							: [response.stack];
						const callFrames: any[] = [];
						this.callFramesMap.clear();
						// Send scriptParsed for any new files in stack
						for (const frame of stackEntries) {
							const file = frame.$.filename;
							const scriptId = this.getOrCreateScriptId(file);
							if (!this.scriptIdByUrl.has(file)) {
								// Mark it known and send scriptParsed
								this.scriptIdByUrl.set(file, scriptId);
								this.cdp.sendMessage({
									method: 'Debugger.scriptParsed',
									params: {
										scriptId: scriptId,
										url: file,
										startLine: 0,
										startColumn: 0,
										executionContextId: 1,
									},
								});
							}
						}
						// Build callFrames array
						for (const frame of stackEntries) {
							const level = parseInt(frame.$.level, 10);
							const file = frame.$.filename;
							const line = parseInt(frame.$.lineno, 10);
							const functionName =
								frame.$.where && frame.$.where !== '{main}'
									? frame.$.where
									: '(anonymous)';
							const scriptId = this.getOrCreateScriptId(file);
							const callFrameId = `frame:${level}`;
							// Map callFrameId to depth for evaluate
							this.callFramesMap.set(callFrameId, level);
							// Prepare scope chain (local and global)
							const scopes: any[] = [];
							// Local scope
							const localObjectId = String(this.nextObjectId++);
							this.objectHandles.set(localObjectId, {
								type: 'context',
								contextId: 0,
								depth: level,
							});
							scopes.push({
								type: 'local',
								object: {
									objectId: localObjectId,
									className: 'Object',
									description: 'Local',
								},
							});
							// Global scope (superglobals in PHP)
							const globalObjectId = String(this.nextObjectId++);
							this.objectHandles.set(globalObjectId, {
								type: 'context',
								contextId: 1,
								depth: level,
							});
							scopes.push({
								type: 'global',
								object: {
									objectId: globalObjectId,
									className: 'Object',
									description: 'Global',
								},
							});
							// Build callFrame entry
							callFrames.push({
								callFrameId: callFrameId,
								functionName: functionName,
								location: {
									scriptId: scriptId,
									lineNumber: line - 1,
									columnNumber: 0,
								},
								scopeChain: scopes,
								this: {
									type: 'object',
									className: 'Object',
									description: 'Object',
									objectId: globalObjectId,
								},
							});
						}
						// Send paused event to DevTools
						let pauseReason = 'pause';
						// Determine reason from Xdebug if available
						// (Xdebug 'reason' might be in the original run/step response we handled prior)
						// We'll simplify: if any breakpoint matches top frame location, reason = breakpoint
						if (stackEntries.length > 0) {
							const topFrame = stackEntries[0];
							if (topFrame.$.filename && topFrame.$.lineno) {
								const file = topFrame.$.filename;
								const line = parseInt(topFrame.$.lineno, 10);
								for (const bp of this.breakpoints.values()) {
									if (bp.file === file && bp.line === line) {
										pauseReason = 'breakpoint';
										break;
									}
								}
							}
						}
						this.cdp.sendMessage({
							method: 'Debugger.paused',
							params: {
								reason: pauseReason,
								callFrames: callFrames,
								hitBreakpoints:
									pauseReason === 'breakpoint' ? [''] : [],
							},
						});
					}
					// Remove pending stack_get
					this.pendingCommands.delete(transId);
					break;
				}
				default: {
					// Other commands we didn't specifically handle
					if (pending && pending.cdpId !== undefined) {
						this.cdp.sendMessage({ id: pending.cdpId, result: {} });
						this.pendingCommands.delete(transId);
					}
					break;
				}
			}
		} else if (msgObj.stream) {
			const stream = msgObj.stream;
			const kind = stream.$.type; // 'stdout' or 'stderr'
			const enc = stream.$.encoding || 'none';
			let data = typeof stream._ === 'string' ? stream._ : '';
			if (enc === 'base64') data = Buffer.from(data, 'base64').toString();

			this.cdp.sendMessage({
				method: 'Log.entryAdded',
				params: {
					entry: {
						source: 'other',
						level: kind === 'stderr' ? 'error' : 'info',
						text: data,
						timestamp: Date.now(),
						// url: 'file:///' + this.initFileUri,
						// lineNumber: 1,
						// columnNumber: 1,
						stackTrace: { callFrames: [] },
					},
				},
			});
		} else if (msgObj.notify) {
			// Notifications (e.g., breakpoint_resolved, etc.) - not specifically handled here.
		}
	}
}
