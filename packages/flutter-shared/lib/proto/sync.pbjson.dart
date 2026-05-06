// This is a generated file - do not edit.
//
// Generated from sync.proto.

// @dart = 3.3

// ignore_for_file: annotate_overrides, camel_case_types, comment_references
// ignore_for_file: constant_identifier_names
// ignore_for_file: curly_braces_in_flow_control_structures
// ignore_for_file: deprecated_member_use_from_same_package, library_prefixes
// ignore_for_file: non_constant_identifier_names, prefer_relative_imports
// ignore_for_file: unused_import

import 'dart:convert' as $convert;
import 'dart:core' as $core;
import 'dart:typed_data' as $typed_data;

@$core.Deprecated('Use syncOperationDescriptor instead')
const SyncOperation$json = {
  '1': 'SyncOperation',
  '2': [
    {'1': 'SYNC_OPERATION_UNSPECIFIED', '2': 0},
    {'1': 'SYNC_OPERATION_UPSERT', '2': 1},
    {'1': 'SYNC_OPERATION_DELETE', '2': 2},
  ],
};

/// Descriptor for `SyncOperation`. Decode as a `google.protobuf.EnumDescriptorProto`.
final $typed_data.Uint8List syncOperationDescriptor = $convert.base64Decode(
    'Cg1TeW5jT3BlcmF0aW9uEh4KGlNZTkNfT1BFUkFUSU9OX1VOU1BFQ0lGSUVEEAASGQoVU1lOQ1'
    '9PUEVSQVRJT05fVVBTRVJUEAESGQoVU1lOQ19PUEVSQVRJT05fREVMRVRFEAI=');

@$core.Deprecated('Use errorCodeDescriptor instead')
const ErrorCode$json = {
  '1': 'ErrorCode',
  '2': [
    {'1': 'ERROR_CODE_UNSPECIFIED', '2': 0},
    {'1': 'ERROR_CODE_UNAUTHENTICATED', '2': 1},
    {'1': 'ERROR_CODE_TENANT_MISMATCH', '2': 2},
    {'1': 'ERROR_CODE_PROTOCOL', '2': 3},
    {'1': 'ERROR_CODE_INTERNAL', '2': 4},
  ],
};

/// Descriptor for `ErrorCode`. Decode as a `google.protobuf.EnumDescriptorProto`.
final $typed_data.Uint8List errorCodeDescriptor = $convert.base64Decode(
    'CglFcnJvckNvZGUSGgoWRVJST1JfQ09ERV9VTlNQRUNJRklFRBAAEh4KGkVSUk9SX0NPREVfVU'
    '5BVVRIRU5USUNBVEVEEAESHgoaRVJST1JfQ09ERV9URU5BTlRfTUlTTUFUQ0gQAhIXChNFUlJP'
    'Ul9DT0RFX1BST1RPQ09MEAMSFwoTRVJST1JfQ09ERV9JTlRFUk5BTBAE');

@$core.Deprecated('Use clientMessageDescriptor instead')
const ClientMessage$json = {
  '1': 'ClientMessage',
  '2': [
    {
      '1': 'hello',
      '3': 1,
      '4': 1,
      '5': 11,
      '6': '.marad.sync.v1.Hello',
      '9': 0,
      '10': 'hello'
    },
    {
      '1': 'deltas',
      '3': 2,
      '4': 1,
      '5': 11,
      '6': '.marad.sync.v1.DeltaBatch',
      '9': 0,
      '10': 'deltas'
    },
    {
      '1': 'ack',
      '3': 3,
      '4': 1,
      '5': 11,
      '6': '.marad.sync.v1.Ack',
      '9': 0,
      '10': 'ack'
    },
    {
      '1': 'heartbeat',
      '3': 4,
      '4': 1,
      '5': 11,
      '6': '.marad.sync.v1.Heartbeat',
      '9': 0,
      '10': 'heartbeat'
    },
  ],
  '8': [
    {'1': 'payload'},
  ],
};

/// Descriptor for `ClientMessage`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List clientMessageDescriptor = $convert.base64Decode(
    'Cg1DbGllbnRNZXNzYWdlEiwKBWhlbGxvGAEgASgLMhQubWFyYWQuc3luYy52MS5IZWxsb0gAUg'
    'VoZWxsbxIzCgZkZWx0YXMYAiABKAsyGS5tYXJhZC5zeW5jLnYxLkRlbHRhQmF0Y2hIAFIGZGVs'
    'dGFzEiYKA2FjaxgDIAEoCzISLm1hcmFkLnN5bmMudjEuQWNrSABSA2FjaxI4CgloZWFydGJlYX'
    'QYBCABKAsyGC5tYXJhZC5zeW5jLnYxLkhlYXJ0YmVhdEgAUgloZWFydGJlYXRCCQoHcGF5bG9h'
    'ZA==');

