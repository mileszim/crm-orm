import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sf } from '../src/salesforce';
import { buildSOQL } from '../src/dialects/salesforce/soql-builder';
import { QueryBuilder } from '../src/core/query-builder';
import { createSalesforceExecutor } from '../src/dialects/salesforce/driver';
import { AmpersandTransport, ModelDef } from '../src/core/types';

// Fake transport to avoid real calls
class FakeTransport implements AmpersandTransport {
  async request<TResponse = unknown>(): Promise<{ status: number; headers: Record<string, string | string[]>; data: TResponse; }> {
    return { status: 200, headers: {}, data: { records: [], done: true } as unknown as TResponse };
  }
}

const Opportunity = sf.model({
  name: 'Opportunity',
  object: 'Opportunity',
  schema: {} as any,
  fields: {
    id: { path: 'Id' },
    name: { path: 'Name' },
    amount: { path: 'Amount' },
    createdDate: { path: 'CreatedDate' },
  },
});

function compile(model: ModelDef<any>, qb: (q: QueryBuilder<any>) => QueryBuilder<any>) {
  const exec = createSalesforceExecutor(new FakeTransport(), { version: '59.0' });
  const q = qb(new QueryBuilder(model as any, exec as any));
  // @ts-expect-error access private
  const ast = q["buildAst" as any]();
  return buildSOQL(ast);
}

describe('SOQL builder', () => {
  it('renders select + where + order + limit', () => {
    const sql = compile(Opportunity, q =>
      q
        .select({ id: true, name: true, amount: true, createdDate: true })
        .where({ name: { $like: 'Acme%' }, amount: { $gte: 25000 } as any })
        .orderBy({ createdDate: 'desc' } as any)
        .limit(100)
    );
    assert.equal(
      sql,
      "SELECT Id, Name, Amount, CreatedDate FROM Opportunity WHERE (Name LIKE 'Acme%' AND Amount >= 25000) ORDER BY CreatedDate DESC LIMIT 100"
    );
  });

  it('renders relation path and nulls/exists', () => {
    const Account = sf.model({
      name: 'Account',
      object: 'Account',
      schema: {} as any,
      fields: { id: { path: 'Id' }, name: { path: 'Name' } },
    });
    const Opp = sf.model({
      name: 'Opp',
      object: 'Opportunity',
      schema: {} as any,
      fields: { ownerId: { path: 'OwnerId' }, amount: { path: 'Amount' }, accountName: { path: 'Account.Name' } },
    });

    const sql = compile(Opp, q =>
      q
        .select({ ownerId: true, amount: true, accountName: true })
        .where({ ownerId: null, amount: { $ne: null } as any })
    );
    assert.equal(
      sql,
      'SELECT OwnerId, Amount, Account.Name FROM Opportunity WHERE (OwnerId = null AND Amount != null)'
    );
  });

  it('renders IN and NOT IN', () => {
    const sql = compile(Opportunity, q => q.where({ id: { $in: ['1', '2', '3'] } as any }));
    assert.equal(sql, "SELECT Id, Name, Amount, CreatedDate FROM Opportunity WHERE Id IN ('1', '2', '3')");

    const sql2 = compile(Opportunity, q => q.where({ id: { $nin: ['x'] } as any }));
    assert.equal(sql2, "SELECT Id, Name, Amount, CreatedDate FROM Opportunity WHERE Id NOT IN ('x')");
  });
});


