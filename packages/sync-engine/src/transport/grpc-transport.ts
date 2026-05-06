import * as grpc from '@grpc/grpc-js';
import { loadSync, type Options as ProtoLoaderOptions } from '@grpc/proto-loader';
import type { SyncDelta } from '../types.js';
import type { SyncTransport } from './transport.js';

// ── proto-loader options ─────────────────────────────────────────────────────

const PROTO_LOADER_OPTS: ProtoLoaderOptions = {
  keepCase: false, // camelCase fields, matching ts-proto output
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
};

// ── runtime types (derived from proto-loader output) ──────────────────────────

type Op = 'SYNC_OPERATION_UNSPECIFIED' | 'SYNC_OPERATION_UPSERT' | 'SYNC_OPERATION_DELETE';

interface WireDelta {
  entityType: string;
  entityId: string;
  operation: Op;
  hlc: string;
  nodeId: string;
  payload: Buffer;
}

interface WireDeltaBatch {
  deltas: WireDelta[];
}

interface WireHello {
  tenantId: string;
  vesselId: string;
  nodeId: string;
  cursors: Record<string, string>;
}

interface WireWelcome {
  cursors: Record<string, string>;
  sessionId: string;
}

interface ClientMessage {
  hello?: WireHello;
  deltas?: WireDeltaBatch;
  ack?: { appliedCursors: Record<string, string> };
  heartbeat?: { nodeId: string; hlc: string; sentAtUnixMs: string | number };
}

interface ServerMessage {
  welcome?: WireWelcome;
  deltas?: WireDeltaBatch;
  ack?: { appliedCursors: Record<string, string> };
  heartbeat?: { nodeId: string; hlc: string; sentAtUnixMs: string | number };
  error?: { code: string; message: string };
}

// ── proto loading ─────────────────────────────────────────────────────────────

/** Load the SyncService definition from a .proto file path. */
export function loadSyncProto(protoPath: string): grpc.GrpcObject {
  const packageDef = loadSync(protoPath, PROTO_LOADER_OPTS);
  return grpc.loadPackageDefinition(packageDef);
}

interface SyncServiceDef {
  SyncService: grpc.ServiceClientConstructor;
}

interface MaradSyncV1 {
  marad: { sync: { v1: SyncServiceDef } };
}

function syncServiceFrom(proto: grpc.GrpcObject): SyncServiceDef {
  return (proto as unknown as MaradSyncV1).marad.sync.v1;
}

// ── delta conversion ──────────────────────────────────────────────────────────

function deltaToWire(d: SyncDelta): WireDelta {
  return {
    entityType: d.entityType,
    entityId: d.entityId,
    operation: d.operation === 'upsert' ? 'SYNC_OPERATION_UPSERT' : 'SYNC_OPERATION_DELETE',
    hlc: d.hlc,
    nodeId: d.nodeId,
    payload: Buffer.from(JSON.stringify(d.payload ?? null)),
  };
}

function wireToDelta(w: WireDelta): SyncDelta {
  const operation: 'upsert' | 'delete' =
    w.operation === 'SYNC_OPERATION_UPSERT' ? 'upsert' : 'delete';
  const payloadStr = Buffer.isBuffer(w.payload)
    ? w.payload.toString('utf-8')
    : (w.payload as unknown as string);
  const payloadJson = JSON.parse(payloadStr) as SyncDelta['payload'] | null;
  return {
    entityType: w.entityType,
    entityId: w.entityId,
    operation,
    payload: operation === 'delete' ? null : (payloadJson ?? null),
    hlc: w.hlc,
    nodeId: w.nodeId,
  };
}

// ── server ────────────────────────────────────────────────────────────────────

export interface SyncServerOptions {
  protoPath: string;
  /**
   * Called when a vessel opens a stream. The handler receives the Hello
   * payload and a `send` callback; it returns a `receive` that the server
   * will invoke for every incoming delta and an `onClose` lifecycle hook.
   */
  onStreamOpen: (
    hello: WireHello,
    send: (delta: SyncDelta) => Promise<void>,
  ) => Promise<{
    welcome: { cursors: Record<string, string>; sessionId: string };
    onReceive: (delta: SyncDelta) => Promise<void>;
    onClose: () => Promise<void>;
  }>;
}

/**
 * Boot a gRPC server hosting the SyncService at the given bind address.
 * Returns the bound port and a shutdown function.
 */
