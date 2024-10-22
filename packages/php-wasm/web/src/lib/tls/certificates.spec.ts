describe('generateCertificate', () => {
	it('should generate the expected certificates', async () => {
		// TODO
		expect(true).toBe(true);
	});
});

/*
Use this to generate the certificates:

const CAroot = await generateCertificate({
	subject: {
		countryName: 'US',
		organizationName: 'Playground CA',
		commonName: 'playground-CA.com-bun',
	},
	basicConstraints: {
		ca: true,
	},
});

const SiteCert = await generateCertificate(
	{
		subject: {
			commonName: 'playground-site',
			organizationName: 'Playground Site',
			countryName: 'US',
		},
		issuer: {
			countryName: 'US',
			organizationName: 'Playground CA',
			commonName: 'playground-CA.com-bun',
		},
	},
	CAroot.keyPair
);

function uint8ArrayToHexString(arr: Uint8Array) {
	let hexString = '';
	for (let i = 0; i < arr.length; i++) {
		const hex = arr[i].toString(16).padStart(2, '0');
		hexString += hex;
	}
	return hexString;
}

import { writeFileSync } from 'fs';

const caCertPEM = certificateToPEM(CAroot.certificate);
const siteCertPEM = certificateToPEM(SiteCert.certificate);

writeFileSync('ca_cert.crt', caCertPEM);
writeFileSync(
	'ca_key.pem',
	await crypto.subtle.exportKey('pkcs8', CAroot.keyPair.privateKey)
);
writeFileSync('ca_cert_tbs.bin', CAroot.tbsCertificate);
const sha256 = new Uint8Array(
	await crypto.subtle.digest('SHA-256', CAroot.tbsCertificate)
);
writeFileSync('ca_cert_tbs.bin.sha256', new Uint8Array(sha256));
console.log('ca_cert_tbs.bin.sha256', uint8ArrayToHexString(sha256));

writeFileSync('ca_cert.bin', CAroot.certificate);
writeFileSync('site_cert.crt', siteCertPEM);
writeFileSync(
	'site_key.pem',
	await crypto.subtle.exportKey('pkcs8', SiteCert.keyPair.privateKey)
);
*/

/*
Use these to test the generated certificates:

# === BEST COMMAND TO DUMP THE CERT INFO ===
openssl x509 -in ca_cert.crt -text -noout
openssl x509 -in site_cert.crt -text -noout

# === MODULUS HASHES ===
# Both hashes should be the same
openssl x509 -noout -modulus -in ca_cert.crt | openssl sha1
openssl rsa -noout -modulus -in ca_key.pem | openssl sha1

openssl x509 -noout -modulus -in site_cert.crt | openssl sha1
openssl rsa -noout -modulus -in site_key.pem | openssl sha1

# === DEBUG CA CERT ===
# Extract the certificate's TBS (To Be Signed) portion:
openssl asn1parse -in ca_cert.crt -strparse 4 -out ca_cert_tbs.bin.actual -noout
# Dump the contents in a human readable format
openssl asn1parse -in ca_cert_tbs.bin.actual -inform der -i
# Compare the actual TBS data with the expected TBS data – there should be no differences
ksdiff \
    <(openssl asn1parse -in ca_cert_tbs.bin.actual -inform der -i) \
    <(openssl asn1parse -in ca_cert_tbs.bin -inform der -i)
# Compute the SHA256 hash of the TBS data – there should be no differences
openssl dgst -sha256 -binary ca_cert_tbs.bin.actual | tee ca_cert_tbs.sha256.actual | hexdump
cat ca_cert_tbs.bin.sha256 | hexdump

# === Compare the signatures ===
# Extract the raw signatures from created certificate
openssl x509\
     -in ca_cert.crt -text -noout -certopt ca_default -certopt no_validity \
     -certopt no_serial -certopt no_subject -certopt no_extensions \
     -certopt no_signame | grep -v 'Signature' | tr -d '[:space:]:' | tee ca_cert_sig.actual.hex
# Compute the hash signature
cat ca_cert_tbs.sha256.actual | openssl dgst -sha256 -sign ca_key.pem -binary | hexdump
# Compute the TBS certificate signature
cat ca_cert_tbs.bin | openssl dgst -sha256 -sign ca_key.pem -binary | hexdump

# Compare the signatures visually
# Verify the signature using the openssl verify command
openssl verify -CAfile ca_cert.crt site_cert.crt

# === DEBUG KEYS ===
# Verify keys integrity
openssl rsa -in ca_key.pem -check -noout
openssl rsa -in site_key.pem -check -noout

# Confirm the modulus is the same between the key and the certificate
openssl x509 -noout -modulus -in ca_cert.crt | openssl sha1
openssl rsa -noout -modulus -in ca_key.pem | openssl sha1

openssl x509 -noout -modulus -in site_cert.crt | openssl sha1
openssl rsa -noout -modulus -in site_key.pem | openssl sha1

# Perform Encryption with Public Key from certificate and Decryption with Private Key
# 0. create a test file
echo "Hello, World" > test.txt
# 1. get public key from certificate
openssl x509 -in site_cert.crt -noout -pubkey > site_cert.pub.pem
# 2. encrypt with public key
openssl pkeyutl -encrypt -in test.txt -pubin -inkey site_cert.pub.pem -out cipher.txt
# 3. decrypt with private key
openssl pkeyutl -decrypt -inkey site_key.pem -in cipher.txt -out decrypted.txt
cat decrypted.txt

# Perform signature integrity check
openssl dgst -sha256 -sign site_key.pem -out test.sig test.txt
openssl dgst -sha256 -verify site_cert.pub.pem -signature test.sig test.txt
*/
