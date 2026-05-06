// This is a generated file - do not edit.
//
// Generated from sync.proto.

// @dart = 3.3

// ignore_for_file: annotate_overrides, camel_case_types, comment_references
// ignore_for_file: constant_identifier_names
// ignore_for_file: curly_braces_in_flow_control_structures
// ignore_for_file: deprecated_member_use_from_same_package, library_prefixes
// ignore_for_file: non_constant_identifier_names, prefer_relative_imports

import 'dart:async' as $async;
import 'dart:core' as $core;

import 'package:fixnum/fixnum.dart' as $fixnum;
import 'package:protobuf/protobuf.dart' as $pb;

import 'sync.pbenum.dart';

export 'package:protobuf/protobuf.dart' show GeneratedMessageGenericExtensions;

export 'sync.pbenum.dart';

enum ClientMessage_Payload { hello, deltas, ack, heartbeat, notSet }

class ClientMessage extends $pb.GeneratedMessage {
  factory ClientMessage({
    Hello? hello,
    DeltaBatch? deltas,
    Ack? ack,
    Heartbeat? heartbeat,
  }) {
    final result = create();
    if (hello != null) result.hello = hello;
    if (deltas != null) result.deltas = deltas;
    if (ack != null) result.ack = ack;
    if (heartbeat != null) result.heartbeat = heartbeat;
    return result;
  }

  ClientMessage._();

  factory ClientMessage.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      create()..mergeFromBuffer(data, registry);
  factory ClientMessage.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      create()..mergeFromJson(json, registry);

  static const $core.Map<$core.int, ClientMessage_Payload>
      _ClientMessage_PayloadByTag = {
    1: ClientMessage_Payload.hello,
    2: ClientMessage_Payload.deltas,
    3: ClientMessage_Payload.ack,
    4: ClientMessage_Payload.heartbeat,
    0: ClientMessage_Payload.notSet
  };
  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ClientMessage',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'marad.sync.v1'),
      createEmptyInstance: create)
    ..oo(0, [1, 2, 3, 4])
    ..aOM<Hello>(1, _omitFieldNames ? '' : 'hello', subBuilder: Hello.create)
    ..aOM<DeltaBatch>(2, _omitFieldNames ? '' : 'deltas',
        subBuilder: DeltaBatch.create)
    ..aOM<Ack>(3, _omitFieldNames ? '' : 'ack', subBuilder: Ack.create)
    ..aOM<Heartbeat>(4, _omitFieldNames ? '' : 'heartbeat',
        subBuilder: Heartbeat.create)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ClientMessage clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ClientMessage copyWith(void Function(ClientMessage) updates) =>
      super.copyWith((message) => updates(message as ClientMessage))
          as ClientMessage;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  static ClientMessage create() => ClientMessage._();
  @$core.override
  ClientMessage createEmptyInstance() => create();
  @$core.pragma('dart2js:noInline')
  static ClientMessage getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<ClientMessage>(create);
  static ClientMessage? _defaultInstance;

  @$pb.TagNumber(1)
  @$pb.TagNumber(2)
  @$pb.TagNumber(3)
  @$pb.TagNumber(4)
  ClientMessage_Payload whichPayload() =>
      _ClientMessage_PayloadByTag[$_whichOneof(0)]!;
  @$pb.TagNumber(1)
  @$pb.TagNumber(2)
  @$pb.TagNumber(3)
  @$pb.TagNumber(4)
  void clearPayload() => $_clearField($_whichOneof(0));

  @$pb.TagNumber(1)
  Hello get hello => $_getN(0);
  @$pb.TagNumber(1)
  set hello(Hello value) => $_setField(1, value);
  @$pb.TagNumber(1)
  $core.bool hasHello() => $_has(0);
  @$pb.TagNumber(1)
  void clearHello() => $_clearField(1);
  @$pb.TagNumber(1)
  Hello ensureHello() => $_ensure(0);

  @$pb.TagNumber(2)
  DeltaBatch get deltas => $_getN(1);
  @$pb.TagNumber(2)
  set deltas(DeltaBatch value) => $_setField(2, value);
  @$pb.TagNumber(2)
  $core.bool hasDeltas() => $_has(1);
  @$pb.TagNumber(2)
  void clearDeltas() => $_clearField(2);
  @$pb.TagNumber(2)
  DeltaBatch ensureDeltas() => $_ensure(1);

  @$pb.TagNumber(3)
  Ack get ack => $_getN(2);
  @$pb.TagNumber(3)
  set ack(Ack value) => $_setField(3, value);
  @$pb.TagNumber(3)
  $core.bool hasAck() => $_has(2);
  @$pb.TagNumber(3)
  void clearAck() => $_clearField(3);
  @$pb.TagNumber(3)
  Ack ensureAck() => $_ensure(2);

  @$pb.TagNumber(4)
  Heartbeat get heartbeat => $_getN(3);
  @$pb.TagNumber(4)
  set heartbeat(Heartbeat value) => $_setField(4, value);
  @$pb.TagNumber(4)
  $core.bool hasHeartbeat() => $_has(3);
  @$pb.TagNumber(4)
  void clearHeartbeat() => $_clearField(4);
  @$pb.TagNumber(4)
  Heartbeat ensureHeartbeat() => $_ensure(3);
}