@$core.Deprecated('Use serverMessageDescriptor instead')
const ServerMessage$json = {
  '1': 'ServerMessage',
  '2': [
    {
      '1': 'welcome',
      '3': 1,
      '4': 1,
      '5': 11,
      '6': '.marad.sync.v1.Welcome',
      '9': 0,
      '10': 'welcome'
    },
    {
      '1': 'deltas',
      '3': 2,
      '4': 1,
      '5': 11,
      '6': '.marad.sync.v1.DeltaBatch',
      '9': 0,
      '10': 'deltas'
    },
    {
      '1': 'ack',
      '3': 3,
      '4': 1,
      '5': 11,
      '6': '.marad.sync.v1.Ack',
      '9': 0,
      '10': 'ack'
    },
    {
      '1': 'heartbeat',
      '3': 4,
      '4': 1,
      '5': 11,
      '6': '.marad.sync.v1.Heartbeat',
      '9': 0,
      '10': 'heartbeat'
    },
    {
      '1': 'error',
      '3': 5,
      '4': 1,
      '5': 11,
      '6': '.marad.sync.v1.Error',
      '9': 0,
      '10': 'error'
    },
  ],
  '8': [
    {'1': 'payload'},
  ],
};

/// Descriptor for `ServerMessage`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List serverMessageDescriptor = $convert.base64Decode(
    'Cg1TZXJ2ZXJNZXNzYWdlEjIKB3dlbGNvbWUYASABKAsyFi5tYXJhZC5zeW5jLnYxLldlbGNvbW'
    'VIAFIHd2VsY29tZRIzCgZkZWx0YXMYAiABKAsyGS5tYXJhZC5zeW5jLnYxLkRlbHRhQmF0Y2hI'
    'AFIGZGVsdGFzEiYKA2FjaxgDIAEoCzISLm1hcmFkLnN5bmMudjEuQWNrSABSA2FjaxI4CgloZW'
    'FydGJlYXQYBCABKAsyGC5tYXJhZC5zeW5jLnYxLkhlYXJ0YmVhdEgAUgloZWFydGJlYXQSLAoF'
    'ZXJyb3IYBSABKAsyFC5tYXJhZC5zeW5jLnYxLkVycm9ySABSBWVycm9yQgkKB3BheWxvYWQ=');

@$core.Deprecated('Use helloDescriptor instead')
const Hello$json = {
  '1': 'Hello',
  '2': [
    {'1': 'tenant_id', '3': 1, '4': 1, '5': 9, '10': 'tenantId'},
    {'1': 'vessel_id', '3': 2, '4': 1, '5': 9, '10': 'vesselId'},
    {'1': 'node_id', '3': 3, '4': 1, '5': 9, '10': 'nodeId'},
    {
      '1': 'cursors',
      '3': 4,
      '4': 3,
      '5': 11,
      '6': '.marad.sync.v1.Hello.CursorsEntry',
      '10': 'cursors'
    },
  ],
  '3': [Hello_CursorsEntry$json],
};

@$core.Deprecated('Use helloDescriptor instead')
const Hello_CursorsEntry$json = {
  '1': 'CursorsEntry',
  '2': [
    {'1': 'key', '3': 1, '4': 1, '5': 9, '10': 'key'},
    {'1': 'value', '3': 2, '4': 1, '5': 9, '10': 'value'},
  ],
  '7': {'7': true},
};

/// Descriptor for `Hello`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List helloDescriptor = $convert.base64Decode(
    'CgVIZWxsbxIbCgl0ZW5hbnRfaWQYASABKAlSCHRlbmFudElkEhsKCXZlc3NlbF9pZBgCIAEoCV'
    'IIdmVzc2VsSWQSFwoHbm9kZV9pZBgDIAEoCVIGbm9kZUlkEjsKB2N1cnNvcnMYBCADKAsyIS5t'
    'YXJhZC5zeW5jLnYxLkhlbGxvLkN1cnNvcnNFbnRyeVIHY3Vyc29ycxo6CgxDdXJzb3JzRW50cn'
    'kSEAoDa2V5GAEgASgJUgNrZXkSFAoFdmFsdWUYAiABKAlSBXZhbHVlOgI4AQ==');

