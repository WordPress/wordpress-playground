import {
	DEFAULT_IDE_KEY,
	makeXdebugConfig,
	updatePhpStormWorkspaceConfig,
	updatePhpStormPHPConfig,
	updateVSCodeConfig,
	type PhpStormWorkspaceConfigOptions,
	type PhpStormPHPConfigOptions,
	type VSCodeConfigOptions,
} from '../lib/xdebug-path-mappings';
import { XMLParser } from 'fast-xml-parser';
import * as JSONC from 'jsonc-parser';

/**
 * Helper to compare two XML documents structurally.
 * Normalizes whitespace and compares the parsed structure.
 *
 * This validates that the XML has the same semantic structure,
 * regardless of formatting, attribute order, or whitespace.
 *
 * Uses the same parser options as the source code for consistency.
 */
function expectXMLEquals(actualXML: string, expectedXML: string) {
	const parser = new XMLParser({
		ignoreAttributes: false,
		attributeNamePrefix: '',
		preserveOrder: true, // Match source code
		trimValues: true,
		parseAttributeValue: false,
		parseTagValue: false,
		cdataPropName: '__cdata',
		commentPropName: '__xmlComment',
		allowBooleanAttributes: true,
	});

	let actual: any;
	let expected: any;

	try {
		actual = parser.parse(actualXML, true);
	} catch (error) {
		throw new Error(`Failed to parse actual XML: ${error}`);
	}

	try {
		expected = parser.parse(expectedXML, true);
	} catch (error) {
		throw new Error(`Failed to parse expected XML: ${error}`);
	}

	expect(actual).toEqual(expected);
}

/**
 * Helper to compare two JSON documents structurally.
 * Parses and compares the structures, ignoring formatting differences.
 *
 * Uses JSONC parser to handle comments and trailing commas.
 */
function expectJSONEquals(actualJSON: string, expectedJSON: string) {
	let actual: any;
	let expected: any;

	try {
		// Use JSONC parser to handle comments and trailing commas
		const errors: JSONC.ParseError[] = [];
		actual = JSONC.parse(actualJSON, errors, { allowTrailingComma: true });
		if (errors.length > 0) {
			throw new Error(
				`JSONC parse errors: ${errors.map((e) => e.error).join(', ')}`
			);
		}
	} catch (error) {
		throw new Error(`Failed to parse actual JSON: ${error}`);
	}

	try {
		const errors: JSONC.ParseError[] = [];
		expected = JSONC.parse(expectedJSON, errors, {
			allowTrailingComma: true,
		});
		if (errors.length > 0) {
			throw new Error(
				`JSONC parse errors: ${errors.map((e) => e.error).join(', ')}`
			);
		}
	} catch (error) {
		throw new Error(`Failed to parse expected JSON: ${error}`);
	}

	expect(actual).toEqual(expected);
}

