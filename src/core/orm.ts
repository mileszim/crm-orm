import { createModelFactory } from './schema';
import { ORMConfig } from './types';
import { ORMQueryAPI, QueryExecutor } from './query-builder';
import { createSalesforceExecutor, SalesforceQueryExecutor } from '../dialects/salesforce/driver';

export function createORM(cfg: ORMConfig) {
  const sf = { model: createModelFactory('salesforce') } as const;
  const hs = { model: createModelFactory('hubspot') } as const;

  const executors = {
    salesforce: cfg.salesforce ? createSalesforceExecutor(cfg.transport, { version: cfg.salesforce.version || '59.0', providerName: cfg.salesforce.providerName }) : undefined,
  } as const;

  function from<TModel extends { provider: any }>(model: TModel) {
    const provider = model.provider;
    if (provider === 'salesforce') {
      const exec = executors.salesforce as unknown as QueryExecutor;
      if (!exec) throw new Error('Salesforce executor is not configured');
      return new ORMQueryAPI(model as any, exec);
    }
    throw new Error(`Provider not supported for from(): ${String(provider)}`);
  }

  return { sf, hs, from, config: cfg } as const;
}

export type ORM = ReturnType<typeof createORM>;


