import { z } from 'zod';
import { ModelDef, ModelFieldDef, ProviderName } from './types';

export interface BaseModelConfig<TSchema extends z.ZodTypeAny> {
  name: string;
  object: string;
  schema: TSchema;
  fields: Record<string, ModelFieldDef>;
  relations?: ModelDef<any>['relations'];
}

export function createModelFactory(provider: ProviderName) {
  return function model<TSchema extends z.ZodTypeAny>(cfg: BaseModelConfig<TSchema>): ModelDef<TSchema> {
    return {
      name: cfg.name,
      object: cfg.object,
      schema: cfg.schema,
      fields: cfg.fields,
      relations: cfg.relations,
      provider,
    };
  };
}

export interface ModelRegistry {
  register<TSchema extends z.ZodTypeAny>(model: ModelDef<TSchema>): void;
  get(name: string): ModelDef<any> | undefined;
}

export function createRegistry(): ModelRegistry {
  const byName = new Map<string, ModelDef<any>>();
  return {
    register(model) {
      byName.set(model.name, model);
    },
    get(name) {
      return byName.get(name);
    },
  };
}


