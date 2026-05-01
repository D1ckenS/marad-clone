#!/usr/bin/env node
// Regenerate TS + Dart bindings from packages/proto/*.proto into
// packages/shared-types/src/proto and packages/flutter-shared/lib/proto.
//
// Cross-platform: resolves protoc, protoc-gen-dart, and ts-proto plugins
// from default install locations on Windows + POSIX, with env-var overrides
// (PROTOC, PROTOC_GEN_DART) for CI / non-default setups.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROTO_DIR = join(root, 'packages', 'proto');
const TS_OUT = join(root, 'packages', 'shared-types', 'src', 'proto');
const DART_OUT = join(root, 'packages', 'flutter-shared', 'lib', 'proto');

for (const d of [TS_OUT, DART_OUT]) mkdirSync(d, { recursive: true });

const protoFiles = readdirSync(PROTO_DIR).filter((f) => f.endsWith('.proto'));
if (protoFiles.length === 0) {
  console.log('No .proto files in packages/proto/. Skipping.');
  process.exit(0);
}

const isWin = process.platform === 'win32';
const winGetPkgs = process.env.LOCALAPPDATA
  ? join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Packages')
  : '';

const protoc =
  process.env.PROTOC ??
  (isWin
    ? join(winGetPkgs, 'Google.Protobuf_Microsoft.Winget.Source_8wekyb3d8bbwe', 'bin', 'protoc.exe')
    : 'protoc');

const protocGenDart =
  process.env.PROTOC_GEN_DART ??
  (isWin
    ? join(process.env.LOCALAPPDATA ?? '', 'Pub', 'Cache', 'bin', 'protoc-gen-dart.bat')
    : join(process.env.HOME ?? '', '.pub-cache', 'bin', 'protoc-gen-dart'));

const tsProtoPlugin = join(
  root,
  'node_modules',
  '.bin',
  isWin ? 'protoc-gen-ts_proto.cmd' : 'protoc-gen-ts_proto',
);

if (!existsSync(protoc)) {
  console.error(`protoc not found at: ${protoc}`);
  console.error('Install with: winget install Google.Protobuf  (or set PROTOC env var)');
  process.exit(1);
}
if (!existsSync(protocGenDart)) {
  console.error(`protoc-gen-dart not found at: ${protocGenDart}`);
  console.error('Install with: dart pub global activate protoc_plugin  (or set PROTOC_GEN_DART)');
  process.exit(1);
}

// protoc-gen-dart.bat (Windows pub shim) shells out to `dart`, which must be on PATH.
// Prepend known install dirs so this works in shells that haven't picked up post-install PATH.
const dartBinDir = isWin
  ? join(winGetPkgs, 'Google.DartSDK_Microsoft.Winget.Source_8wekyb3d8bbwe', 'dart-sdk', 'bin')
  : undefined;
const env = { ...process.env };
if (dartBinDir && existsSync(dartBinDir)) {
  env.PATH = `${dartBinDir}${isWin ? ';' : ':'}${env.PATH ?? ''}`;
}

const args = [
  `--proto_path=${PROTO_DIR}`,
  `--plugin=protoc-gen-ts_proto=${tsProtoPlugin}`,
  `--plugin=protoc-gen-dart=${protocGenDart}`,
  `--ts_proto_out=${TS_OUT}`,
  '--ts_proto_opt=esModuleInterop=true,useExactTypes=true,onlyTypes=true,forceLong=string,useOptionals=messages',
  `--dart_out=${DART_OUT}`,
  ...protoFiles,
];

console.log(`Running protoc on ${protoFiles.length} file(s):`);
console.log(`  protoc       ${protoc}`);
console.log(`  ts-proto out ${TS_OUT}`);
console.log(`  dart out     ${DART_OUT}`);

execFileSync(protoc, args, { stdio: 'inherit', cwd: PROTO_DIR, env });
console.log('proto:gen done.');