export async function startSyncServer(
  bindAddress: string,
  opts: SyncServerOptions,
): Promise<{ port: number; shutdown: () => Promise<void> }> {
  const proto = loadSyncProto(opts.protoPath);
  const def = syncServiceFrom(proto);
  // The service definition's `service` property is the methods table.
  const serviceImpl = (def.SyncService as unknown as { service: grpc.ServiceDefinition }).service;

  const server = new grpc.Server();

  server.addService(serviceImpl, {
    Stream: (call: grpc.ServerDuplexStream<ClientMessage, ServerMessage>) => {
      let session: {
        send: (delta: SyncDelta) => Promise<void>;
        onReceive: (delta: SyncDelta) => Promise<void>;
        onClose: () => Promise<void>;
      } | null = null;

      call.on('data', (msg: ClientMessage) => {
        void (async () => {
          if (msg.hello !== undefined && session === null) {
            const send = async (delta: SyncDelta): Promise<void> => {
              call.write({ deltas: { deltas: [deltaToWire(delta)] } });
            };
            const opened = await opts.onStreamOpen(msg.hello, send);
            session = { send, onReceive: opened.onReceive, onClose: opened.onClose };
            call.write({ welcome: opened.welcome });
            return;
          }
          if (msg.deltas !== undefined && session !== null) {
            for (const w of msg.deltas.deltas) {
              await session.onReceive(wireToDelta(w));
            }
          }
        })().catch((err) => {
          call.write({
            error: { code: 'ERROR_CODE_INTERNAL', message: (err as Error).message },
          });
          call.end();
        });
      });

      call.on('end', () => {
        void session?.onClose();
        call.end();
      });

      call.on('error', () => {
        void session?.onClose();
      });
    },
  });

  const port = await new Promise<number>((resolve, reject) => {
    server.bindAsync(bindAddress, grpc.ServerCredentials.createInsecure(), (err, p) => {
      if (err) reject(err);
      else resolve(p);
    });
  });

  return {
    port,
    shutdown: () =>
      new Promise<void>((resolve) => {
        server.tryShutdown(() => resolve());
      }),
  };
}

// ── client transport ──────────────────────────────────────────────────────────

export interface GrpcClientTransportOptions {
  protoPath: string;
  serverAddress: string; // e.g. "127.0.0.1:50051"
  hello: { tenantId: string; vesselId: string; nodeId: string };
  cursors?: Record<string, string>;
  authToken?: string; // bearer; stored in stream metadata
}

/**
 * Bidi-stream client — drains local deltas via send(), surfaces remote
 * deltas via the start() callback. Reconnect/backoff logic is left to the
 * caller (see ADR 0002 §5).
 */
export class GrpcSyncTransport implements SyncTransport {
  private call: grpc.ClientDuplexStream<ClientMessage, ServerMessage> | null = null;
  private client: grpc.Client | null = null;
  private closed = false;

  constructor(private readonly opts: GrpcClientTransportOptions) {}

  async start(onReceive: (delta: SyncDelta) => Promise<void>): Promise<void> {
    const proto = loadSyncProto(this.opts.protoPath);
    const def = syncServiceFrom(proto);
    const ClientCtor = def.SyncService;
    const client = new ClientCtor(
      this.opts.serverAddress,
      grpc.credentials.createInsecure(),
    ) as unknown as grpc.Client & {
      Stream: () => grpc.ClientDuplexStream<ClientMessage, ServerMessage>;
    };
    this.client = client;

    const metadata = new grpc.Metadata();
    if (this.opts.authToken !== undefined) {
      metadata.set('authorization', `Bearer ${this.opts.authToken}`);
    }
    // The proto-loader generates a `Stream` method on the client.
    const call = (
      client as unknown as {
        Stream: (md?: grpc.Metadata) => grpc.ClientDuplexStream<ClientMessage, ServerMessage>;
      }
    ).Stream(metadata);
    this.call = call;

    return new Promise<void>((resolve, reject) => {
      let ready = false;
      call.on('data', (msg: ServerMessage) => {
        void (async () => {
          if (msg.welcome !== undefined && !ready) {
            ready = true;
            resolve();
            return;
          }
          if (msg.error !== undefined) {
            if (!ready) reject(new Error(`server error: ${msg.error.message}`));
            return;
          }
          if (msg.deltas !== undefined) {
            for (const w of msg.deltas.deltas) {
              await onReceive(wireToDelta(w));
            }
          }
        })().catch((err: unknown) => {
          if (!ready) reject(err);
        });
      });
      call.on('error', (err) => {
        if (!ready) reject(err);
      });

      call.write({
        hello: {
          tenantId: this.opts.hello.tenantId,
          vesselId: this.opts.hello.vesselId,
          nodeId: this.opts.hello.nodeId,
          cursors: this.opts.cursors ?? {},
        },
      });
    });
  }

  async send(deltas: readonly SyncDelta[]): Promise<void> {
    if (this.closed || this.call === null) {
      throw new Error('transport is not open');
    }
    if (deltas.length === 0) return;
    this.call.write({ deltas: { deltas: deltas.map(deltaToWire) } });
  }

  async close(): Promise<void> {
    this.closed = true;
    this.call?.end();
    this.client?.close();
  }
}
