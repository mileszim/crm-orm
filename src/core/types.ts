import { z } from 'zod';

export type ProviderName = 'salesforce' | 'hubspot';

export interface TelemetryHooks {
  onRequestLog?: (meta: TransportMetadata | undefined, request: unknown) => void;
  onResponseLog?: (meta: TransportMetadata | undefined, response: unknown) => void;
}

export interface TransportMetadata {
  requestName?: string;
  userId?: string;
  organizationId?: string;
}

export type OkResult<T> = { kind: 'ok'; value: T };
export type ErrResult<E extends Error = Error> = { kind: 'err'; error: E };
export type Result<T, E extends Error = Error> = OkResult<T> | ErrResult<E>;

export interface ORMConfig {
  transport: AmpersandTransport;
  telemetry?: TelemetryHooks;
  salesforce?: { version?: string; providerName?: 'salesforce' };
  hubspot?: { version?: string; providerName?: 'hubspot' };
}

export interface AmpersandTransportRequest {
  providerName: ProviderName | (string & {});
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string; // Path only, provider base is handled by Ampersand
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  metadata?: TransportMetadata;
}

export interface AmpersandTransportResponse<T = unknown> {
  status: number;
  headers: Record<string, string | string[]>;
  data: T;
}

export interface AmpersandTransport {
  request<TResponse = unknown>(
    req: AmpersandTransportRequest
  ): Promise<AmpersandTransportResponse<TResponse>>;
}

export type SelectionShape<T> = Partial<Record<keyof T & string, boolean>>;

export interface PaginationConfig<TFields extends string = string> {
  strategy: 'cursor';
  field: TFields | (keyof any & string);
  pageSize?: number;
}

export interface ModelFieldDef {
  path: string; // Provider-specific field path, e.g. 'Owner.Name'
}

export interface RelationDef {
  model: () => ModelDef<any, any>;
  localKey: string;
  foreignKey: string;
}

export interface ModelDef<TSchema extends z.ZodTypeAny, TObjectName extends string = string> {
  name: string;
  object: TObjectName;
  schema: TSchema; // zod object schema describing public model shape
  fields: Record<string, ModelFieldDef>;
  relations?: Record<string, RelationDef>;
  provider: ProviderName | (string & {});
}

export type ModelShape<TModel extends ModelDef<any>> = z.infer<TModel['schema']>;

export type OrderBy<T> = Partial<Record<keyof T & string, 'asc' | 'desc'>>;

export interface QueryContextMeta {
  asResult?: boolean;
  metadata?: TransportMetadata;
}

export interface DialectExecutorDependencies {
  transport: AmpersandTransport;
  telemetry?: TelemetryHooks;
}

export interface SelectAst<TModel extends ModelDef<any>> {
  kind: 'select';
  model: TModel;
  selection: SelectionShape<ModelShape<TModel>> | undefined; // undefined => all mapped fields
  where?: WhereAst;
  orderBy?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  limit?: number;
  offset?: number;
}

export type WhereAst =
  | { kind: 'and'; nodes: WhereAst[] }
  | { kind: 'or'; nodes: WhereAst[] }
  | { kind: 'not'; node: WhereAst }
  | { kind: 'raw'; sql: string }
  | FieldConditionAst;

export interface FieldConditionAstBase {
  kind: 'cond';
  fieldKey: string; // model key
  fieldPath: string; // provider path
}

export type FieldConditionAst =
  | (FieldConditionAstBase & { op: 'eq' | 'ne'; value: unknown })
  | (FieldConditionAstBase & { op: 'gt' | 'gte' | 'lt' | 'lte'; value: unknown })
  | (FieldConditionAstBase & { op: 'like'; value: string })
  | (FieldConditionAstBase & { op: 'startsWith' | 'endsWith'; value: string })
  | (FieldConditionAstBase & { op: 'in' | 'nin'; values: unknown[] })
  | (FieldConditionAstBase & { op: 'between'; values: [unknown, unknown] })
  | (FieldConditionAstBase & { op: 'isNull' | 'isNotNull' });

export interface DialectDriver<TDialectConfig = unknown> {
  readonly providerName: ProviderName | (string & {});
  readonly config: TDialectConfig;
}