enum ServerMessage_Payload { welcome, deltas, ack, heartbeat, error, notSet }

class ServerMessage extends $pb.GeneratedMessage {
  factory ServerMessage({
    Welcome? welcome,
    DeltaBatch? deltas,
    Ack? ack,
    Heartbeat? heartbeat,
    Error? error,
  }) {
    final result = create();
    if (welcome != null) result.welcome = welcome;
    if (deltas != null) result.deltas = deltas;
    if (ack != null) result.ack = ack;
    if (heartbeat != null) result.heartbeat = heartbeat;
    if (error != null) result.error = error;
    return result;
  }

  ServerMessage._();

  factory ServerMessage.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      create()..mergeFromBuffer(data, registry);
  factory ServerMessage.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      create()..mergeFromJson(json, registry);

  static const $core.Map<$core.int, ServerMessage_Payload>
      _ServerMessage_PayloadByTag = {
    1: ServerMessage_Payload.welcome,
    2: ServerMessage_Payload.deltas,
    3: ServerMessage_Payload.ack,
    4: ServerMessage_Payload.heartbeat,
    5: ServerMessage_Payload.error,
    0: ServerMessage_Payload.notSet
  };
  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ServerMessage',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'marad.sync.v1'),
      createEmptyInstance: create)
    ..oo(0, [1, 2, 3, 4, 5])
    ..aOM<Welcome>(1, _omitFieldNames ? '' : 'welcome',
        subBuilder: Welcome.create)
    ..aOM<DeltaBatch>(2, _omitFieldNames ? '' : 'deltas',
        subBuilder: DeltaBatch.create)
    ..aOM<Ack>(3, _omitFieldNames ? '' : 'ack', subBuilder: Ack.create)
    ..aOM<Heartbeat>(4, _omitFieldNames ? '' : 'heartbeat',
        subBuilder: Heartbeat.create)
    ..aOM<Error>(5, _omitFieldNames ? '' : 'error', subBuilder: Error.create)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ServerMessage clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ServerMessage copyWith(void Function(ServerMessage) updates) =>
      super.copyWith((message) => updates(message as ServerMessage))
          as ServerMessage;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  static ServerMessage create() => ServerMessage._();
  @$core.override
  ServerMessage createEmptyInstance() => create();
  @$core.pragma('dart2js:noInline')
  static ServerMessage getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<ServerMessage>(create);
  static ServerMessage? _defaultInstance;

  @$pb.TagNumber(1)
  @$pb.TagNumber(2)
  @$pb.TagNumber(3)
  @$pb.TagNumber(4)
  @$pb.TagNumber(5)
  ServerMessage_Payload whichPayload() =>
      _ServerMessage_PayloadByTag[$_whichOneof(0)]!;
  @$pb.TagNumber(1)
  @$pb.TagNumber(2)
  @$pb.TagNumber(3)
  @$pb.TagNumber(4)
  @$pb.TagNumber(5)
  void clearPayload() => $_clearField($_whichOneof(0));

  @$pb.TagNumber(1)
  Welcome get welcome => $_getN(0);
  @$pb.TagNumber(1)
  set welcome(Welcome value) => $_setField(1, value);
  @$pb.TagNumber(1)
  $core.bool hasWelcome() => $_has(0);
  @$pb.TagNumber(1)
  void clearWelcome() => $_clearField(1);
  @$pb.TagNumber(1)
  Welcome ensureWelcome() => $_ensure(0);

  @$pb.TagNumber(2)
  DeltaBatch get deltas => $_getN(1);
  @$pb.TagNumber(2)
  set deltas(DeltaBatch value) => $_setField(2, value);
  @$pb.TagNumber(2)
  $core.bool hasDeltas() => $_has(1);
  @$pb.TagNumber(2)
  void clearDeltas() => $_clearField(2);
  @$pb.TagNumber(2)
  DeltaBatch ensureDeltas() => $_ensure(1);

  @$pb.TagNumber(3)
  Ack get ack => $_getN(2);
  @$pb.TagNumber(3)
  set ack(Ack value) => $_setField(3, value);
  @$pb.TagNumber(3)
  $core.bool hasAck() => $_has(2);
  @$pb.TagNumber(3)
  void clearAck() => $_clearField(3);
  @$pb.TagNumber(3)
  Ack ensureAck() => $_ensure(2);

  @$pb.TagNumber(4)
  Heartbeat get heartbeat => $_getN(3);
  @$pb.TagNumber(4)
  set heartbeat(Heartbeat value) => $_setField(4, value);
  @$pb.TagNumber(4)
  $core.bool hasHeartbeat() => $_has(3);
  @$pb.TagNumber(4)
  void clearHeartbeat() => $_clearField(4);
  @$pb.TagNumber(4)
  Heartbeat ensureHeartbeat() => $_ensure(3);

  @$pb.TagNumber(5)
  Error get error => $_getN(4);
  @$pb.TagNumber(5)
  set error(Error value) => $_setField(5, value);
  @$pb.TagNumber(5)
  $core.bool hasError() => $_has(4);
  @$pb.TagNumber(5)
  void clearError() => $_clearField(5);
  @$pb.TagNumber(5)
  Error ensureError() => $_ensure(4);
}

