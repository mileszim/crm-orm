# crm-orm

Typed Node ORM for CRMs with Zod models, a `$`-operator where DSL, and a Salesforce dialect using an Ampersand transport. v0.1 focuses on typed read queries and SOQL rendering.

## Status (v0.1)
- Salesforce: typed SELECT with projections, where DSL, order, limit/offset. SOQL renderer included.
- Core: model registry (Zod + provider field mapping), query AST + builder, `$`-DSL normalization.
- HubSpot: stubs only.

Planned next: pagination helpers (cursor/unbounded), IN chunking, CRUD + Composite Graph, telemetry, error mapping polish, HubSpot search builder.

## Requirements
- Node 18+ (package enforces Node >=20)
- TypeScript 5+
- Zod for model schemas

## Install
```bash
npm install crm-orm zod
```

## Quick start
```ts
import { createORM, sf, AmpersandAdapter } from 'crm-orm';
import type { AmpersandTransportRequest, AmpersandTransportResponse } from 'crm-orm';
import { z } from 'zod';

// Implement or wrap your Ampersand client (must have a .request method)
class AmpersandPassthroughAPI {
  async request<T = unknown>(req: AmpersandTransportRequest): Promise<AmpersandTransportResponse<T>> {
    // delegate to your Ampersand instance
    throw new Error('wire me to Ampersand');
  }
}

const transport = new AmpersandAdapter(new AmpersandPassthroughAPI());

const orm = createORM({
  transport,
  salesforce: { version: '59.0', providerName: 'salesforce' },
});

// Define a Salesforce model (Zod schema + provider field mapping)
const Opportunity = sf.model({
  name: 'Opportunity',
  object: 'Opportunity',
  schema: z.object({
    id: z.string(),
    name: z.string(),
    amount: z.number().nullable(),
    createdDate: z.string(),
  }),
  fields: {
    id: { path: 'Id' },
    name: { path: 'Name' },
    amount: { path: 'Amount' },
    createdDate: { path: 'CreatedDate' },
  },
});

// Typed query
const opps = await orm
  .from(Opportunity)
  .select({ id: true, name: true, amount: true, createdDate: true })
  .where({ name: { $like: 'Acme%' }, amount: { $gte: 25000 } })
  .orderBy({ createdDate: 'desc' })
  .limit(100)
  .getMany();
```

## `$` Where DSL
Each model field is type-aware. Supported operators (by primitive):

- Strings: `$eq`, `$ne`, `$in`, `$nin`, `$like`, `$startsWith`, `$endsWith`, `$exists`
- Numbers: `$eq`, `$ne`, `$in`, `$nin`, `$gt`, `$gte`, `$lt`, `$lte`, `$between`, `$exists`
- Booleans: `$eq` (or bare boolean), `$exists`
- Dates/strings-as-dates: `$gt`, `$gte`, `$lt`, `$lte`, `$between`, `$exists`
- Nulls: `field: null` => `IS NULL`; `{ field: { $ne: null } }` => `IS NOT NULL`
- Logic: `$and`, `$or`, `$not`
- Raw escape: `$raw: string` (SOQL passthrough)

Examples:
```ts
// range
.where({ createdDate: { $between: ['2024-01-01', '2024-12-31'] } })

// nulls / exists
.where({ ownerId: null, amount: { $ne: null } })

// OR / AND
.where({ $or: [ { name: { $startsWith: 'Strategic ' } }, { amount: { $gte: 100000 } } ] })

// raw
.where({ $raw: "CALENDAR_YEAR(CreatedDate) = 2024" })
```

Note: IN chunking and nested relation filters are planned for v0.2+. For relation paths today, map the related field into your model via `fields` (e.g. `Account.Name`) and filter that mapped key.

## Sorting, limit/offset
```ts
.orderBy({ createdDate: 'desc', name: 'asc' })
.offset(0)
.limit(200)
```

Cursor/unbounded pagination helpers will arrive in v0.2.

## What gets sent to Salesforce (SOQL)
The ORM renders SOQL using your mapped `fields.path` and normalized filters.

- Input:
```ts
.select({ id: true, name: true, amount: true, createdDate: true })
.where({ name: { $like: 'Acme%' }, amount: { $gte: 25000 } })
.orderBy({ createdDate: 'desc' })
.limit(100)
```
- SOQL:
```sql
SELECT Id, Name, Amount, CreatedDate FROM Opportunity WHERE (Name LIKE 'Acme%' AND Amount >= 25000) ORDER BY CreatedDate DESC LIMIT 100
```

- Relation path + null/exists:
```ts
// fields: { ownerId: 'OwnerId', amount: 'Amount', accountName: 'Account.Name' }
.select({ ownerId: true, amount: true, accountName: true })
.where({ ownerId: null, amount: { $ne: null } })
```
```sql
SELECT OwnerId, Amount, Account.Name FROM Opportunity WHERE (OwnerId = null AND Amount != null)
```

- IN / NOT IN:
```ts
.where({ id: { $in: ['1', '2', '3'] } })
.where({ id: { $nin: ['x'] } })
```
```sql
SELECT Id, Name, Amount, CreatedDate FROM Opportunity WHERE Id IN ('1', '2', '3')
SELECT Id, Name, Amount, CreatedDate FROM Opportunity WHERE Id NOT IN ('x')
```

## Ampersand transport
All HTTP calls go through your Ampersand instance via the adapter:
```ts
import { AmpersandAdapter } from 'crm-orm';

const transport = new AmpersandAdapter({
  async request(req) {
    // forward to Ampersand and return { status, headers, data }
    return { status: 200, headers: {}, data: {} };
  },
});
```

Interface:
```ts
interface AmpersandTransportRequest {
  providerName: 'salesforce' | 'hubspot' | (string & {});
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  metadata?: { requestName?: string; userId?: string; organizationId?: string };
}
```

## API surface (v0.1)
```ts
// Create ORM
createORM({ transport, salesforce?: { version?: string; providerName?: 'salesforce' } })

// Define models
sf.model({ name, object, schema, fields, relations? })
hs.model(...) // stub

// Query
orm.from(Model)
  .select({ ... })
  .where({ ... })
  .orderBy({ ... })
  .limit(n)
  .offset(n)
  .getMany()
  .getOne()
```

## Roadmap
- M2: Pagination helpers (cursor/unbounded), IN chunking with concurrency.
- M3: Typed CRUD (insert/update/delete) + Composite Graph batching and references.
- M4: Telemetry hooks and normalized error mapping; introspect validators.
- M5: HubSpot search builder MVP.

## Development
```bash
npm run build
npm test
```

## License
MIT