describe('updatePhpStormWorkspaceConfig', () => {
	const defaultOptions: PhpStormWorkspaceConfigOptions = {
		name: 'Test Server',
		host: 'localhost',
		port: 8080,
		projectDir: process.cwd(),
		pathMappings: [
			{
				hostPath: './src',
				vfsPath: '/var/www/html/src',
			},
		],
		ideKey: DEFAULT_IDE_KEY,
	};

	describe('valid configurations', () => {
		it('should add server and run configuration to minimal valid XML', () => {
			const xml =
				'<?xml version="1.0" encoding="UTF-8"?>\n<project version="4">\n</project>';
			const result = updatePhpStormWorkspaceConfig(xml, defaultOptions);

			const expected = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
	<component name="PhpServers">
		<servers>
			<server name="Test Server" host="localhost:8080" use_path_mappings="true">
				<path_mappings>
					<mapping local-root="$PROJECT_DIR$/src" remote-root="/var/www/html/src"/>
				</path_mappings>
			</server>
		</servers>
	</component>
	<component name="RunManager">
		<configuration name="Test Server" type="PhpRemoteDebugRunConfigurationType" factoryName="PHP Remote Debug" filter_connections="FILTER" server_name="Test Server" session_id="${DEFAULT_IDE_KEY}">
			<method v="2"/>
		</configuration>
	</component>
</project>`;

			expectXMLEquals(result, expected);
		});

		it('should handle empty project element', () => {
			const xml =
				'<?xml version="1.0" encoding="UTF-8"?>\n<project version="4"></project>';
			const result = updatePhpStormWorkspaceConfig(xml, defaultOptions);

			const expected = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
	<component name="PhpServers">
		<servers>
			<server name="Test Server" host="localhost:8080" use_path_mappings="true">
				<path_mappings>
					<mapping local-root="$PROJECT_DIR$/src" remote-root="/var/www/html/src"/>
				</path_mappings>
			</server>
		</servers>
	</component>
	<component name="RunManager">
		<configuration name="Test Server" type="PhpRemoteDebugRunConfigurationType" factoryName="PHP Remote Debug" filter_connections="FILTER" server_name="Test Server" session_id="${DEFAULT_IDE_KEY}">
			<method v="2"/>
		</configuration>
	</component>
</project>`;

			expectXMLEquals(result, expected);
		});

		it('should preserve existing components', () => {
			const xml = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
	<component name="OtherComponent">
		<option name="someOption" value="someValue" />
	</component>
</project>`;
			const result = updatePhpStormWorkspaceConfig(xml, defaultOptions);

			const expected = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
	<component name="OtherComponent">
		<option name="someOption" value="someValue" />
	</component>
	<component name="PhpServers">
		<servers>
			<server name="Test Server" host="localhost:8080" use_path_mappings="true">
				<path_mappings>
					<mapping local-root="$PROJECT_DIR$/src" remote-root="/var/www/html/src"/>
				</path_mappings>
			</server>
		</servers>
	</component>
	<component name="RunManager">
		<configuration name="Test Server" type="PhpRemoteDebugRunConfigurationType" factoryName="PHP Remote Debug" filter_connections="FILTER" server_name="Test Server" session_id="${DEFAULT_IDE_KEY}">
			<method v="2"/>
		</configuration>
	</component>
</project>`;

			expectXMLEquals(result, expected);
		});

		it('should not duplicate server if it already exists', () => {
			const xml =
				'<?xml version="1.0" encoding="UTF-8"?>\n<project version="4">\n</project>';
			const result1 = updatePhpStormWorkspaceConfig(xml, defaultOptions);
			const result2 = updatePhpStormWorkspaceConfig(
				result1,
				defaultOptions
			);

			// Count server elements in PhpServers component - should only be 1
			const serverMatches =
				result2.match(/<server[^>]*name="Test Server"/g) || [];
			expect(serverMatches.length).toBe(1);

			// Count configuration elements in RunManager component - should only be 1
			const configMatches =
				result2.match(/<configuration[^>]*name="Test Server"/g) || [];
			expect(configMatches.length).toBe(1);
		});

		it('should handle no path mapping', () => {
			const options: PhpStormWorkspaceConfigOptions = {
				name: 'Test Server',
				host: 'localhost',
				port: 8080,
				projectDir: process.cwd(),
				ideKey: DEFAULT_IDE_KEY,
			};

			const xml =
				'<?xml version="1.0" encoding="UTF-8"?>\n<project version="4">\n</project>';
			const result = updatePhpStormWorkspaceConfig(xml, options);

			const expected = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
	<component name="PhpServers">
		<servers>
			<server name="Test Server" host="localhost:8080" use_path_mappings="true">
			</server>
		</servers>
	</component>
	<component name="RunManager">
		<configuration name="Test Server" type="PhpRemoteDebugRunConfigurationType" factoryName="PHP Remote Debug" filter_connections="FILTER" server_name="Test Server" session_id="${DEFAULT_IDE_KEY}">
			<method v="2"/>
		</configuration>
	</component>
</project>`;

			expectXMLEquals(result, expected);
		});

		it('should handle multiple path mappings', () => {
			const options: PhpStormWorkspaceConfigOptions = {
				...defaultOptions,
				pathMappings: [
					{
						hostPath: './src',
						vfsPath: '/var/www/html/src',
					},
					{
						hostPath: './tests',
						vfsPath: '/var/www/html/tests',
					},
					{
						hostPath: './vendor',
						vfsPath: '/var/www/html/vendor',
					},
				],
			};

			const xml =
				'<?xml version="1.0" encoding="UTF-8"?>\n<project version="4">\n</project>';
			const result = updatePhpStormWorkspaceConfig(xml, options);

			const expected = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
	<component name="PhpServers">
		<servers>
			<server name="Test Server" host="localhost:8080" use_path_mappings="true">
				<path_mappings>
					<mapping local-root="$PROJECT_DIR$/src" remote-root="/var/www/html/src"/>
					<mapping local-root="$PROJECT_DIR$/tests" remote-root="/var/www/html/tests"/>
					<mapping local-root="$PROJECT_DIR$/vendor" remote-root="/var/www/html/vendor"/>
				</path_mappings>
			</server>
		</servers>
	</component>
	<component name="RunManager">
		<configuration name="Test Server" type="PhpRemoteDebugRunConfigurationType" factoryName="PHP Remote Debug" filter_connections="FILTER" server_name="Test Server" session_id="${DEFAULT_IDE_KEY}">
			<method v="2"/>
		</configuration>
	</component>
</project>`;

			expectXMLEquals(result, expected);
		});

		it('should strip leading ./ from hostPath', () => {
			const options: PhpStormWorkspaceConfigOptions = {
				...defaultOptions,
				pathMappings: [
					{
						hostPath: './foo/bar',
						vfsPath: '/var/www/html/foo/bar',
					},
					{
						hostPath: 'baz/qux',
						vfsPath: '/var/www/html/baz/qux',
					},
				],
			};

			const xml =
				'<?xml version="1.0" encoding="UTF-8"?>\n<project version="4">\n</project>';
			const result = updatePhpStormWorkspaceConfig(xml, options);

			const expected = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
	<component name="PhpServers">
		<servers>
			<server name="Test Server" host="localhost:8080" use_path_mappings="true">
				<path_mappings>
					<mapping local-root="$PROJECT_DIR$/foo/bar" remote-root="/var/www/html/foo/bar"/>
					<mapping local-root="$PROJECT_DIR$/baz/qux" remote-root="/var/www/html/baz/qux"/>
				</path_mappings>
			</server>
		</servers>
	</component>
	<component name="RunManager">
		<configuration name="Test Server" type="PhpRemoteDebugRunConfigurationType" factoryName="PHP Remote Debug" filter_connections="FILTER" server_name="Test Server" session_id="${DEFAULT_IDE_KEY}">
			<method v="2"/>
		</configuration>
	</component>
</project>`;

			expectXMLEquals(result, expected);
		});

		it('should make absolute hostPath relative to project directory', () => {
			const options: PhpStormWorkspaceConfigOptions = {
				...defaultOptions,
				pathMappings: [
					{
						hostPath: `${defaultOptions.projectDir}/foo/bar`,
						vfsPath: '/var/www/html/foo/bar',
					},
					{
						hostPath: `${defaultOptions.projectDir}/baz/qux`,
						vfsPath: '/var/www/html/baz/qux',
					},
				],
			};

			const xml =
				'<?xml version="1.0" encoding="UTF-8"?>\n<project version="4">\n</project>';
			const result = updatePhpStormWorkspaceConfig(xml, options);

			const expected = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
	<component name="PhpServers">
		<servers>
			<server name="Test Server" host="localhost:8080" use_path_mappings="true">
				<path_mappings>
					<mapping local-root="$PROJECT_DIR$/foo/bar" remote-root="/var/www/html/foo/bar"/>
					<mapping local-root="$PROJECT_DIR$/baz/qux" remote-root="/var/www/html/baz/qux"/>
				</path_mappings>
			</server>
		</servers>
	</component>
	<component name="RunManager">
		<configuration name="Test Server" type="PhpRemoteDebugRunConfigurationType" factoryName="PHP Remote Debug" filter_connections="FILTER" server_name="Test Server" session_id="${DEFAULT_IDE_KEY}">
			<method v="2"/>
		</configuration>
	</component>
</project>`;

			expectXMLEquals(result, expected);
		});

		it('should handle existing PhpServers component', () => {
			const xml = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
	<component name="PhpServers">
		<servers></servers>
	</component>
</project>`;
			const result = updatePhpStormWorkspaceConfig(xml, defaultOptions);

			const expected = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
	<component name="PhpServers">
		<servers>
			<server name="Test Server" host="localhost:8080" use_path_mappings="true">
				<path_mappings>
					<mapping local-root="$PROJECT_DIR$/src" remote-root="/var/www/html/src"/>
				</path_mappings>
			</server>
		</servers>
	</component>
	<component name="RunManager">
		<configuration name="Test Server" type="PhpRemoteDebugRunConfigurationType" factoryName="PHP Remote Debug" filter_connections="FILTER" server_name="Test Server" session_id="${DEFAULT_IDE_KEY}">
			<method v="2"/>
		</configuration>
	</component>
</project>`;

			expectXMLEquals(result, expected);
		});

		it('should handle existing RunManager component', () => {
			const xml = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
	<component name="RunManager">
		<configuration name="Other Config" type="PHPUnitRunConfigurationType" />
	</component>
</project>`;
			const result = updatePhpStormWorkspaceConfig(xml, defaultOptions);

			const expected = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
	<component name="RunManager">
		<configuration name="Other Config" type="PHPUnitRunConfigurationType" />
		<configuration name="Test Server" type="PhpRemoteDebugRunConfigurationType" factoryName="PHP Remote Debug" filter_connections="FILTER" server_name="Test Server" session_id="${DEFAULT_IDE_KEY}">
			<method v="2"/>
		</configuration>
	</component>
	<component name="PhpServers">
		<servers>
			<server name="Test Server" host="localhost:8080" use_path_mappings="true">
				<path_mappings>
					<mapping local-root="$PROJECT_DIR$/src" remote-root="/var/www/html/src"/>
				</path_mappings>
			</server>
		</servers>
	</component>
</project>`;

			expectXMLEquals(result, expected);
		});

		it('should use custom IDE key', () => {
			const options: PhpStormWorkspaceConfigOptions = {
				...defaultOptions,
				ideKey: 'CUSTOM_KEY',
			};

			const xml =
				'<?xml version="1.0" encoding="UTF-8"?>\n<project version="4">\n</project>';
			const result = updatePhpStormWorkspaceConfig(xml, options);

			const expected = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
	<component name="PhpServers">
		<servers>
			<server name="Test Server" host="localhost:8080" use_path_mappings="true">
				<path_mappings>
					<mapping local-root="$PROJECT_DIR$/src" remote-root="/var/www/html/src"/>
				</path_mappings>
			</server>
		</servers>
	</component>
	<component name="RunManager">
		<configuration name="Test Server" type="PhpRemoteDebugRunConfigurationType" factoryName="PHP Remote Debug" filter_connections="FILTER" server_name="Test Server" session_id="CUSTOM_KEY">
			<method v="2"/>
		</configuration>
	</component>
</project>`;

			expectXMLEquals(result, expected);
		});

		it('should handle complex host and port combinations', () => {
			const options: PhpStormWorkspaceConfigOptions = {
				...defaultOptions,
				host: '192.168.1.100',
				port: 3000,
			};

			const xml =
				'<?xml version="1.0" encoding="UTF-8"?>\n<project version="4">\n</project>';
			const result = updatePhpStormWorkspaceConfig(xml, options);

			const expected = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
	<component name="PhpServers">
		<servers>
			<server name="Test Server" host="192.168.1.100:3000" use_path_mappings="true">
				<path_mappings>
					<mapping local-root="$PROJECT_DIR$/src" remote-root="/var/www/html/src"/>
				</path_mappings>
			</server>
		</servers>
	</component>
	<component name="RunManager">
		<configuration name="Test Server" type="PhpRemoteDebugRunConfigurationType" factoryName="PHP Remote Debug" filter_connections="FILTER" server_name="Test Server" session_id="${DEFAULT_IDE_KEY}">
			<method v="2"/>
		</configuration>
	</component>
</project>`;

			expectXMLEquals(result, expected);
		});
	});

	describe('error handling', () => {
		it('should throw error for invalid XML', () => {
			const invalidXml = 'not valid xml';

			expect(() => {
				updatePhpStormWorkspaceConfig(invalidXml, defaultOptions);
			}).toThrow('PhpStorm configuration file is not valid XML.');
		});

		it('should throw error for malformed XML', () => {
			const malformedXml = '<?xml version="1.0"?><project><unclosed>';

			expect(() => {
				updatePhpStormWorkspaceConfig(malformedXml, defaultOptions);
			}).toThrow('PhpStorm configuration file is not valid XML.');
		});

		it('should throw error for project element without version', () => {
			const xml =
				'<?xml version="1.0" encoding="UTF-8"?>\n<project>\n</project>';

			expect(() => {
				updatePhpStormWorkspaceConfig(xml, defaultOptions);
			}).toThrow(
				'PhpStorm IDE integration only supports <project version="4"> in workspace.xml, ' +
					'but the <project> configuration has no version number.'
			);
		});

		it('should throw error for unsupported project version', () => {
			const xml =
				'<?xml version="1.0" encoding="UTF-8"?>\n<project version="5">\n</project>';

			expect(() => {
				updatePhpStormWorkspaceConfig(xml, defaultOptions);
			}).toThrow(
				'PhpStorm IDE integration only supports <project version="4"> in workspace.xml, ' +
					'but we found a <project> configuration with version "5".'
			);
		});

		it('should handle empty mappings array', () => {
			const options: PhpStormWorkspaceConfigOptions = {
				...defaultOptions,
				pathMappings: [],
			};

			const xml =
				'<?xml version="1.0" encoding="UTF-8"?>\n<project version="4">\n</project>';
			const result = updatePhpStormWorkspaceConfig(xml, options);

			const expected = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
	<component name="PhpServers">
		<servers>
			<server name="Test Server" host="localhost:8080" use_path_mappings="true">
			</server>
		</servers>
	</component>
	<component name="RunManager">
		<configuration name="Test Server" type="PhpRemoteDebugRunConfigurationType" factoryName="PHP Remote Debug" filter_connections="FILTER" server_name="Test Server" session_id="${DEFAULT_IDE_KEY}">
			<method v="2"/>
		</configuration>
	</component>
</project>`;

			expectXMLEquals(result, expected);
		});
	});

	describe('edge cases', () => {
		it('should handle XML with comments', () => {
			const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- This is a comment -->
<project version="4">
	<!-- Another comment -->
</project>`;
			const result = updatePhpStormWorkspaceConfig(xml, defaultOptions);

			const expected = `<?xml version="1.0" encoding="UTF-8"?>
<!-- This is a comment -->
<project version="4">
	<!-- Another comment -->
	<component name="PhpServers">
		<servers>
			<server name="Test Server" host="localhost:8080" use_path_mappings="true">
				<path_mappings>
					<mapping local-root="$PROJECT_DIR$/src" remote-root="/var/www/html/src"/>
				</path_mappings>
			</server>
		</servers>
	</component>
	<component name="RunManager">
		<configuration name="Test Server" type="PhpRemoteDebugRunConfigurationType" factoryName="PHP Remote Debug" filter_connections="FILTER" server_name="Test Server" session_id="${DEFAULT_IDE_KEY}">
			<method v="2"/>
		</configuration>
	</component>
</project>`;

			expectXMLEquals(result, expected);
		});

		it('should handle XML with CDATA sections', () => {
			const xml = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
	<component name="SomeComponent">
		<![CDATA[Some data]]>
	</component>
</project>`;
			const result = updatePhpStormWorkspaceConfig(xml, defaultOptions);

			const expected = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
	<component name="SomeComponent">
		<![CDATA[Some data]]>
	</component>
	<component name="PhpServers">
		<servers>
			<server name="Test Server" host="localhost:8080" use_path_mappings="true">
				<path_mappings>
					<mapping local-root="$PROJECT_DIR$/src" remote-root="/var/www/html/src"/>
				</path_mappings>
			</server>
		</servers>
	</component>
	<component name="RunManager">
		<configuration name="Test Server" type="PhpRemoteDebugRunConfigurationType" factoryName="PHP Remote Debug" filter_connections="FILTER" server_name="Test Server" session_id="${DEFAULT_IDE_KEY}">
			<method v="2"/>
		</configuration>
	</component>
</project>`;

			expectXMLEquals(result, expected);
		});

		it('should handle special characters in server name', () => {
			const options: PhpStormWorkspaceConfigOptions = {
				...defaultOptions,
				name: 'Test & Server "With" Quotes',
			};

			const xml =
				'<?xml version="1.0" encoding="UTF-8"?>\n<project version="4">\n</project>';
			const result = updatePhpStormWorkspaceConfig(xml, options);

			const expected = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
	<component name="PhpServers">
		<servers>
			<server name="Test &amp; Server &quot;With&quot; Quotes" host="localhost:8080" use_path_mappings="true">
				<path_mappings>
					<mapping local-root="$PROJECT_DIR$/src" remote-root="/var/www/html/src"/>
				</path_mappings>
			</server>
		</servers>
	</component>
	<component name="RunManager">
		<configuration name="Test &amp; Server &quot;With&quot; Quotes" type="PhpRemoteDebugRunConfigurationType" factoryName="PHP Remote Debug" filter_connections="FILTER" server_name="Test &amp; Server &quot;With&quot; Quotes" session_id="${DEFAULT_IDE_KEY}">
			<method v="2"/>
		</configuration>
	</component>
</project>`;

			expectXMLEquals(result, expected);
		});

		it('should handle paths with special characters', () => {
			const options: PhpStormWorkspaceConfigOptions = {
				...defaultOptions,
				pathMappings: [
					{
						hostPath: './src/my-special-dir',
						vfsPath: '/var/www/html/my-special-dir',
					},
				],
			};

			const xml =
				'<?xml version="1.0" encoding="UTF-8"?>\n<project version="4">\n</project>';
			const result = updatePhpStormWorkspaceConfig(xml, options);

			const expected = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
	<component name="PhpServers">
		<servers>
			<server name="Test Server" host="localhost:8080" use_path_mappings="true">
				<path_mappings>
					<mapping local-root="$PROJECT_DIR$/src/my-special-dir" remote-root="/var/www/html/my-special-dir"/>
				</path_mappings>
			</server>
		</servers>
	</component>
	<component name="RunManager">
		<configuration name="Test Server" type="PhpRemoteDebugRunConfigurationType" factoryName="PHP Remote Debug" filter_connections="FILTER" server_name="Test Server" session_id="${DEFAULT_IDE_KEY}">
			<method v="2"/>
		</configuration>
	</component>
</project>`;

			expectXMLEquals(result, expected);
		});

		it('should handle deeply nested existing structure', () => {
			const xml = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
	<component name="PhpServers">
		<servers>
			<server name="Existing Server" host="example.com" use_path_mappings="true">
				<path_mappings>
					<mapping local-root="$PROJECT_DIR$/existing" remote-root="/existing" />
				</path_mappings>
			</server>
		</servers>
	</component>
</project>`;
			const result = updatePhpStormWorkspaceConfig(xml, defaultOptions);

			const expected = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
	<component name="PhpServers">
		<servers>
			<server name="Existing Server" host="example.com" use_path_mappings="true">
				<path_mappings>
					<mapping local-root="$PROJECT_DIR$/existing" remote-root="/existing" />
				</path_mappings>
			</server>
			<server name="Test Server" host="localhost:8080" use_path_mappings="true">
				<path_mappings>
					<mapping local-root="$PROJECT_DIR$/src" remote-root="/var/www/html/src"/>
				</path_mappings>
			</server>
		</servers>
	</component>
	<component name="RunManager">
		<configuration name="Test Server" type="PhpRemoteDebugRunConfigurationType" factoryName="PHP Remote Debug" filter_connections="FILTER" server_name="Test Server" session_id="${DEFAULT_IDE_KEY}">
			<method v="2"/>
		</configuration>
	</component>
</project>`;

			expectXMLEquals(result, expected);
		});

		it('should handle project element with additional attributes', () => {
			const xml = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4" foo="bar" baz="qux">
	<component name="ExistingComponent" />
</project>`;
			const result = updatePhpStormWorkspaceConfig(xml, defaultOptions);

			const expected = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4" foo="bar" baz="qux">
	<component name="ExistingComponent" />
	<component name="PhpServers">
		<servers>
			<server name="Test Server" host="localhost:8080" use_path_mappings="true">
				<path_mappings>
					<mapping local-root="$PROJECT_DIR$/src" remote-root="/var/www/html/src"/>
				</path_mappings>
			</server>
		</servers>
	</component>
	<component name="RunManager">
		<configuration name="Test Server" type="PhpRemoteDebugRunConfigurationType" factoryName="PHP Remote Debug" filter_connections="FILTER" server_name="Test Server" session_id="${DEFAULT_IDE_KEY}">
			<method v="2"/>
		</configuration>
	</component>
</project>`;

			expectXMLEquals(result, expected);
		});
	});
});