@$core.Deprecated('Use welcomeDescriptor instead')
const Welcome$json = {
  '1': 'Welcome',
  '2': [
    {
      '1': 'cursors',
      '3': 1,
      '4': 3,
      '5': 11,
      '6': '.marad.sync.v1.Welcome.CursorsEntry',
      '10': 'cursors'
    },
    {'1': 'session_id', '3': 2, '4': 1, '5': 9, '10': 'sessionId'},
  ],
  '3': [Welcome_CursorsEntry$json],
};

@$core.Deprecated('Use welcomeDescriptor instead')
const Welcome_CursorsEntry$json = {
  '1': 'CursorsEntry',
  '2': [
    {'1': 'key', '3': 1, '4': 1, '5': 9, '10': 'key'},
    {'1': 'value', '3': 2, '4': 1, '5': 9, '10': 'value'},
  ],
  '7': {'7': true},
};

/// Descriptor for `Welcome`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List welcomeDescriptor = $convert.base64Decode(
    'CgdXZWxjb21lEj0KB2N1cnNvcnMYASADKAsyIy5tYXJhZC5zeW5jLnYxLldlbGNvbWUuQ3Vyc2'
    '9yc0VudHJ5UgdjdXJzb3JzEh0KCnNlc3Npb25faWQYAiABKAlSCXNlc3Npb25JZBo6CgxDdXJz'
    'b3JzRW50cnkSEAoDa2V5GAEgASgJUgNrZXkSFAoFdmFsdWUYAiABKAlSBXZhbHVlOgI4AQ==');

@$core.Deprecated('Use deltaDescriptor instead')
const Delta$json = {
  '1': 'Delta',
  '2': [
    {'1': 'entity_type', '3': 1, '4': 1, '5': 9, '10': 'entityType'},
    {'1': 'entity_id', '3': 2, '4': 1, '5': 9, '10': 'entityId'},
    {
      '1': 'operation',
      '3': 3,
      '4': 1,
      '5': 14,
      '6': '.marad.sync.v1.SyncOperation',
      '10': 'operation'
    },
    {'1': 'hlc', '3': 4, '4': 1, '5': 9, '10': 'hlc'},
    {'1': 'node_id', '3': 5, '4': 1, '5': 9, '10': 'nodeId'},
    {'1': 'payload', '3': 6, '4': 1, '5': 12, '10': 'payload'},
  ],
};

/// Descriptor for `Delta`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List deltaDescriptor = $convert.base64Decode(
    'CgVEZWx0YRIfCgtlbnRpdHlfdHlwZRgBIAEoCVIKZW50aXR5VHlwZRIbCgllbnRpdHlfaWQYAi'
    'ABKAlSCGVudGl0eUlkEjoKCW9wZXJhdGlvbhgDIAEoDjIcLm1hcmFkLnN5bmMudjEuU3luY09w'
    'ZXJhdGlvblIJb3BlcmF0aW9uEhAKA2hsYxgEIAEoCVIDaGxjEhcKB25vZGVfaWQYBSABKAlSBm'
    '5vZGVJZBIYCgdwYXlsb2FkGAYgASgMUgdwYXlsb2Fk');

@$core.Deprecated('Use deltaBatchDescriptor instead')
const DeltaBatch$json = {
  '1': 'DeltaBatch',
  '2': [
    {
      '1': 'deltas',
      '3': 1,
      '4': 3,
      '5': 11,
      '6': '.marad.sync.v1.Delta',
      '10': 'deltas'
    },
  ],
};

/// Descriptor for `DeltaBatch`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List deltaBatchDescriptor = $convert.base64Decode(
    'CgpEZWx0YUJhdGNoEiwKBmRlbHRhcxgBIAMoCzIULm1hcmFkLnN5bmMudjEuRGVsdGFSBmRlbH'
    'Rhcw==');

@$core.Deprecated('Use ackDescriptor instead')
const Ack$json = {
  '1': 'Ack',
  '2': [
    {
      '1': 'applied_cursors',
      '3': 1,
      '4': 3,
      '5': 11,
      '6': '.marad.sync.v1.Ack.AppliedCursorsEntry',
      '10': 'appliedCursors'
    },
  ],
  '3': [Ack_AppliedCursorsEntry$json],
};

