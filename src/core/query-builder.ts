import { z } from 'zod';
import { ModelDef, ModelShape, OrderBy, PaginationConfig, QueryContextMeta, SelectAst } from './types';
import { normalizeWhere, Where } from './where-dsl';
import { orderObjectToArray } from './query-ast';

export interface QueryExecutor {
  executeSelect<TModel extends ModelDef<any>>(ast: SelectAst<TModel>, ctx?: QueryContextMeta): Promise<unknown[]>;
}

export class QueryBuilder<TModel extends ModelDef<any>> {
  private _selection: Partial<Record<string, boolean>> | undefined;
  private _where: Where<ModelShape<TModel>> | undefined;
  private _orderBy: OrderBy<ModelShape<TModel>> | undefined;
  private _limit: number | undefined;
  private _offset: number | undefined;
  private _pagination: PaginationConfig<string> | undefined;

  constructor(private readonly model: TModel, private readonly executor: QueryExecutor) {}

  select(sel?: Partial<Record<keyof ModelShape<TModel> & string, boolean>>): this {
    this._selection = (sel as any) || undefined;
    return this;
  }

  where(filter?: Where<ModelShape<TModel>>): this {
    this._where = filter;
    return this;
  }

  orderBy(order?: OrderBy<ModelShape<TModel>>): this {
    this._orderBy = order;
    return this;
  }

  limit(n: number): this { this._limit = n; return this; }
  offset(n: number): this { this._offset = n; return this; }

  paginate(cfg: PaginationConfig<string>): this { this._pagination = cfg; return this; }

  private buildAst(): SelectAst<TModel> {
    const normalized = normalizeWhere(this.model, this._where as any);
    return {
      kind: 'select',
      model: this.model,
      selection: this._selection as any,
      where: normalized.ast,
      orderBy: orderObjectToArray(this._orderBy),
      limit: this._limit,
      offset: this._offset,
    };
  }

  async getMany(ctx?: QueryContextMeta): Promise<Array<ModelShape<TModel>>> {
    const ast = this.buildAst();
    const rows = await this.executor.executeSelect(ast, ctx);
    const arr = Array.isArray(rows) ? rows : [];
    const selectionKeys = this._selection ? Object.keys(this._selection).filter(k => (this._selection as any)[k]) : Object.keys(this.model.fields);
    const parsedSchema = deriveSchemaForSelection(this.model.schema, selectionKeys as string[]);
    return arr.map((r) => {
      const mapped = mapRecordToModelShape(r as any, this.model, selectionKeys as string[]);
      return parsedSchema.parse(mapped) as ModelShape<TModel>;
    });
  }

  async getOne(ctx?: QueryContextMeta): Promise<ModelShape<TModel> | null> {
    const rows = await this.limit(1).getMany(ctx);
    return rows[0] ?? null;
  }
}

export class ORMQueryAPI<TModel extends ModelDef<any>> {
  constructor(private readonly model: TModel, private readonly executor: QueryExecutor) {}
  select(sel?: Partial<Record<keyof ModelShape<TModel> & string, boolean>>) {
    return new QueryBuilder(this.model, this.executor).select(sel);
  }
  where(filter?: Where<ModelShape<TModel>>) {
    return new QueryBuilder(this.model, this.executor).where(filter);
  }
  orderBy(order?: OrderBy<ModelShape<TModel>>) {
    return new QueryBuilder(this.model, this.executor).orderBy(order);
  }
  limit(n: number) { return new QueryBuilder(this.model, this.executor).limit(n); }
  offset(n: number) { return new QueryBuilder(this.model, this.executor).offset(n); }
  paginate(cfg: PaginationConfig<string>) { return new QueryBuilder(this.model, this.executor).paginate(cfg); }
}

function mapRecordToModelShape(record: Record<string, any>, model: ModelDef<any>, selectionKeys: string[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const key of selectionKeys) {
    const field = model.fields[key];
    if (!field) continue;
    out[key] = getByPath(record, field.path);
  }
  return out;
}

function getByPath(obj: any, path: string): any {
  const parts = path.split('.');
  let cur: any = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    // Salesforce nested relationship in records often use relationship names without ".Name" flattening.
    cur = cur[p] ?? cur[p.replace(/__r$/, '')];
  }
  return cur;
}

function deriveSchemaForSelection(schema: z.ZodTypeAny, keys: string[]): z.ZodTypeAny {
  // If the source is an object schema, pick and make the rest optional
  if (schema instanceof z.ZodObject) {
    const obj = schema as z.ZodObject<any>;
    const picked = obj.pick(keys.reduce((acc: any, k) => { acc[k] = true; return acc; }, {}));
    // Allow partial because partial selections omit other keys
    return picked;
  }
  return schema;
}


