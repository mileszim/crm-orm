import { z } from 'zod';
import { FieldConditionAst, ModelDef, WhereAst } from './types';
import { and, not, or, raw } from './query-ast';

type Primitive = string | number | boolean | null | undefined | Date;

type StringOps = {
  $eq?: string;
  $ne?: string | null;
  $in?: string[] & { $chunk?: ChunkCfg };
  $nin?: string[] & { $chunk?: ChunkCfg };
  $like?: string;
  $startsWith?: string;
  $endsWith?: string;
  $exists?: boolean;
};

type NumberOps = {
  $eq?: number;
  $ne?: number | null;
  $in?: number[] & { $chunk?: ChunkCfg };
  $nin?: number[] & { $chunk?: ChunkCfg };
  $gt?: number;
  $gte?: number;
  $lt?: number;
  $lte?: number;
  $between?: [number, number];
  $exists?: boolean;
};

type BooleanOps = {
  $eq?: boolean;
  $exists?: boolean;
};

type DateLikeOps = {
  $gt?: string | Date;
  $gte?: string | Date;
  $lt?: string | Date;
  $lte?: string | Date;
  $between?: [string | Date, string | Date];
  $exists?: boolean;
};

type NullOps = { $ne?: null } | null;

export type ChunkCfg = { size?: number; parallel?: number };

type Logic<T> = { $and?: Array<Where<T>>; $or?: Array<Where<T>>; $not?: Where<T>; $raw?: string };

export type FieldOps<T> = T extends string
  ? StringOps | string | NullOps
  : T extends number
  ? NumberOps | number | NullOps
  : T extends boolean
  ? BooleanOps | boolean | NullOps
  : T extends Date
  ? DateLikeOps | Date | NullOps
  : T extends (infer U | null)
  ? FieldOps<U> | null
  : never;

// Reduce type recursion depth to avoid excessively deep inference
export type Where<T> = Logic<T> & Partial<Record<keyof T & string, any>>;

export interface NormalizedWhere {
  ast: WhereAst | undefined;
  chunks?: Array<{ fieldPath: string; op: 'in' | 'nin'; values: unknown[]; cfg: ChunkCfg }>;
}

export function normalizeWhere<TModel extends ModelDef<any>>(model: TModel, where?: Where<z.infer<TModel['schema']>>): NormalizedWhere {
  if (!where) return { ast: undefined };
  const nodes: WhereAst[] = [];
  const chunks: NormalizedWhere['chunks'] = [];

  for (const [key, value] of Object.entries(where)) {
    if (key === '$and' && Array.isArray(value)) {
      nodes.push(and(...value.map(v => normalizeWhere(model, v).ast!).filter(Boolean)));
      continue;
    }
    if (key === '$or' && Array.isArray(value)) {
      nodes.push(or(...value.map(v => normalizeWhere(model, v).ast!).filter(Boolean)));
      continue;
    }
    if (key === '$not' && value) {
      const n = normalizeWhere(model, value as any).ast;
      if (n) nodes.push(not(n));
      continue;
    }
    if (key === '$raw' && typeof value === 'string') {
      nodes.push(raw(value));
      continue;
    }

    const fieldKey = key;
    const field = model.fields[fieldKey];
    if (!field) continue;

    const fieldPath = field.path;
    const conds = fieldValueToConds(fieldKey, fieldPath, value as any, chunks);
    if (conds) nodes.push(conds);
  }

  if (nodes.length === 0) return { ast: undefined, chunks };
  if (nodes.length === 1) return { ast: nodes[0], chunks };
  return { ast: and(...nodes), chunks };
}

function fieldValueToConds(
  fieldKey: string,
  fieldPath: string,
  value: Primitive | Record<string, any> | Array<any> | null,
  chunks: NormalizedWhere['chunks']
): WhereAst | undefined {
  if (value === null) {
    return { kind: 'cond', fieldKey, fieldPath, op: 'isNull' } as FieldConditionAst;
  }
  if (typeof value !== 'object' || value instanceof Date || Array.isArray(value)) {
    // Bare value => eq
    return { kind: 'cond', fieldKey, fieldPath, op: 'eq', value } as FieldConditionAst;
  }

  const subNodes: WhereAst[] = [];
  for (const [op, v] of Object.entries(value)) {
    switch (op) {
      case '$eq': subNodes.push({ kind: 'cond', fieldKey, fieldPath, op: 'eq', value: v } as FieldConditionAst); break;
      case '$ne':
        if (v === null) subNodes.push({ kind: 'cond', fieldKey, fieldPath, op: 'isNotNull' } as FieldConditionAst);
        else subNodes.push({ kind: 'cond', fieldKey, fieldPath, op: 'ne', value: v } as FieldConditionAst);
        break;
      case '$gt': subNodes.push({ kind: 'cond', fieldKey, fieldPath, op: 'gt', value: v } as FieldConditionAst); break;
      case '$gte': subNodes.push({ kind: 'cond', fieldKey, fieldPath, op: 'gte', value: v } as FieldConditionAst); break;
      case '$lt': subNodes.push({ kind: 'cond', fieldKey, fieldPath, op: 'lt', value: v } as FieldConditionAst); break;
      case '$lte': subNodes.push({ kind: 'cond', fieldKey, fieldPath, op: 'lte', value: v } as FieldConditionAst); break;
      case '$like': subNodes.push({ kind: 'cond', fieldKey, fieldPath, op: 'like', value: String(v) } as FieldConditionAst); break;
      case '$startsWith': subNodes.push({ kind: 'cond', fieldKey, fieldPath, op: 'startsWith', value: String(v) } as FieldConditionAst); break;
      case '$endsWith': subNodes.push({ kind: 'cond', fieldKey, fieldPath, op: 'endsWith', value: String(v) } as FieldConditionAst); break;
      case '$between':
        if (Array.isArray(v) && v.length === 2) subNodes.push({ kind: 'cond', fieldKey, fieldPath, op: 'between', values: [v[0], v[1]] } as FieldConditionAst);
        break;
      case '$in':
      case '$nin': {
        const arr = Array.isArray(v) ? v : [];
        subNodes.push({ kind: 'cond', fieldKey, fieldPath, op: op === '$in' ? 'in' : 'nin', values: arr } as FieldConditionAst);
        // detect chunk cfg
        const cfg: any = (v as any)?.$chunk;
        if (cfg && Array.isArray(arr) && arr.length > 0) {
          chunks?.push({ fieldPath, op: op === '$in' ? 'in' : 'nin', values: arr, cfg });
        }
        break;
      }
      case '$exists': {
        const exists = Boolean(v);
        subNodes.push({ kind: 'cond', fieldKey, fieldPath, op: exists ? 'isNotNull' : 'isNull' } as FieldConditionAst);
        break;
      }
      default:
        break;
    }
  }
  if (subNodes.length === 0) return undefined;
  if (subNodes.length === 1) return subNodes[0];
  return and(...subNodes);
}