describe('updatePhpStormPHPConfig', () => {
	const defaultOptions: PhpStormPHPConfigOptions = {
		pathSkippings: ['/dev/', '/home/', '/internal/'],
	};

	describe('valid configurations', () => {
		it('should add skipped files to minimal valid XML', () => {
			const xml =
				'<?xml version="1.0" encoding="UTF-8"?>\n<project version="4">\n</project>';
			const result = updatePhpStormPHPConfig(xml, defaultOptions);

			const expected = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
	<component name="PhpStepFilterConfiguration">
		<skipped_files>
			<skipped_file file="$PROJECT_DIR$/dev"/>
			<skipped_file file="$PROJECT_DIR$/home"/>
			<skipped_file file="$PROJECT_DIR$/internal"/>
		</skipped_files>
	</component>
</project>`;

			expectXMLEquals(result, expected);
		});

		it('should handle empty project element', () => {
			const xml =
				'<?xml version="1.0" encoding="UTF-8"?>\n<project version="4"></project>';
			const result = updatePhpStormPHPConfig(xml, defaultOptions);

			const expected = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
	<component name="PhpStepFilterConfiguration">
		<skipped_files>
			<skipped_file file="$PROJECT_DIR$/dev"/>
			<skipped_file file="$PROJECT_DIR$/home"/>
			<skipped_file file="$PROJECT_DIR$/internal"/>
		</skipped_files>
	</component>
</project>`;

			expectXMLEquals(result, expected);
		});

		it('should preserve existing components', () => {
			const xml = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
	<component name="PhpInterpreters">
		<interpreters/>
	</component>
</project>`;
			const result = updatePhpStormPHPConfig(xml, defaultOptions);

			const expected = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
	<component name="PhpInterpreters">
		<interpreters/>
	</component>
	<component name="PhpStepFilterConfiguration">
		<skipped_files>
			<skipped_file file="$PROJECT_DIR$/dev"/>
			<skipped_file file="$PROJECT_DIR$/home"/>
			<skipped_file file="$PROJECT_DIR$/internal"/>
		</skipped_files>
	</component>
</project>`;

			expectXMLEquals(result, expected);
		});

		it('should not duplicate existing skipped files', () => {
			const xml = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
	<component name="PhpStepFilterConfiguration">
		<skipped_files>
			<skipped_file file="$PROJECT_DIR$/dev"/>
		</skipped_files>
	</component>
</project>`;
			const result = updatePhpStormPHPConfig(xml, defaultOptions);

			const expected = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
	<component name="PhpStepFilterConfiguration">
		<skipped_files>
			<skipped_file file="$PROJECT_DIR$/dev"/>
			<skipped_file file="$PROJECT_DIR$/home"/>
			<skipped_file file="$PROJECT_DIR$/internal"/>
		</skipped_files>
	</component>
</project>`;

			expectXMLEquals(result, expected);
		});

		it('should strip trailing slash from directory paths', () => {
			const xml =
				'<?xml version="1.0" encoding="UTF-8"?>\n<project version="4">\n</project>';
			const result = updatePhpStormPHPConfig(xml, {
				pathSkippings: ['/dev/', '/foo.php'],
			});

			const expected = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
	<component name="PhpStepFilterConfiguration">
		<skipped_files>
			<skipped_file file="$PROJECT_DIR$/dev"/>
			<skipped_file file="$PROJECT_DIR$/foo.php"/>
		</skipped_files>
	</component>
</project>`;

			expectXMLEquals(result, expected);
		});

		it('should handle empty pathSkippings', () => {
			const xml =
				'<?xml version="1.0" encoding="UTF-8"?>\n<project version="4">\n</project>';
			const result = updatePhpStormPHPConfig(xml, {
				pathSkippings: [],
			});

			const expected = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
	<component name="PhpStepFilterConfiguration">
		<skipped_files/>
	</component>
</project>`;

			expectXMLEquals(result, expected);
		});

		it('should handle undefined pathSkippings', () => {
			const xml =
				'<?xml version="1.0" encoding="UTF-8"?>\n<project version="4">\n</project>';
			const result = updatePhpStormPHPConfig(xml, {});

			const expected = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
	<component name="PhpStepFilterConfiguration">
		<skipped_files/>
	</component>
</project>`;

			expectXMLEquals(result, expected);
		});
	});

	describe('error handling', () => {
		it('should throw for invalid XML', () => {
			expect(() =>
				updatePhpStormPHPConfig('not xml', defaultOptions)
			).toThrow('PhpStorm PHP configuration file is not valid XML.');
		});

		it('should throw for project with wrong version', () => {
			const xml =
				'<?xml version="1.0" encoding="UTF-8"?>\n<project version="3">\n</project>';
			expect(() => updatePhpStormPHPConfig(xml, defaultOptions)).toThrow(
				'version "3"'
			);
		});

		it('should throw for project with no version', () => {
			const xml =
				'<?xml version="1.0" encoding="UTF-8"?>\n<project>\n</project>';
			expect(() => updatePhpStormPHPConfig(xml, defaultOptions)).toThrow(
				'no version number'
			);
		});
	});
});

describe('updateVSCodeConfig', () => {
	const defaultOptions: VSCodeConfigOptions = {
		name: 'Test Configuration',
		workspaceDir: process.cwd(),
		pathMappings: [
			{
				hostPath: './src',
				vfsPath: '/var/www/html/src',
			},
		],
	};

	describe('valid configurations', () => {
		it('should add configuration to minimal valid JSON', () => {
			const json = '{\n    "configurations": []\n}';
			const result = updateVSCodeConfig(json, defaultOptions);

			const expected = `{
	"configurations": [
		{
			"name": "Test Configuration",
			"type": "php",
			"request": "launch",
			"port": 9003,
			"pathMappings": {
				"/var/www/html/src": "\${workspaceFolder}/src"
			}
		}
	]
}`;

			expectJSONEquals(result, expected);
		});

		it('should create configurations array if missing', () => {
			const json = '{}';
			const result = updateVSCodeConfig(json, defaultOptions);

			const expected = `{
	"configurations": [
		{
			"name": "Test Configuration",
			"type": "php",
			"request": "launch",
			"port": 9003,
			"pathMappings": {
				"/var/www/html/src": "\${workspaceFolder}/src"
			}
		}
	]
}`;

			expectJSONEquals(result, expected);
		});

		it('should handle empty JSON object', () => {
			const json = '{\n}';
			const result = updateVSCodeConfig(json, defaultOptions);

			const expected = `{
	"configurations": [
		{
			"name": "Test Configuration",
			"type": "php",
			"request": "launch",
			"port": 9003,
			"pathMappings": {
				"/var/www/html/src": "\${workspaceFolder}/src"
			}
		}
	]
}`;

			expectJSONEquals(result, expected);
		});

		it('should preserve existing configurations', () => {
			const json = `{
	"configurations": [
		{
			"name": "Existing Config",
			"type": "php",
			"request": "launch",
			"port": 9000
		}
	]
}`;
			const result = updateVSCodeConfig(json, defaultOptions);

			const expected = `{
	"configurations": [
		{
			"name": "Existing Config",
			"type": "php",
			"request": "launch",
			"port": 9000
		},
		{
			"name": "Test Configuration",
			"type": "php",
			"request": "launch",
			"port": 9003,
			"pathMappings": {
				"/var/www/html/src": "\${workspaceFolder}/src"
			}
		}
	]
}`;

			expectJSONEquals(result, expected);
		});

		it('should not duplicate configuration if it already exists', () => {
			const json = '{\n    "configurations": []\n}';
			const result1 = updateVSCodeConfig(json, defaultOptions);
			const result2 = updateVSCodeConfig(result1, defaultOptions);

			// Count occurrences of the configuration name
			const matches = result2.match(/"name": "Test Configuration"/g);
			expect(matches?.length).toBe(1);
		});

		it('should handle no path mapping', () => {
			const options: VSCodeConfigOptions = {
				name: 'Test Configuration',
				workspaceDir: process.cwd(),
			};

			const json = '{\n    "configurations": []\n}';
			const result = updateVSCodeConfig(json, options);

			const expected = `{
	"configurations": [
		{
			"name": "Test Configuration",
			"type": "php",
			"request": "launch",
			"port": 9003,
		}
	]
}`;

			expectJSONEquals(result, expected);
		});

		it('should handle multiple path mappings', () => {
			const options: VSCodeConfigOptions = {
				...defaultOptions,
				pathMappings: [
					{
						hostPath: './src',
						vfsPath: '/var/www/html/src',
					},
					{
						hostPath: './tests',
						vfsPath: '/var/www/html/tests',
					},
					{
						hostPath: './vendor',
						vfsPath: '/var/www/html/vendor',
					},
				],
			};

			const json = '{\n    "configurations": []\n}';
			const result = updateVSCodeConfig(json, options);

			const expected = `{
	"configurations": [
		{
			"name": "Test Configuration",
			"type": "php",
			"request": "launch",
			"port": 9003,
			"pathMappings": {
				"/var/www/html/src": "\${workspaceFolder}/src",
				"/var/www/html/tests": "\${workspaceFolder}/tests",
				"/var/www/html/vendor": "\${workspaceFolder}/vendor"
			}
		}
	]
}`;

			expectJSONEquals(result, expected);
		});

		it('should add skipFiles for directory paths', () => {
			const json = '{\n    "configurations": []\n}';
			const result = updateVSCodeConfig(json, {
				name: 'Test',
				workspaceDir: process.cwd(),
				pathSkippings: ['/dev/', '/home/', '/internal/'],
			});

			const expected = `{
		"configurations": [
			{
				"name": "Test",
				"type": "php",
				"request": "launch",
				"port": 9003,
				"skipFiles": [
					"/dev/**",
					"/home/**",
					"/internal/**"
				]
			}
		]
	}`;

			expectJSONEquals(result, expected);
		});

		it('should not append ** to file paths', () => {
			const json = '{\n    "configurations": []\n}';
			const result = updateVSCodeConfig(json, {
				name: 'Test',
				workspaceDir: process.cwd(),
				pathSkippings: ['/dev/', '/foo.php'],
			});

			const expected = `{
		"configurations": [
			{
				"name": "Test",
				"type": "php",
				"request": "launch",
				"port": 9003,
				"skipFiles": [
					"/dev/**",
					"/foo.php"
				]
			}
		]
	}`;

			expectJSONEquals(result, expected);
		});

		it('should include both skipFiles and pathMappings', () => {
			const json = '{\n    "configurations": []\n}';
			const result = updateVSCodeConfig(json, {
				name: 'Test',
				workspaceDir: process.cwd(),
				pathMappings: [
					{ hostPath: './src', vfsPath: '/var/www/html/src' },
				],
				pathSkippings: ['/dev/', '/home/'],
			});

			const expected = `{
		"configurations": [
			{
				"name": "Test",
				"type": "php",
				"request": "launch",
				"port": 9003,
				"pathMappings": {
					"/var/www/html/src": "\${workspaceFolder}/src"
				},
				"skipFiles": [
					"/dev/**",
					"/home/**"
				]
			}
		]
	}`;

			expectJSONEquals(result, expected);
		});

		it('should strip leading ./ from hostPath', () => {
			const options: VSCodeConfigOptions = {
				...defaultOptions,
				pathMappings: [
					{
						hostPath: './foo/bar',
						vfsPath: '/var/www/html/foo/bar',
					},
					{
						hostPath: 'baz/qux',
						vfsPath: '/var/www/html/baz/qux',
					},
				],
			};

			const json = '{\n    "configurations": []\n}';
			const result = updateVSCodeConfig(json, options);

			const expected = `{
	"configurations": [
		{
			"name": "Test Configuration",
			"type": "php",
			"request": "launch",
			"port": 9003,
			"pathMappings": {
				"/var/www/html/foo/bar": "\${workspaceFolder}/foo/bar",
				"/var/www/html/baz/qux": "\${workspaceFolder}/baz/qux"
			}
		}
	]
}`;

			expectJSONEquals(result, expected);
		});

		it('should make absolute hostPath relative to workspace folder', () => {
			const options: VSCodeConfigOptions = {
				...defaultOptions,
				pathMappings: [
					{
						hostPath: `${defaultOptions.workspaceDir}/foo/bar`,
						vfsPath: '/var/www/html/foo/bar',
					},
					{
						hostPath: `${defaultOptions.workspaceDir}/baz/qux`,
						vfsPath: '/var/www/html/baz/qux',
					},
				],
			};

			const json = '{\n    "configurations": []\n}';
			const result = updateVSCodeConfig(json, options);

			const expected = `{
	"configurations": [
		{
			"name": "Test Configuration",
			"type": "php",
			"request": "launch",
			"port": 9003,
			"pathMappings": {
				"/var/www/html/foo/bar": "\${workspaceFolder}/foo/bar",
				"/var/www/html/baz/qux": "\${workspaceFolder}/baz/qux"
			}
		}
	]
}`;

			expectJSONEquals(result, expected);
		});

		it('should handle JSON with comments (JSONC)', () => {
			const json = `{
	// This is a comment
	"configurations": [
		// Another comment
	]
}`;
			const result = updateVSCodeConfig(json, defaultOptions);

			// Comments are not preserved in output, so just check structure
			const expected = `{
	"configurations": [
		{
			"name": "Test Configuration",
			"type": "php",
			"request": "launch",
			"port": 9003,
			"pathMappings": {
				"/var/www/html/src": "\${workspaceFolder}/src"
			}
		}
	]
}`;

			expectJSONEquals(result, expected);
		});

		it('should handle JSON with trailing commas (JSONC)', () => {
			const json = `{
	"configurations": [
		{
			"name": "Existing Config",
			"type": "php",
		},
	],
}`;
			const result = updateVSCodeConfig(json, defaultOptions);

			// Trailing commas are normalized in output
			const expected = `{
	"configurations": [
		{
			"name": "Existing Config",
			"type": "php"
		},
		{
			"name": "Test Configuration",
			"type": "php",
			"request": "launch",
			"port": 9003,
			"pathMappings": {
				"/var/www/html/src": "\${workspaceFolder}/src"
			}
		}
	]
}`;

			expectJSONEquals(result, expected);
		});

		it('should preserve other properties in the JSON', () => {
			const json = `{
	"version": "0.2.0",
	"configurations": [],
	"compounds": []
}`;
			const result = updateVSCodeConfig(json, defaultOptions);

			const expected = `{
	"version": "0.2.0",
	"configurations": [
		{
			"name": "Test Configuration",
			"type": "php",
			"request": "launch",
			"port": 9003,
			"pathMappings": {
				"/var/www/html/src": "\${workspaceFolder}/src"
			}
		}
	],
	"compounds": []
}`;

			expectJSONEquals(result, expected);
		});

		it('should maintain proper JSON formatting', () => {
			const json = '{\n    "configurations": []\n}';
			const result = updateVSCodeConfig(json, defaultOptions);

			const expected = `{
	"configurations": [
		{
			"name": "Test Configuration",
			"type": "php",
			"request": "launch",
			"port": 9003,
			"pathMappings": {
				"/var/www/html/src": "\${workspaceFolder}/src"
			}
		}
	]
}`;

			expectJSONEquals(result, expected);
			// Also verify it's valid JSON
			expect(() => JSON.parse(result)).not.toThrow();
		});
	});

	describe('error handling', () => {
		it('should throw error for invalid JSON', () => {
			const invalidJson = 'not valid json';

			expect(() => {
				updateVSCodeConfig(invalidJson, defaultOptions);
			}).toThrow('VS Code configuration file is not valid JSON.');
		});

		it('should throw error for malformed JSON', () => {
			const malformedJson = '{"configurations": [}';

			expect(() => {
				updateVSCodeConfig(malformedJson, defaultOptions);
			}).toThrow('VS Code configuration file is not valid JSON.');
		});

		it('should throw error for JSON with unclosed brackets', () => {
			const unclosedJson = '{"configurations": [';

			expect(() => {
				updateVSCodeConfig(unclosedJson, defaultOptions);
			}).toThrow('VS Code configuration file is not valid JSON.');
		});

		it('should handle empty mappings array', () => {
			const options: VSCodeConfigOptions = {
				...defaultOptions,
				pathMappings: [],
			};

			const json = '{\n    "configurations": []\n}';
			const result = updateVSCodeConfig(json, options);

			const expected = `{
	"configurations": [
		{
			"name": "Test Configuration",
			"type": "php",
			"request": "launch",
			"port": 9003,
		}
	]
}`;

			expectJSONEquals(result, expected);
		});
	});

	describe('edge cases', () => {
		it('should handle special characters in configuration name', () => {
			const options: VSCodeConfigOptions = {
				...defaultOptions,
				name: 'Test & Configuration "With" Quotes',
			};

			const json = '{\n    "configurations": []\n}';
			const result = updateVSCodeConfig(json, options);

			const expected = `{
	"configurations": [
		{
			"name": "Test & Configuration \\"With\\" Quotes",
			"type": "php",
			"request": "launch",
			"port": 9003,
			"pathMappings": {
				"/var/www/html/src": "\${workspaceFolder}/src"
			}
		}
	]
}`;

			expectJSONEquals(result, expected);
		});

		it('should handle paths with special characters', () => {
			const options: VSCodeConfigOptions = {
				...defaultOptions,
				pathMappings: [
					{
						hostPath: './src/my-special-dir',
						vfsPath: '/var/www/html/my-special-dir',
					},
				],
			};

			const json = '{\n    "configurations": []\n}';
			const result = updateVSCodeConfig(json, options);

			const expected = `{
	"configurations": [
		{
			"name": "Test Configuration",
			"type": "php",
			"request": "launch",
			"port": 9003,
			"pathMappings": {
				"/var/www/html/my-special-dir": "\${workspaceFolder}/src/my-special-dir"
			}
		}
	]
}`;

			expectJSONEquals(result, expected);
		});

		it('should handle deeply nested existing structure', () => {
			const json = `{
	"version": "0.2.0",
	"configurations": [
		{
			"name": "Existing Config",
			"type": "php",
			"request": "launch",
			"port": 9000,
			"pathMappings": {
				"/var/www/html/existing": "\${workspaceFolder}/existing"
			}
		}
	]
}`;
			const result = updateVSCodeConfig(json, defaultOptions);

			const expected = `{
	"version": "0.2.0",
	"configurations": [
		{
			"name": "Existing Config",
			"type": "php",
			"request": "launch",
			"port": 9000,
			"pathMappings": {
				"/var/www/html/existing": "\${workspaceFolder}/existing"
			}
		},
		{
			"name": "Test Configuration",
			"type": "php",
			"request": "launch",
			"port": 9003,
			"pathMappings": {
				"/var/www/html/src": "\${workspaceFolder}/src"
			}
		}
	]
}`;

			expectJSONEquals(result, expected);
		});

		it('should handle configurations as first element in array', () => {
			const json = '{\n    "configurations": []\n}';
			const result = updateVSCodeConfig(json, defaultOptions);

			const expected = `{
	"configurations": [
		{
			"name": "Test Configuration",
			"type": "php",
			"request": "launch",
			"port": 9003,
			"pathMappings": {
				"/var/www/html/src": "\${workspaceFolder}/src"
			}
		}
	]
}`;

			expectJSONEquals(result, expected);
			const parsed = JSON.parse(result);
			expect(parsed.configurations[0].name).toBe('Test Configuration');
		});

		it('should handle whitespace variations', () => {
			const json = '{"configurations":[]}';
			const result = updateVSCodeConfig(json, defaultOptions);

			const expected = `{
	"configurations": [
		{
			"name": "Test Configuration",
			"type": "php",
			"request": "launch",
			"port": 9003,
			"pathMappings": {
				"/var/www/html/src": "\${workspaceFolder}/src"
			}
		}
	]
}`;

			expectJSONEquals(result, expected);
		});

		it('should handle mixed single and double quotes in paths', () => {
			const options: VSCodeConfigOptions = {
				...defaultOptions,
				pathMappings: [
					{
						hostPath: "./src/path-with-'single'-quotes",
						vfsPath: '/var/www/html/path',
					},
				],
			};

			const json = '{\n    "configurations": []\n}';
			const result = updateVSCodeConfig(json, options);

			const expected = `{
	"configurations": [
		{
			"name": "Test Configuration",
			"type": "php",
			"request": "launch",
			"port": 9003,
			"pathMappings": {
				"/var/www/html/path": "\${workspaceFolder}/src/path-with-'single'-quotes"
			}
		}
	]
}`;

			expectJSONEquals(result, expected);
			expect(() => JSON.parse(result)).not.toThrow();
		});

		it('should handle very long configuration names', () => {
			const options: VSCodeConfigOptions = {
				...defaultOptions,
				name: 'A'.repeat(200),
			};

			const json = '{\n    "configurations": []\n}';
			const result = updateVSCodeConfig(json, options);

			const expected = {
				configurations: [
					{
						name: 'A'.repeat(200),
						type: 'php',
						request: 'launch',
						port: 9003,
						pathMappings: {
							'/var/www/html/src': '${workspaceFolder}/src',
						},
					},
				],
			};

			const parsed = JSON.parse(result);
			expect(parsed).toEqual(expected);
		});

		it('should handle Unicode characters in configuration', () => {
			const options: VSCodeConfigOptions = {
				...defaultOptions,
				name: 'Test 🚀 Configuration',
				pathMappings: [
					{
						hostPath: './src',
						vfsPath: '/var/www/html/тест', // Cyrillic characters
					},
				],
			};

			const json = '{\n    "configurations": []\n}';
			const result = updateVSCodeConfig(json, options);

			const expected = `{
	"configurations": [
		{
			"name": "Test 🚀 Configuration",
			"type": "php",
			"request": "launch",
			"port": 9003,
			"pathMappings": {
				"/var/www/html/тест": "\${workspaceFolder}/src"
			}
		}
	]
}`;

			expectJSONEquals(result, expected);
		});
	});
});

describe('makeXdebugConfig', () => {
	it('should return pathMappings from filterLocalMounts when cwd and mounts are provided', () => {
		const cwd = process.cwd();
		const mounts = [{ hostPath: './src', vfsPath: '/var/www/html/src' }];
		const pathSkippings = ['/vendor'];

		const result = makeXdebugConfig({
			cwd,
			mounts,
			pathSkippings,
		});

		expect(result).toEqual({
			pathMappings: mounts,
			pathSkippings,
		});
	});

	it('should only include local mounts in pathMappings', () => {
		const cwd = process.cwd();
		const localMounts = [
			{ hostPath: './src', vfsPath: '/var/www/html/src' },
			{ hostPath: './tests', vfsPath: '/var/www/html/tests' },
		];
		const nonLocalMounts = [
			{ hostPath: '/tmp/other/vendor', vfsPath: '/var/www/html/vendor' },
		];
		const pathSkippings = ['/vendor'];

		const result = makeXdebugConfig({
			cwd,
			mounts: [...localMounts, ...nonLocalMounts],
			pathSkippings,
		});

		expect(result).toEqual({
			pathMappings: localMounts,
			pathSkippings,
		});
	});

	it('should return empty pathMappings when cwd is missing', () => {
		const mounts = [{ hostPath: './src', vfsPath: '/var/www/html/src' }];

		const result = makeXdebugConfig({
			mounts,
			pathSkippings: ['/vendor'],
		});

		expect(result).toEqual({
			pathMappings: undefined,
			pathSkippings: ['/vendor'],
		});
	});
});