class Hello extends $pb.GeneratedMessage {
  factory Hello({
    $core.String? tenantId,
    $core.String? vesselId,
    $core.String? nodeId,
    $core.Iterable<$core.MapEntry<$core.String, $core.String>>? cursors,
  }) {
    final result = create();
    if (tenantId != null) result.tenantId = tenantId;
    if (vesselId != null) result.vesselId = vesselId;
    if (nodeId != null) result.nodeId = nodeId;
    if (cursors != null) result.cursors.addEntries(cursors);
    return result;
  }

  Hello._();

  factory Hello.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      create()..mergeFromBuffer(data, registry);
  factory Hello.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      create()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'Hello',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'marad.sync.v1'),
      createEmptyInstance: create)
    ..aOS(1, _omitFieldNames ? '' : 'tenantId')
    ..aOS(2, _omitFieldNames ? '' : 'vesselId')
    ..aOS(3, _omitFieldNames ? '' : 'nodeId')
    ..m<$core.String, $core.String>(4, _omitFieldNames ? '' : 'cursors',
        entryClassName: 'Hello.CursorsEntry',
        keyFieldType: $pb.PbFieldType.OS,
        valueFieldType: $pb.PbFieldType.OS,
        packageName: const $pb.PackageName('marad.sync.v1'))
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  Hello clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  Hello copyWith(void Function(Hello) updates) =>
      super.copyWith((message) => updates(message as Hello)) as Hello;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  static Hello create() => Hello._();
  @$core.override
  Hello createEmptyInstance() => create();
  @$core.pragma('dart2js:noInline')
  static Hello getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<Hello>(create);
  static Hello? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get tenantId => $_getSZ(0);
  @$pb.TagNumber(1)
  set tenantId($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasTenantId() => $_has(0);
  @$pb.TagNumber(1)
  void clearTenantId() => $_clearField(1);

  @$pb.TagNumber(2)
  $core.String get vesselId => $_getSZ(1);
  @$pb.TagNumber(2)
  set vesselId($core.String value) => $_setString(1, value);
  @$pb.TagNumber(2)
  $core.bool hasVesselId() => $_has(1);
  @$pb.TagNumber(2)
  void clearVesselId() => $_clearField(2);

  @$pb.TagNumber(3)
  $core.String get nodeId => $_getSZ(2);
  @$pb.TagNumber(3)
  set nodeId($core.String value) => $_setString(2, value);
  @$pb.TagNumber(3)
  $core.bool hasNodeId() => $_has(2);
  @$pb.TagNumber(3)
  void clearNodeId() => $_clearField(3);

  /// Highest HLC the vessel has *applied* from each peer node.
  /// Server replays deltas with hlc > cursors[nodeId] for each peer.
  @$pb.TagNumber(4)
  $pb.PbMap<$core.String, $core.String> get cursors => $_getMap(3);
}

