import type { GridFilterModel } from "@mui/x-data-grid";
import type { FilterItem } from "./simfinityClient";

export const OPERATOR_MAP: Record<string, string> = {
  contains: 'LIKE', startsWith: 'LIKE', endsWith: 'LIKE', equals: 'EQ', '=': 'EQ', is: 'EQ',
  '!=': 'NE', not: 'NE', greaterThan: 'GT', '>': 'GT', greaterThanOrEqual: 'GTE', '>=': 'GTE',
  lessThan: 'LT', '<': 'LT', lessThanOrEqual: 'LTE', '<=': 'LTE',
  isAnyOf: 'IN', in: 'IN', nin: 'NIN', btw: 'BTW',
};

export function gridFilterModelToFilterItems(model: GridFilterModel): FilterItem[] {
  if (!model?.items?.length) return [];
  const items: FilterItem[] = [];
  for (const item of model.items) {
    if (!item.field || item.value == null || item.value === '') continue;
    const operator = OPERATOR_MAP[item.operator ?? 'equals'] ?? 'EQ';
    items.push({ field: String(item.field), operator, value: item.value });
  }
  return items;
}
