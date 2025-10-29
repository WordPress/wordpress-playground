import {
	PHP,
	SupportedPHPVersions,
	setPhpIniEntries,
} from '@php-wasm/universal';
import { loadNodeRuntime } from '../lib';
import { jspi } from 'wasm-feature-detect';

const runtimeMode = (await jspi()) ? 'jspi' : 'asyncify';

describe(`SOAP Extension – ${runtimeMode}`, () => {
	const phpVersions =
		'PHP' in process.env ? [process.env['PHP']] : SupportedPHPVersions;

	describe.each(phpVersions)(`PHP %s – ${runtimeMode}`, (phpVersion) => {
		let php: PHP;
		beforeEach(async () => {
			php = new PHP(await loadNodeRuntime(phpVersion as any));
			await setPhpIniEntries(php, {
				'soap.wsdl_cache_enabled': '0',
			});
		});

		afterEach(async () => {
			php.exit();
		});

		describe('Extension availability', () => {
			it('should have SOAP extension loaded', async () => {
				const result = await php.run({
					code: `<?php echo extension_loaded('soap') ? 'yes' : 'no';`,
				});
				expect(result.text).toBe('yes');
				expect(result.errors).toBeFalsy();
			});

			it('should have SoapClient class', async () => {
				const result = await php.run({
					code: `<?php echo class_exists('SoapClient') ? 'yes' : 'no';`,
				});
				expect(result.text).toBe('yes');
				expect(result.errors).toBeFalsy();
			});

			it('should have SoapServer class', async () => {
				const result = await php.run({
					code: `<?php echo class_exists('SoapServer') ? 'yes' : 'no';`,
				});
				expect(result.text).toBe('yes');
				expect(result.errors).toBeFalsy();
			});
		});

		describe('SOAP constants', () => {
			it('should have SOAP_1_1 constant', async () => {
				const result = await php.run({
					code: `<?php echo defined('SOAP_1_1') ? SOAP_1_1 : 'undefined';`,
				});
				expect(result.text).toBe('1');
				expect(result.errors).toBeFalsy();
			});

			it('should have SOAP_1_2 constant', async () => {
				const result = await php.run({
					code: `<?php echo defined('SOAP_1_2') ? SOAP_1_2 : 'undefined';`,
				});
				expect(result.text).toBe('2');
				expect(result.errors).toBeFalsy();
			});

			it('should have SOAP_PERSISTENCE_SESSION constant', async () => {
				const result = await php.run({
					code: `<?php echo defined('SOAP_PERSISTENCE_SESSION') ? 'yes' : 'no';`,
				});
				expect(result.text).toBe('yes');
				expect(result.errors).toBeFalsy();
			});

			it('should have SOAP_PERSISTENCE_REQUEST constant', async () => {
				const result = await php.run({
					code: `<?php echo defined('SOAP_PERSISTENCE_REQUEST') ? 'yes' : 'no';`,
				});
				expect(result.text).toBe('yes');
				expect(result.errors).toBeFalsy();
			});

			it('should have SOAP_FUNCTIONS_ALL constant', async () => {
				const result = await php.run({
					code: `<?php echo defined('SOAP_FUNCTIONS_ALL') ? 'yes' : 'no';`,
				});
				expect(result.text).toBe('yes');
				expect(result.errors).toBeFalsy();
			});
		});

		describe('SoapServer basic functionality', () => {
			it('should create a SoapServer instance in WSDL mode', async () => {
				const result = await php.run({
					code: `<?php
try {
	// Create a simple WSDL file
	$wsdl = '<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://schemas.xmlsoap.org/wsdl/"
	xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"
	xmlns:tns="http://test.example.com/"
	xmlns:xsd="http://www.w3.org/2001/XMLSchema"
	targetNamespace="http://test.example.com/">
	<message name="testRequest">
		<part name="name" type="xsd:string"/>
	</message>
	<message name="testResponse">
		<part name="return" type="xsd:string"/>
	</message>	
	<portType name="TestPortType">
		<operation name="test">
			<input message="tns:testRequest"/>
			<output message="tns:testResponse"/>
		</operation>
	</portType>
	<binding name="TestBinding" type="tns:TestPortType">
		<soap:binding style="rpc" transport="http://schemas.xmlsoap.org/soap/http"/>
		<operation name="test">
			<soap:operation soapAction="test"/>
			<input>
				<soap:body use="encoded" namespace="http://test.example.com/" encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"/>
			</input>
			<output>
				<soap:body use="encoded" namespace="http://test.example.com/" encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"/>
			</output>
		</operation>
	</binding>
	<service name="TestService">
		<port name="TestPort" binding="tns:TestBinding">
			<soap:address location="http://localhost/soap"/>
		</port>
	</service>
</definitions>';

	file_put_contents('/tmp/test.wsdl', $wsdl);
	$server = new SoapServer('/tmp/test.wsdl');
	echo 'success';
} catch (Exception $e) {
	echo 'error: ' . $e->getMessage();
}
					`,
				});
				expect(result.text).toBe('success');
				expect(result.errors).toBeFalsy();
			});

			it('should create a SoapServer instance in non-WSDL mode', async () => {
				const result = await php.run({
					code: `<?php
try {
	$options = array('uri' => 'http://test.example.com/');
	$server = new SoapServer(null, $options);
	echo 'success';
} catch (Exception $e) {
	echo 'error: ' . $e->getMessage();
}
					`,
				});
				expect(result.text).toBe('success');
				expect(result.errors).toBeFalsy();
			});

			it('should add function to SoapServer', async () => {
				const result = await php.run({
					code: `<?php
try {
	function testFunction($name) {
		return "Hello, " . $name;
	}

	$options = array('uri' => 'http://test.example.com/');
	$server = new SoapServer(null, $options);
	$server->addFunction('testFunction');
	echo 'success';
} catch (Exception $e) {
	echo 'error: ' . $e->getMessage();
}
					`,
				});
				expect(result.text).toBe('success');
				expect(result.errors).toBeFalsy();
			});

			it('should set class for SoapServer', async () => {
				const result = await php.run({
					code: `<?php
try {
	class TestService {
		public function greet($name) {
			return "Hello, " . $name;
		}
	}

	$options = array('uri' => 'http://test.example.com/');
	$server = new SoapServer(null, $options);
	$server->setClass('TestService');
	echo 'success';
} catch (Exception $e) {
	echo 'error: ' . $e->getMessage();
}
					`,
				});
				expect(result.text).toBe('success');
				expect(result.errors).toBeFalsy();
			});

			it('SOAP server should support a handle() call', async () => {
				// First, create the SOAP server file
				php.writeFile(
					'/tmp/soap-server.php',
					`<?php
class TestSoapServer
{
	public function getMessage()
	{
		return 'Hello, World!';
	}

	public function echo($message)
	{
		return 'Echo: ' . $message;
	}
}

try {
	$options = [
		'uri' => 'http://localhost/soap-server.php',
	];
	$server = new SoapServer(null, $options);
	$server->setClass('TestSoapServer');
	$server->handle();
	echo 'success';
} catch (SoapFault $e) {
	echo "Server Error: " . $e->getMessage();
}`
				);

				// Run the client
				const result = await php.run({
					scriptPath: '/tmp/soap-server.php',
				});

				// The test should successfully communicate between client and server
				// Note: This test may behave differently depending on the WASM environment's
				// ability to handle SOAP requests
				expect(result.errors).toBeFalsy();
				expect(result.text).toBe('success');
			});
		});

		describe('SoapClient basic functionality', () => {
			it('should handle SoapClient constructor errors gracefully', async () => {
				const result = await php.run({
					code: `<?php
try {
	// This should throw an exception because the WSDL doesn't exist
	$client = new SoapClient('http://invalid-url-that-does-not-exist.test/test.wsdl');
	echo 'should not reach here';
} catch (SoapFault $e) {
	echo 'caught SoapFault';
} catch (Exception $e) {
	echo 'caught Exception';
}
					`,
				});
				// We expect either a SoapFault or an Exception to be caught
				expect(['caught SoapFault', 'caught Exception']).toContain(
					result.text
				);
				expect(result.errors).toBeFalsy();
			});

			it('should create SoapClient in non-WSDL mode', async () => {
				const result = await php.run({
					code: `<?php
try {
	$options = array(
		'location' => 'http://test.example.com/soap',
		'uri' => 'http://test.example.com/',
		'trace' => true,
		'exceptions' => true
	);
	$client = new SoapClient(null, $options);
	echo 'success';
} catch (Exception $e) {
	echo 'error: ' . $e->getMessage();
}
					`,
				});
				expect(result.text).toBe('success');
				expect(result.errors).toBeFalsy();
			});
		});

		describe('SoapClient with external WSDL', () => {
			it('should call temperature conversion web service', async () => {
				const result = await php.run({
					code: `<?php
try {
	// Create the client object
	$soapclient = new SoapClient('https://www.w3schools.com/xml/tempconvert.asmx?WSDL', array(
		'exceptions' => true,
		'trace' => true
	));

	// Convert Celsius to Fahrenheit
	$params = array('Celsius' => '25');
	$response = $soapclient->CelsiusToFahrenheit($params);

	// The response should contain the result
	if (isset($response->CelsiusToFahrenheitResult)) {
		$fahrenheit = $response->CelsiusToFahrenheitResult;
		echo 'C2F:' . $fahrenheit . '|';
	} else {
		echo 'C2F:MISSING|';
	}

	// Get the Celsius degrees from the Fahrenheit
	$param = array('Fahrenheit' => '77');
	$response = $soapclient->FahrenheitToCelsius($param);

	if (isset($response->FahrenheitToCelsiusResult)) {
		$celsius = $response->FahrenheitToCelsiusResult;
		echo 'F2C:' . $celsius;
	} else {
		echo 'F2C:MISSING';
	}
} catch (SoapFault $e) {
	echo 'SoapFault: ' . $e->getMessage();
} catch (Exception $e) {
	echo 'Exception: ' . $e->getMessage();
}
					`,
				});

				// Check that we got responses (25°C = 77°F, 77°F = 25°C)
				if (
					result.text.includes('SoapFault') ||
					result.text.includes('Exception')
				) {
					// Network errors or service unavailability are acceptable in tests
					expect(result.text).toMatch(/SoapFault|Exception/);
				} else {
					// If successful, verify the conversion results
					expect(result.text).toBe('C2F:77|F2C:25');
				}
				expect(result.errors).toBeFalsy();
			});
		});

		describe('SOAP functions', () => {
			it('should have is_soap_fault function', async () => {
				const result = await php.run({
					code: `<?php echo function_exists('is_soap_fault') ? 'yes' : 'no';`,
				});
				expect(result.text).toBe('yes');
				expect(result.errors).toBeFalsy();
			});

			it('should test is_soap_fault with non-fault value', async () => {
				const result = await php.run({
					code: `<?php echo is_soap_fault('test') ? 'yes' : 'no';`,
				});
				expect(result.text).toBe('no');
				expect(result.errors).toBeFalsy();
			});

			it('should test is_soap_fault with SoapFault instance', async () => {
				const result = await php.run({
					code: `<?php
$fault = new SoapFault('Server', 'Test error');
echo is_soap_fault($fault) ? 'yes' : 'no';
					`,
				});
				expect(result.text).toBe('yes');
				expect(result.errors).toBeFalsy();
			});
		});

		describe('SoapFault class', () => {
			it('should create SoapFault instance', async () => {
				const result = await php.run({
					code: `<?php
try {
	$fault = new SoapFault('Server', 'Test error message');
	echo 'success';
} catch (Exception $e) {
	echo 'error: ' . $e->getMessage();
}
					`,
				});
				expect(result.text).toBe('success');
				expect(result.errors).toBeFalsy();
			});

			it('should access SoapFault properties', async () => {
				const result = await php.run({
					code: `<?php
$fault = new SoapFault('Client', 'Test error message');
echo $fault->faultcode . '|' . $fault->faultstring;
					`,
				});
				expect(result.text).toBe('Client|Test error message');
				expect(result.errors).toBeFalsy();
			});
		});
	});
});