class Welcome extends $pb.GeneratedMessage {
  factory Welcome({
    $core.Iterable<$core.MapEntry<$core.String, $core.String>>? cursors,
    $core.String? sessionId,
  }) {
    final result = create();
    if (cursors != null) result.cursors.addEntries(cursors);
    if (sessionId != null) result.sessionId = sessionId;
    return result;
  }

  Welcome._();

  factory Welcome.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      create()..mergeFromBuffer(data, registry);
  factory Welcome.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      create()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'Welcome',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'marad.sync.v1'),
      createEmptyInstance: create)
    ..m<$core.String, $core.String>(1, _omitFieldNames ? '' : 'cursors',
        entryClassName: 'Welcome.CursorsEntry',
        keyFieldType: $pb.PbFieldType.OS,
        valueFieldType: $pb.PbFieldType.OS,
        packageName: const $pb.PackageName('marad.sync.v1'))
    ..aOS(2, _omitFieldNames ? '' : 'sessionId')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  Welcome clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  Welcome copyWith(void Function(Welcome) updates) =>
      super.copyWith((message) => updates(message as Welcome)) as Welcome;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  static Welcome create() => Welcome._();
  @$core.override
  Welcome createEmptyInstance() => create();
  @$core.pragma('dart2js:noInline')
  static Welcome getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<Welcome>(create);
  static Welcome? _defaultInstance;

  /// Highest HLC the server has *received* from this vessel's node.
  /// Vessel replays deltas with hlc > cursors[nodeId] for each peer.
  @$pb.TagNumber(1)
  $pb.PbMap<$core.String, $core.String> get cursors => $_getMap(0);

  /// Server-assigned correlation id useful for log triage.
  @$pb.TagNumber(2)
  $core.String get sessionId => $_getSZ(1);
  @$pb.TagNumber(2)
  set sessionId($core.String value) => $_setString(1, value);
  @$pb.TagNumber(2)
  $core.bool hasSessionId() => $_has(1);
  @$pb.TagNumber(2)
  void clearSessionId() => $_clearField(2);
}

class Delta extends $pb.GeneratedMessage {
  factory Delta({
    $core.String? entityType,
    $core.String? entityId,
    SyncOperation? operation,
    $core.String? hlc,
    $core.String? nodeId,
    $core.List<$core.int>? payload,
  }) {
    final result = create();
    if (entityType != null) result.entityType = entityType;
    if (entityId != null) result.entityId = entityId;
    if (operation != null) result.operation = operation;
    if (hlc != null) result.hlc = hlc;
    if (nodeId != null) result.nodeId = nodeId;
    if (payload != null) result.payload = payload;
    return result;
  }

  Delta._();

  factory Delta.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      create()..mergeFromBuffer(data, registry);
  factory Delta.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      create()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'Delta',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'marad.sync.v1'),
      createEmptyInstance: create)
    ..aOS(1, _omitFieldNames ? '' : 'entityType')
    ..aOS(2, _omitFieldNames ? '' : 'entityId')
    ..aE<SyncOperation>(3, _omitFieldNames ? '' : 'operation',
        enumValues: SyncOperation.values)
    ..aOS(4, _omitFieldNames ? '' : 'hlc')
    ..aOS(5, _omitFieldNames ? '' : 'nodeId')
    ..a<$core.List<$core.int>>(
        6, _omitFieldNames ? '' : 'payload', $pb.PbFieldType.OY)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  Delta clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  Delta copyWith(void Function(Delta) updates) =>
      super.copyWith((message) => updates(message as Delta)) as Delta;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  static Delta create() => Delta._();
  @$core.override
  Delta createEmptyInstance() => create();
  @$core.pragma('dart2js:noInline')
  static Delta getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<Delta>(create);
  static Delta? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get entityType => $_getSZ(0);
  @$pb.TagNumber(1)
  set entityType($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasEntityType() => $_has(0);
  @$pb.TagNumber(1)
  void clearEntityType() => $_clearField(1);

  @$pb.TagNumber(2)
  $core.String get entityId => $_getSZ(1);
  @$pb.TagNumber(2)
  set entityId($core.String value) => $_setString(1, value);
  @$pb.TagNumber(2)
  $core.bool hasEntityId() => $_has(1);
  @$pb.TagNumber(2)
  void clearEntityId() => $_clearField(2);

  @$pb.TagNumber(3)
  SyncOperation get operation => $_getN(2);
  @$pb.TagNumber(3)
  set operation(SyncOperation value) => $_setField(3, value);
  @$pb.TagNumber(3)
  $core.bool hasOperation() => $_has(2);
  @$pb.TagNumber(3)
  void clearOperation() => $_clearField(3);

  @$pb.TagNumber(4)
  $core.String get hlc => $_getSZ(3);
  @$pb.TagNumber(4)
  set hlc($core.String value) => $_setString(3, value);
  @$pb.TagNumber(4)
  $core.bool hasHlc() => $_has(3);
  @$pb.TagNumber(4)
  void clearHlc() => $_clearField(4);

  @$pb.TagNumber(5)
  $core.String get nodeId => $_getSZ(4);
  @$pb.TagNumber(5)
  set nodeId($core.String value) => $_setString(4, value);
  @$pb.TagNumber(5)
  $core.bool hasNodeId() => $_has(4);
  @$pb.TagNumber(5)
  void clearNodeId() => $_clearField(5);

  /// JSON-encoded LwwRecord (per-field { value, hlc } map).
  /// Bytes (not string) so future protobuf-typed payloads are wire-compatible.
  @$pb.TagNumber(6)
  $core.List<$core.int> get payload => $_getN(5);
  @$pb.TagNumber(6)
  set payload($core.List<$core.int> value) => $_setBytes(5, value);
  @$pb.TagNumber(6)
  $core.bool hasPayload() => $_has(5);
  @$pb.TagNumber(6)
  void clearPayload() => $_clearField(6);
}

