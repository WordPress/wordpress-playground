import {
	CertificateGenerator,
	certificateToPEM,
} from '../packages/php-wasm/web/src/lib/tls/asn_1';

const CAroot = await CertificateGenerator.generateCertificate({
	subject: {
		countryName: 'US',
		organizationName: 'Playground CA',
		commonName: 'playground-CA.com-bun',
	},
	basicConstraints: {
		ca: true,
	},
	// subjectKeyIdentifier: {
	//     keyIdentifier: true,
	// },
});

const SiteCert = await CertificateGenerator.generateCertificate(
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
		// authorityKeyIdentifier: {
		//     keyIdentifier: true,
		// },
		// subjectKeyIdentifier: {
		//     keyIdentifier: true,
		// issuerName: 'playground-CA',
		// },
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

// import forge from 'node-forge';

// // Generate a new RSA key pair for the main certificate
// const mainKeys = forge.pki.rsa.generateKeyPair(2048);

// // Create the main certificate
// const mainCert = forge.pki.createCertificate();

// // Set the main certificate attributes
// mainCert.publicKey = mainKeys.publicKey;
// mainCert.serialNumber = '01';
// mainCert.validity.notBefore = new Date();
// mainCert.validity.notAfter = new Date();
// mainCert.validity.notAfter.setFullYear(mainCert.validity.notBefore.getFullYear() + 1);

// const mainAttrs = [
//   { name: 'commonName', value: 'playground-site-forge' },
//   { name: 'organizationName', value: 'Playground Site Forge' },
//   { shortName: 'C', value: 'US' }
// ];

// mainCert.setSubject(mainAttrs);
// mainCert.setIssuer(mainAttrs);

// // Self-sign the main certificate
// mainCert.sign(mainKeys.privateKey);

// // Generate a new RSA key pair for the derived certificate
// const derivedKeys = forge.pki.rsa.generateKeyPair(2048);

// // Create the derived certificate
// const derivedCert = forge.pki.createCertificate();

// // Set the derived certificate attributes
// derivedCert.publicKey = derivedKeys.publicKey;
// derivedCert.serialNumber = '02';
// derivedCert.validity.notBefore = new Date();
// derivedCert.validity.notAfter = new Date();
// derivedCert.validity.notAfter.setFullYear(derivedCert.validity.notBefore.getFullYear() + 1);

// const derivedAttrs = [
//   { name: 'commonName', value: 'derived-playground-site-forge' },
//   { name: 'organizationName', value: 'Derived Playground Site Forge' },
//   { shortName: 'C', value: 'US' }
// ];

// derivedCert.setSubject(derivedAttrs);
// derivedCert.setIssuer(mainAttrs);  // Set issuer to the main certificate's subject

// // Sign the derived certificate with the main certificate's private key
// derivedCert.sign(mainKeys.privateKey);

// // Convert to PEM format
// const forgeCertPEM = forge.pki.certificateToPem(mainCert);
// const forgePrivateKeyPEM = forge.pki.privateKeyToPem(mainKeys.privateKey);
// const forgeDerivedCertPEM = forge.pki.certificateToPem(derivedCert);
// const forgeDerivedPrivateKeyPEM = forge.pki.privateKeyToPem(derivedKeys.privateKey);

// // Write to files
// writeFileSync('forge_cert.pem', forgeCertPEM);
// writeFileSync('forge_private_key.pem', forgePrivateKeyPEM);
// writeFileSync('forge_derived_cert.pem', forgeDerivedCertPEM);
// writeFileSync('forge_derived_private_key.pem', forgeDerivedPrivateKeyPEM);

// console.log('Node-forge certificates and private keys generated and saved.');