@$core.Deprecated('Use ackDescriptor instead')
const Ack_AppliedCursorsEntry$json = {
  '1': 'AppliedCursorsEntry',
  '2': [
    {'1': 'key', '3': 1, '4': 1, '5': 9, '10': 'key'},
    {'1': 'value', '3': 2, '4': 1, '5': 9, '10': 'value'},
  ],
  '7': {'7': true},
};

/// Descriptor for `Ack`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List ackDescriptor = $convert.base64Decode(
    'CgNBY2sSTwoPYXBwbGllZF9jdXJzb3JzGAEgAygLMiYubWFyYWQuc3luYy52MS5BY2suQXBwbG'
    'llZEN1cnNvcnNFbnRyeVIOYXBwbGllZEN1cnNvcnMaQQoTQXBwbGllZEN1cnNvcnNFbnRyeRIQ'
    'CgNrZXkYASABKAlSA2tleRIUCgV2YWx1ZRgCIAEoCVIFdmFsdWU6AjgB');

@$core.Deprecated('Use heartbeatDescriptor instead')
const Heartbeat$json = {
  '1': 'Heartbeat',
  '2': [
    {'1': 'node_id', '3': 1, '4': 1, '5': 9, '10': 'nodeId'},
    {'1': 'hlc', '3': 2, '4': 1, '5': 9, '10': 'hlc'},
    {'1': 'sent_at_unix_ms', '3': 3, '4': 1, '5': 3, '10': 'sentAtUnixMs'},
  ],
};

/// Descriptor for `Heartbeat`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List heartbeatDescriptor = $convert.base64Decode(
    'CglIZWFydGJlYXQSFwoHbm9kZV9pZBgBIAEoCVIGbm9kZUlkEhAKA2hsYxgCIAEoCVIDaGxjEi'
    'UKD3NlbnRfYXRfdW5peF9tcxgDIAEoA1IMc2VudEF0VW5peE1z');

@$core.Deprecated('Use errorDescriptor instead')
const Error$json = {
  '1': 'Error',
  '2': [
    {
      '1': 'code',
      '3': 1,
      '4': 1,
      '5': 14,
      '6': '.marad.sync.v1.ErrorCode',
      '10': 'code'
    },
    {'1': 'message', '3': 2, '4': 1, '5': 9, '10': 'message'},
  ],
};

/// Descriptor for `Error`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List errorDescriptor = $convert.base64Decode(
    'CgVFcnJvchIsCgRjb2RlGAEgASgOMhgubWFyYWQuc3luYy52MS5FcnJvckNvZGVSBGNvZGUSGA'
    'oHbWVzc2FnZRgCIAEoCVIHbWVzc2FnZQ==');

const $core.Map<$core.String, $core.dynamic> SyncServiceBase$json = {
  '1': 'SyncService',
  '2': [
    {
      '1': 'Stream',
      '2': '.marad.sync.v1.ClientMessage',
      '3': '.marad.sync.v1.ServerMessage',
      '5': true,
      '6': true
    },
  ],
};

@$core.Deprecated('Use syncServiceDescriptor instead')
const $core.Map<$core.String, $core.Map<$core.String, $core.dynamic>>
    SyncServiceBase$messageJson = {
  '.marad.sync.v1.ClientMessage': ClientMessage$json,
  '.marad.sync.v1.Hello': Hello$json,
  '.marad.sync.v1.Hello.CursorsEntry': Hello_CursorsEntry$json,
  '.marad.sync.v1.DeltaBatch': DeltaBatch$json,
  '.marad.sync.v1.Delta': Delta$json,
  '.marad.sync.v1.Ack': Ack$json,
  '.marad.sync.v1.Ack.AppliedCursorsEntry': Ack_AppliedCursorsEntry$json,
  '.marad.sync.v1.Heartbeat': Heartbeat$json,
  '.marad.sync.v1.ServerMessage': ServerMessage$json,
  '.marad.sync.v1.Welcome': Welcome$json,
  '.marad.sync.v1.Welcome.CursorsEntry': Welcome_CursorsEntry$json,
  '.marad.sync.v1.Error': Error$json,
};

/// Descriptor for `SyncService`. Decode as a `google.protobuf.ServiceDescriptorProto`.
final $typed_data.Uint8List syncServiceDescriptor = $convert.base64Decode(
    'CgtTeW5jU2VydmljZRJICgZTdHJlYW0SHC5tYXJhZC5zeW5jLnYxLkNsaWVudE1lc3NhZ2UaHC'
    '5tYXJhZC5zeW5jLnYxLlNlcnZlck1lc3NhZ2UoATAB');