class DeltaBatch extends $pb.GeneratedMessage {
  factory DeltaBatch({
    $core.Iterable<Delta>? deltas,
  }) {
    final result = create();
    if (deltas != null) result.deltas.addAll(deltas);
    return result;
  }

  DeltaBatch._();

  factory DeltaBatch.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      create()..mergeFromBuffer(data, registry);
  factory DeltaBatch.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      create()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'DeltaBatch',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'marad.sync.v1'),
      createEmptyInstance: create)
    ..pPM<Delta>(1, _omitFieldNames ? '' : 'deltas', subBuilder: Delta.create)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  DeltaBatch clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  DeltaBatch copyWith(void Function(DeltaBatch) updates) =>
      super.copyWith((message) => updates(message as DeltaBatch)) as DeltaBatch;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  static DeltaBatch create() => DeltaBatch._();
  @$core.override
  DeltaBatch createEmptyInstance() => create();
  @$core.pragma('dart2js:noInline')
  static DeltaBatch getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<DeltaBatch>(create);
  static DeltaBatch? _defaultInstance;

  @$pb.TagNumber(1)
  $pb.PbList<Delta> get deltas => $_getList(0);
}

/// Highest HLC successfully applied per peer node, after a DeltaBatch
/// was processed. Acks are advisory — recovery happens via cursor replay
/// on stream reconnect, not via per-message ack.
class Ack extends $pb.GeneratedMessage {
  factory Ack({
    $core.Iterable<$core.MapEntry<$core.String, $core.String>>? appliedCursors,
  }) {
    final result = create();
    if (appliedCursors != null)
      result.appliedCursors.addEntries(appliedCursors);
    return result;
  }

  Ack._();

  factory Ack.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      create()..mergeFromBuffer(data, registry);
  factory Ack.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      create()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'Ack',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'marad.sync.v1'),
      createEmptyInstance: create)
    ..m<$core.String, $core.String>(1, _omitFieldNames ? '' : 'appliedCursors',
        entryClassName: 'Ack.AppliedCursorsEntry',
        keyFieldType: $pb.PbFieldType.OS,
        valueFieldType: $pb.PbFieldType.OS,
        packageName: const $pb.PackageName('marad.sync.v1'))
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  Ack clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  Ack copyWith(void Function(Ack) updates) =>
      super.copyWith((message) => updates(message as Ack)) as Ack;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  static Ack create() => Ack._();
  @$core.override
  Ack createEmptyInstance() => create();
  @$core.pragma('dart2js:noInline')
  static Ack getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<Ack>(create);
  static Ack? _defaultInstance;

  @$pb.TagNumber(1)
  $pb.PbMap<$core.String, $core.String> get appliedCursors => $_getMap(0);
}

class Heartbeat extends $pb.GeneratedMessage {
  factory Heartbeat({
    $core.String? nodeId,
    $core.String? hlc,
    $fixnum.Int64? sentAtUnixMs,
  }) {
    final result = create();
    if (nodeId != null) result.nodeId = nodeId;
    if (hlc != null) result.hlc = hlc;
    if (sentAtUnixMs != null) result.sentAtUnixMs = sentAtUnixMs;
    return result;
  }

