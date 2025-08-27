import { z } from 'zod';
import { AmpersandTransport, DialectExecutorDependencies, ModelDef, ModelShape, ProviderName, QueryContextMeta, SelectAst } from '../../core/types';
import { QueryExecutor } from '../../core/query-builder';
import { buildSOQL } from './soql-builder';
import { mapHttpError } from '../../core/errors';

export interface SalesforceConfig {
  version: string;
  providerName?: ProviderName;
}

export class SalesforceQueryExecutor implements QueryExecutor {
  constructor(private readonly deps: DialectExecutorDependencies, private readonly config: SalesforceConfig) {}

  async executeSelect<TModel extends ModelDef<any>>(ast: SelectAst<TModel>, ctx?: QueryContextMeta): Promise<unknown[]> {
    const soql = buildSOQL(ast);
    const url = `/services/data/v${this.config.version}/query`;
    const query = { q: soql } as const;
    const res = await this.deps.transport.request<{ records: unknown[]; done: boolean; nextRecordsUrl?: string }>({
      providerName: (this.config.providerName || 'salesforce') as any,
      method: 'GET',
      url,
      query,
      metadata: ctx?.metadata,
    });
    if (res.status >= 400) throw mapHttpError(res.status, 'Salesforce query error');
    return res.data.records || [];
  }
}

export function createSalesforceExecutor(transport: AmpersandTransport, config: SalesforceConfig): SalesforceQueryExecutor {
  return new SalesforceQueryExecutor({ transport }, config);
}


