// This is a generated file - do not edit.
//
// Generated from sync.proto.

// @dart = 3.3

// ignore_for_file: annotate_overrides, camel_case_types, comment_references
// ignore_for_file: constant_identifier_names
// ignore_for_file: curly_braces_in_flow_control_structures
// ignore_for_file: deprecated_member_use_from_same_package, library_prefixes
// ignore_for_file: non_constant_identifier_names, prefer_relative_imports

import 'dart:core' as $core;

import 'package:protobuf/protobuf.dart' as $pb;

class SyncOperation extends $pb.ProtobufEnum {
  static const SyncOperation SYNC_OPERATION_UNSPECIFIED =
      SyncOperation._(0, _omitEnumNames ? '' : 'SYNC_OPERATION_UNSPECIFIED');
  static const SyncOperation SYNC_OPERATION_UPSERT =
      SyncOperation._(1, _omitEnumNames ? '' : 'SYNC_OPERATION_UPSERT');
  static const SyncOperation SYNC_OPERATION_DELETE =
      SyncOperation._(2, _omitEnumNames ? '' : 'SYNC_OPERATION_DELETE');

  static const $core.List<SyncOperation> values = <SyncOperation>[
    SYNC_OPERATION_UNSPECIFIED,
    SYNC_OPERATION_UPSERT,
    SYNC_OPERATION_DELETE,
  ];

  static final $core.List<SyncOperation?> _byValue =
      $pb.ProtobufEnum.$_initByValueList(values, 2);
  static SyncOperation? valueOf($core.int value) =>
      value < 0 || value >= _byValue.length ? null : _byValue[value];

  const SyncOperation._(super.value, super.name);
}

class ErrorCode extends $pb.ProtobufEnum {
  static const ErrorCode ERROR_CODE_UNSPECIFIED =
      ErrorCode._(0, _omitEnumNames ? '' : 'ERROR_CODE_UNSPECIFIED');
  static const ErrorCode ERROR_CODE_UNAUTHENTICATED =
      ErrorCode._(1, _omitEnumNames ? '' : 'ERROR_CODE_UNAUTHENTICATED');
  static const ErrorCode ERROR_CODE_TENANT_MISMATCH =
      ErrorCode._(2, _omitEnumNames ? '' : 'ERROR_CODE_TENANT_MISMATCH');
  static const ErrorCode ERROR_CODE_PROTOCOL =
      ErrorCode._(3, _omitEnumNames ? '' : 'ERROR_CODE_PROTOCOL');
  static const ErrorCode ERROR_CODE_INTERNAL =
      ErrorCode._(4, _omitEnumNames ? '' : 'ERROR_CODE_INTERNAL');

  static const $core.List<ErrorCode> values = <ErrorCode>[
    ERROR_CODE_UNSPECIFIED,
    ERROR_CODE_UNAUTHENTICATED,
    ERROR_CODE_TENANT_MISMATCH,
    ERROR_CODE_PROTOCOL,
    ERROR_CODE_INTERNAL,
  ];

  static final $core.List<ErrorCode?> _byValue =
      $pb.ProtobufEnum.$_initByValueList(values, 4);
  static ErrorCode? valueOf($core.int value) =>
      value < 0 || value >= _byValue.length ? null : _byValue[value];

  const ErrorCode._(super.value, super.name);
}

const $core.bool _omitEnumNames =
    $core.bool.fromEnvironment('protobuf.omit_enum_names');