  Heartbeat._();

  factory Heartbeat.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      create()..mergeFromBuffer(data, registry);
  factory Heartbeat.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      create()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'Heartbeat',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'marad.sync.v1'),
      createEmptyInstance: create)
    ..aOS(1, _omitFieldNames ? '' : 'nodeId')
    ..aOS(2, _omitFieldNames ? '' : 'hlc')
    ..aInt64(3, _omitFieldNames ? '' : 'sentAtUnixMs')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  Heartbeat clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  Heartbeat copyWith(void Function(Heartbeat) updates) =>
      super.copyWith((message) => updates(message as Heartbeat)) as Heartbeat;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  static Heartbeat create() => Heartbeat._();
  @$core.override
  Heartbeat createEmptyInstance() => create();
  @$core.pragma('dart2js:noInline')
  static Heartbeat getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<Heartbeat>(create);
  static Heartbeat? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get nodeId => $_getSZ(0);
  @$pb.TagNumber(1)
  set nodeId($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasNodeId() => $_has(0);
  @$pb.TagNumber(1)
  void clearNodeId() => $_clearField(1);

  @$pb.TagNumber(2)
  $core.String get hlc => $_getSZ(1);
  @$pb.TagNumber(2)
  set hlc($core.String value) => $_setString(1, value);
  @$pb.TagNumber(2)
  $core.bool hasHlc() => $_has(1);
  @$pb.TagNumber(2)
  void clearHlc() => $_clearField(2);

  @$pb.TagNumber(3)
  $fixnum.Int64 get sentAtUnixMs => $_getI64(2);
  @$pb.TagNumber(3)
  set sentAtUnixMs($fixnum.Int64 value) => $_setInt64(2, value);
  @$pb.TagNumber(3)
  $core.bool hasSentAtUnixMs() => $_has(2);
  @$pb.TagNumber(3)
  void clearSentAtUnixMs() => $_clearField(3);
}

class Error extends $pb.GeneratedMessage {
  factory Error({
    ErrorCode? code,
    $core.String? message,
  }) {
    final result = create();
    if (code != null) result.code = code;
    if (message != null) result.message = message;
    return result;
  }

  Error._();

  factory Error.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      create()..mergeFromBuffer(data, registry);
  factory Error.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      create()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'Error',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'marad.sync.v1'),
      createEmptyInstance: create)
    ..aE<ErrorCode>(1, _omitFieldNames ? '' : 'code',
        enumValues: ErrorCode.values)
    ..aOS(2, _omitFieldNames ? '' : 'message')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  Error clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  Error copyWith(void Function(Error) updates) =>
      super.copyWith((message) => updates(message as Error)) as Error;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  static Error create() => Error._();
  @$core.override
  Error createEmptyInstance() => create();
  @$core.pragma('dart2js:noInline')
  static Error getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<Error>(create);
  static Error? _defaultInstance;

  @$pb.TagNumber(1)
  ErrorCode get code => $_getN(0);
  @$pb.TagNumber(1)
  set code(ErrorCode value) => $_setField(1, value);
  @$pb.TagNumber(1)
  $core.bool hasCode() => $_has(0);
  @$pb.TagNumber(1)
  void clearCode() => $_clearField(1);

  @$pb.TagNumber(2)
  $core.String get message => $_getSZ(1);
  @$pb.TagNumber(2)
  set message($core.String value) => $_setString(1, value);
  @$pb.TagNumber(2)
  $core.bool hasMessage() => $_has(1);
  @$pb.TagNumber(2)
  void clearMessage() => $_clearField(2);
}

/// One bidirectional stream per (tenant, vessel) connection.
/// See apps/docs/adr/0002-sync-wire-protocol.md for protocol semantics.
class SyncServiceApi {
  final $pb.RpcClient _client;

  SyncServiceApi(this._client);

  $async.Future<ServerMessage> stream(
          $pb.ClientContext? ctx, ClientMessage request) =>
      _client.invoke<ServerMessage>(
          ctx, 'SyncService', 'Stream', request, ServerMessage());
}

const $core.bool _omitFieldNames =
    $core.bool.fromEnvironment('protobuf.omit_field_names');
const $core.bool _omitMessageNames =
    $core.bool.fromEnvironment('protobuf.omit_message_names');
