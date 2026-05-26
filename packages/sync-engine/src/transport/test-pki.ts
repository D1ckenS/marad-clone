// Test PKI helper (B1) — generates an in-memory CA + leaf certs for the
// gRPC TLS round-trip tests. Lives next to the test that needs it so the
// production build is unaffected.

import forge from 'node-forge';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export interface TestPki {
  caCertPem: string;
  shoreCertPem: string;
  shoreKeyPem: string;
  vesselCertPem: string;
  vesselKeyPem: string;
}

function buildSignedLeaf(opts: {
  commonName: string;
  isClient?: boolean;
  caCert: forge.pki.Certificate;
  caKey: forge.pki.rsa.PrivateKey;
  sans: string[];
}): { cert: forge.pki.Certificate; key: forge.pki.rsa.PrivateKey } {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = String(Math.floor(Math.random() * 1e9));
  cert.validity.notBefore = new Date(Date.now() - 60_000);
  cert.validity.notAfter = new Date(Date.now() + 24 * 60 * 60 * 1000);
  cert.setSubject([{ name: 'commonName', value: opts.commonName }]);
  cert.setIssuer(opts.caCert.subject.attributes);

  const altNames = opts.sans.map((name) =>
    /^\d+\.\d+\.\d+\.\d+$/.test(name) ? { type: 7, ip: name } : { type: 2, value: name },
  );

  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    {
      name: 'keyUsage',
      digitalSignature: true,
      keyEncipherment: true,
    },
    {
      name: 'extKeyUsage',
      serverAuth: !opts.isClient,
      clientAuth: opts.isClient ?? false,
    },
    { name: 'subjectAltName', altNames },
  ]);

  cert.sign(opts.caKey, forge.md.sha256.create());
  return { cert, key: keys.privateKey };
}

export function generateTestPki(): TestPki {
  // CA
  const caKeys = forge.pki.rsa.generateKeyPair(2048);
  const caCert = forge.pki.createCertificate();
  caCert.publicKey = caKeys.publicKey;
  caCert.serialNumber = '01';
  caCert.validity.notBefore = new Date(Date.now() - 60_000);
  caCert.validity.notAfter = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const caSubject = [{ name: 'commonName', value: 'fleetops-test-ca' }];
  caCert.setSubject(caSubject);
  caCert.setIssuer(caSubject);
  caCert.setExtensions([
    { name: 'basicConstraints', cA: true },
    { name: 'keyUsage', keyCertSign: true, cRLSign: true },
  ]);
  caCert.sign(caKeys.privateKey, forge.md.sha256.create());

  const shore = buildSignedLeaf({
    commonName: 'shore.fleetops.test',
    caCert,
    caKey: caKeys.privateKey,
    sans: ['localhost', '127.0.0.1', 'shore.fleetops.test'],
  });

  const vessel = buildSignedLeaf({
    commonName: 'vessel.fleetops.test',
    isClient: true,
    caCert,
    caKey: caKeys.privateKey,
    sans: ['vessel.fleetops.test'],
  });

  return {
    caCertPem: forge.pki.certificateToPem(caCert),
    shoreCertPem: forge.pki.certificateToPem(shore.cert),
    shoreKeyPem: forge.pki.privateKeyToPem(shore.key),
    vesselCertPem: forge.pki.certificateToPem(vessel.cert),
    vesselKeyPem: forge.pki.privateKeyToPem(vessel.key),
  };
}

export interface TestPkiPaths {
  dir: string;
  caPath: string;
  shoreCertPath: string;
  shoreKeyPath: string;
  vesselCertPath: string;
  vesselKeyPath: string;
  cleanup: () => Promise<void>;
}

export function writeTestPkiToTmp(pki: TestPki): TestPkiPaths {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fleetops-sync-tls-'));
  const caPath = path.join(dir, 'ca.crt');
  const shoreCertPath = path.join(dir, 'shore.crt');
  const shoreKeyPath = path.join(dir, 'shore.key');
  const vesselCertPath = path.join(dir, 'vessel.crt');
  const vesselKeyPath = path.join(dir, 'vessel.key');
  fs.writeFileSync(caPath, pki.caCertPem);
  fs.writeFileSync(shoreCertPath, pki.shoreCertPem);
  fs.writeFileSync(shoreKeyPath, pki.shoreKeyPem);
  fs.writeFileSync(vesselCertPath, pki.vesselCertPem);
  fs.writeFileSync(vesselKeyPath, pki.vesselKeyPem);
  return {
    dir,
    caPath,
    shoreCertPath,
    shoreKeyPath,
    vesselCertPath,
    vesselKeyPath,
    cleanup: async () => {
      await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => undefined);
    },
  };
}
