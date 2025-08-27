import { FieldConditionAst, ModelDef, SelectAst, WhereAst } from '../../core/types';

export function buildSOQL<TModel extends ModelDef<any>>(ast: SelectAst<TModel>): string {
  const model = ast.model;
  const fields = ast.selection
    ? Object.entries(ast.selection)
        .filter(([, v]) => !!v)
        .map(([k]) => model.fields[k]?.path || k)
    : Object.values(model.fields).map(f => f.path);
  const projections = fields.length > 0 ? fields.join(', ') : 'Id';
  const from = model.object;
  const where = ast.where ? ` WHERE ${renderWhere(ast.where)}` : '';
  const order = ast.orderBy && ast.orderBy.length > 0 ? ` ORDER BY ${ast.orderBy.map(o => `${pathFor(model, o.field)} ${o.direction.toUpperCase()}`).join(', ')}` : '';
  const limit = ast.limit ? ` LIMIT ${ast.limit}` : '';
  const offset = ast.offset ? ` OFFSET ${ast.offset}` : '';
  return `SELECT ${projections} FROM ${from}${where}${order}${limit}${offset}`;
}

function pathFor(model: any, fieldKey: string): string {
  return model.fields[fieldKey]?.path || fieldKey;
}

function renderWhere(node: WhereAst): string {
  switch (node.kind) {
    case 'raw':
      return node.sql;
    case 'not':
      return `(NOT ${renderWhere(node.node)})`;
    case 'and':
      return `(${node.nodes.map(renderWhere).join(' AND ')})`;
    case 'or':
      return `(${node.nodes.map(renderWhere).join(' OR ')})`;
    case 'cond':
      return renderCond(node as FieldConditionAst);
  }
}

function escapeString(val: string): string {
  return `'${val.replace(/'/g, "\\'")}'`;
}

function escapeValue(val: unknown): string {
  if (val === null) return 'null';
  if (val === undefined) return 'null';
  if (typeof val === 'string') return escapeString(val);
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (val instanceof Date) return escapeString(val.toISOString());
  return escapeString(String(val));
}

function renderCond(cond: FieldConditionAst): string {
  const f = cond.fieldPath;
  switch (cond.op) {
    case 'eq': return `${f} = ${escapeValue((cond as any).value)}`;
    case 'ne': return `${f} != ${escapeValue((cond as any).value)}`;
    case 'gt': return `${f} > ${escapeValue((cond as any).value)}`;
    case 'gte': return `${f} >= ${escapeValue((cond as any).value)}`;
    case 'lt': return `${f} < ${escapeValue((cond as any).value)}`;
    case 'lte': return `${f} <= ${escapeValue((cond as any).value)}`;
    case 'like': return `${f} LIKE ${escapeValue((cond as any).value)}`;
    case 'startsWith': return `${f} LIKE ${escapeValue(String((cond as any).value) + '%')}`;
    case 'endsWith': return `${f} LIKE ${escapeValue('%' + String((cond as any).value))}`;
    case 'between': {
      const [a, b] = (cond as any).values as [unknown, unknown];
      return `(${f} >= ${escapeValue(a)} AND ${f} <= ${escapeValue(b)})`;
    }
    case 'isNull': return `${f} = null`;
    case 'isNotNull': return `${f} != null`;
    case 'in':
    case 'nin': {
      const values = (cond as any).values as unknown[];
      const list = values.map(escapeValue).join(', ');
      return `${f} ${cond.op === 'in' ? 'IN' : 'NOT IN'} (${list})`;
    }
  }
}


