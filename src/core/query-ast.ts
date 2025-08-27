import { ModelDef, OrderBy, SelectAst, WhereAst } from './types';

export type QueryAst<TModel extends ModelDef<any>> = SelectAst<TModel>;

export function orderObjectToArray<T>(order?: OrderBy<T>): Array<{ field: string; direction: 'asc' | 'desc' }> | undefined {
  if (!order) return undefined;
  const out: Array<{ field: string; direction: 'asc' | 'desc' }> = [];
  for (const [field, dir] of Object.entries(order)) {
    const direction = (dir === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc';
    out.push({ field, direction });
  }
  return out;
}

export function and(...nodes: WhereAst[]): WhereAst { return { kind: 'and', nodes }; }
export function or(...nodes: WhereAst[]): WhereAst { return { kind: 'or', nodes }; }
export function not(node: WhereAst): WhereAst { return { kind: 'not', node }; }
export function raw(sql: string): WhereAst { return { kind: 'raw', sql }; }


