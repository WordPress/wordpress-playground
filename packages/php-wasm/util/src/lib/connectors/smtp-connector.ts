/**
 * Unified SMTP mock connector.
 *
 * Simulates an SMTP server on ports 25, 587, 465.
 * Works in both browser and Node.js environments.
 */

export interface SmtpConnectorOptions {
	hostname?: string;
	onEmailSent?: (email: SmtpEmail) => void;
	debug?: boolean;
}

export interface SmtpEmail {
	from: string;
	to: string[];
	data: string;
	timestamp: Date;
}

export function createSmtpConnector(options: SmtpConnectorOptions = {}) {
	const hostname = options.hostname || 'playground.internal';
	const debug = options.debug || false;

	return {
		name: 'SMTP Mock',
		matches: [25, 587, 465],
		connect: async (connection: {
			host: string;
			port: number;
			upstream: ReadableStream<Uint8Array>;
			downstream: WritableStream<Uint8Array>;
		}) => {
			const log = debug
				? (msg: string) =>
						console.log(
							`[SMTP ${connection.host}:${connection.port}] ${msg}`
						)
				: () => {};

			log('Connection established');

			const reader = connection.upstream.getReader();
			const writer = connection.downstream.getWriter();
			const encoder = new TextEncoder();
			const decoder = new TextDecoder();

			let buffer = '';
			let state: 'INITIAL' | 'MAIL' | 'RCPT' | 'DATA' = 'INITIAL';
			let emailData: Partial<SmtpEmail> = {
				to: [],
				timestamp: new Date(),
			};

			const send = async (code: number, message: string) => {
				const response = `${code} ${message}\r\n`;
				log(`← ${response.trim()}`);
				await writer.write(encoder.encode(response));
			};

			try {
				await send(220, `${hostname} ESMTP Service Ready`);

				while (true) {
					const { done, value } = await reader.read();
					if (done) {
						log('Connection closed by client');
						break;
					}

					buffer += decoder.decode(value, { stream: true });

					let newlineIndex;
					while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
						const line = buffer.slice(0, newlineIndex).trim();
						buffer = buffer.slice(newlineIndex + 1);

						if (!line) continue;

						log(`→ ${line}`);

						const command = line.split(' ')[0].toUpperCase();
						const args = line.slice(command.length).trim();

						switch (command) {
							case 'EHLO':
							case 'HELO':
								await send(250, `${hostname} Hello ${args}`);
								state = 'INITIAL';
								break;

							case 'MAIL':
								const fromMatch =
									args.match(/FROM:\s*<?([^>]+)>?/i);
								if (fromMatch) {
									emailData.from = fromMatch[1];
									await send(250, 'OK');
									state = 'MAIL';
								} else {
									await send(
										501,
										'Syntax error in parameters'
									);
								}
								break;

							case 'RCPT':
								if (state !== 'MAIL' && state !== 'RCPT') {
									await send(503, 'Bad sequence of commands');
									break;
								}
								const toMatch =
									args.match(/TO:\s*<?([^>]+)>?/i);
								if (toMatch) {
									emailData.to!.push(toMatch[1]);
									await send(250, 'OK');
									state = 'RCPT';
								} else {
									await send(
										501,
										'Syntax error in parameters'
									);
								}
								break;

							case 'DATA':
								if (state !== 'RCPT') {
									await send(503, 'Bad sequence of commands');
									break;
								}
								await send(
									354,
									'Start mail input; end with <CRLF>.<CRLF>'
								);
								state = 'DATA';

								let dataBuffer = '';
								let collecting = true;
								while (collecting) {
									const { done: dataDone, value: dataValue } =
										await reader.read();
									if (dataDone) {
										collecting = false;
										break;
									}

									const chunk = decoder.decode(dataValue, {
										stream: true,
									});
									dataBuffer += chunk;

									const endMarkerIndex =
										dataBuffer.indexOf('\r\n.\r\n');
									if (endMarkerIndex !== -1) {
										emailData.data = dataBuffer.slice(
											0,
											endMarkerIndex
										);
										buffer =
											dataBuffer.slice(
												endMarkerIndex + 5
											) + buffer;
										collecting = false;

										log(
											`Email captured: from=${
												emailData.from
											}, to=${emailData.to!.join(
												','
											)}, size=${
												emailData.data!.length
											} bytes`
										);

										if (options.onEmailSent) {
											options.onEmailSent(
												emailData as SmtpEmail
											);
										}

										await send(
											250,
											'OK: Message accepted for delivery'
										);
										state = 'INITIAL';

										emailData = {
											to: [],
											timestamp: new Date(),
										};
									}
								}
								break;

							case 'RSET':
								emailData = {
									to: [],
									timestamp: new Date(),
								};
								state = 'INITIAL';
								await send(250, 'OK');
								break;

							case 'NOOP':
								await send(250, 'OK');
								break;

							case 'QUIT':
								await send(
									221,
									`${hostname} closing connection`
								);
								await writer.close();
								log('Connection closed gracefully');
								return;

							case 'VRFY':
							case 'EXPN':
								await send(
									252,
									'Cannot VRFY user, but will accept message'
								);
								break;

							case 'HELP':
								await send(214, 'This is a mock SMTP server');
								break;

							default:
								await send(
									500,
									`Command not recognized: ${command}`
								);
								break;
						}
					}
				}
			} catch (error) {
				log(`Error: ${error}`);
			} finally {
				try {
					await writer.close();
				} catch {
					// Already closed
				}
				log('Connection terminated');
			}
		},
	};
}
