import * as React from "react";
import SimfinityClient from "@simtlix/simfinity-js-client";
import { looksLikeDateTimeField, type ValueResolver, type SchemaData } from "./introspection";

// ---------------------------------------------------------------------------
// Context & Provider
// ---------------------------------------------------------------------------

const SimfinityClientContext = React.createContext<SimfinityClient | null>(null);

export type SimfinityClientOptions = {
  /** Called before each GraphQL request; mutate `headers` to add auth (e.g. Authorization). */
  prepareHeaders?: (headers: Record<string, string>) => void;
};

export type SimfinityClientProviderProps = {
  endpoint: string;
  children: React.ReactNode;
  loadingFallback?: React.ReactNode;
  errorFallback?: (error: Error) => React.ReactNode;
  /** Passed as the second argument to `new SimfinityClient(endpoint, clientOptions)`. */
  clientOptions?: SimfinityClientOptions;
};

export function SimfinityClientProvider({ endpoint, children, loadingFallback, errorFallback, clientOptions }: SimfinityClientProviderProps) {
  const [client, setClient] = React.useState<SimfinityClient | null>(null);
  const [initError, setInitError] = React.useState<Error | null>(null);
  const clientOptionsRef = React.useRef(clientOptions);
  clientOptionsRef.current = clientOptions;

  React.useEffect(() => {
    let cancelled = false;
    const c = new SimfinityClient(endpoint, {
      prepareHeaders(headers) {
        clientOptionsRef.current?.prepareHeaders?.(headers);
      },
    });
    c.init()
      .then(() => { if (!cancelled) setClient(c); })
      .catch((err: unknown) => { if (!cancelled) setInitError(err instanceof Error ? err : new Error(String(err))); });
    return () => { cancelled = true; };
  }, [endpoint]);

  if (initError) {
    return <>{errorFallback ? errorFallback(initError) : (
      <div style={{ padding: 24, color: "red" }}>
        SimfinityClient initialization failed: {initError.message}
      </div>
    )}</>;
  }

  if (!client) {
    return <>{loadingFallback ?? (
      <div style={{ padding: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
        Initializing...
      </div>
    )}</>;
  }

  return (
    <SimfinityClientContext.Provider value={client}>
      {children}
    </SimfinityClientContext.Provider>
  );
}

export function useSimfinityClient(): SimfinityClient {
  const client = React.useContext(SimfinityClientContext);
  if (!client) throw new Error("useSimfinityClient must be used within SimfinityClientProvider");
  return client;
}

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type FilterItem = {
  field: string;
  operator: string;
  value: unknown;
};

type SortTerm = {
  field: string;
  order: "ASC" | "DESC";
};

type QueryState<T> = {
  data: T | null;
  loading: boolean;
  error: Error | null;
};

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

export function buildValueResolvers(
  client: SimfinityClient,
  typeName: string
): { valueResolvers: Record<string, ValueResolver>; selectionMeta: ReturnType<SimfinityClient["buildSelectionSet"]> } {
  const meta = client.buildSelectionSet(typeName);
  const resolvers: Record<string, ValueResolver> = {};

  const fieldsOfType = client.getFieldsOfType(typeName);

  for (const col of meta.columns) {
    const type = meta.fieldTypeByColumn[col];
    const isDate = client.isDateTimeScalar(type) || looksLikeDateTimeField(col);
    const isObjectCol = meta.sortFieldByColumn[col]?.includes(".");

    if (isObjectCol) {
      const displayField = meta.sortFieldByColumn[col].split(".").slice(1).join(".");
      const fieldInfo = fieldsOfType.find((f: { name: string }) => f.name === col);
      const isEmbedded = fieldInfo?.extensions?.relation?.embedded === true;

      resolvers[col] = (row: Record<string, unknown>) => {
        const v = row?.[col];
        if (v == null) return v;
        if (typeof v === "object") {
          const objVal = v as Record<string, unknown>;
          const dfVal = displayField ? objVal[displayField] : undefined;
          if (displayField) {
            const shouldFormatDate = client.isDateTimeScalar(type) || looksLikeDateTimeField(displayField);
            if (shouldFormatDate && (typeof dfVal === "string" || typeof dfVal === "number")) {
              const d = new Date(dfVal as string | number);
              if (!isNaN(d.getTime())) return d.toLocaleString();
            }
          }
          if (typeof dfVal === "string" || typeof dfVal === "number") return dfVal;
          const nm = objVal["name"];
          if (typeof nm === "string" || typeof nm === "number") return nm;
          const idVal = !isEmbedded ? objVal["id"] : undefined;
          if (typeof idVal === "string" || typeof idVal === "number") return idVal;
          return JSON.stringify(objVal);
        }
        return v;
      };
    } else if (isDate) {
      resolvers[col] = (row: Record<string, unknown>) => {
        const v = row?.[col];
        if (typeof v === "string" || typeof v === "number") {
          const d = new Date(v as string | number);
          return isNaN(d.getTime()) ? v : d.toLocaleString();
        }
        return v;
      };
    } else {
      resolvers[col] = (row: Record<string, unknown>) => row?.[col];
    }
  }

  resolvers["id"] = (row: Record<string, unknown>) => row?.["id"];

  return { valueResolvers: resolvers, selectionMeta: meta };
}

// ---------------------------------------------------------------------------
// useFind — paginated list query with filters & sort
// ---------------------------------------------------------------------------

export type UseFindOptions = {
  page?: number;
  size?: number;
  sort?: SortTerm[];
  filters?: FilterItem[];
  fields?: string;
  sortFieldByColumn?: Record<string, string>;
  fieldTypeByColumn?: Record<string, string>;
  pause?: boolean;
};

export type UseFindResult<T = Record<string, unknown>> = QueryState<T[]> & {
  totalCount: number;
  refetch: () => void;
};

export function useFind<T = Record<string, unknown>>(
  typeName: string | null,
  options: UseFindOptions = {}
): UseFindResult<T> {
  const client = useSimfinityClient();
  const { page = 0, size = 10, sort, filters, fields, sortFieldByColumn, fieldTypeByColumn, pause } = options;
  const [state, setState] = React.useState<QueryState<T[]> & { totalCount: number }>({
    data: null, loading: !pause, error: null, totalCount: 0,
  });
  const [refetchKey, setRefetchKey] = React.useState(0);

  const sortJson = JSON.stringify(sort ?? []);
  const filtersJson = JSON.stringify(filters ?? []);

  React.useEffect(() => {
    if (!typeName || pause) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    let cancelled = false;
    setState(prev => ({ ...prev, loading: true, error: null }));

    const builder = client.find(typeName);

    if (fields) {
      builder.fields(fields);
    } else {
      builder.autoSelect();
    }

    builder.page(page + 1, size, true);

    const parsedSort: SortTerm[] = JSON.parse(sortJson);
    for (const s of parsedSort) {
      const resolvedField = sortFieldByColumn?.[s.field] ?? s.field;
      builder.sort(resolvedField, s.order);
    }

    const parsedFilters: FilterItem[] = JSON.parse(filtersJson);
    for (const f of parsedFilters) {
      const resolvedSortField = sortFieldByColumn?.[f.field];
      const isObjectColumn = resolvedSortField ? resolvedSortField.includes(".") : false;

      if (isObjectColumn) {
        const pathWithin = resolvedSortField!.split(".").slice(1).join(".");
        builder.where(f.field, [{ path: pathWithin, operator: f.operator, value: f.value }]);
      } else {
        builder.where(f.field, f.operator, f.value);
      }
    }

    builder.execWithMeta()
      .then((result: { data: unknown; extensions: Record<string, unknown> | null }) => {
        if (cancelled) return;
        const data = result.data as T[];
        const count = typeof result.extensions?.count === "number" ? result.extensions.count as number : 0;
        setState({ data: Array.isArray(data) ? data : [], loading: false, error: null, totalCount: count });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({ data: null, loading: false, error: err instanceof Error ? err : new Error(String(err)), totalCount: 0 });
      });

    return () => { cancelled = true; };
  }, [client, typeName, page, size, sortJson, filtersJson, fields, sortFieldByColumn, fieldTypeByColumn, pause, refetchKey]);

  const refetch = React.useCallback(() => setRefetchKey(k => k + 1), []);

  return { ...state, refetch };
}

// ---------------------------------------------------------------------------
// useEntityById — single entity fetch
// ---------------------------------------------------------------------------

export type UseEntityByIdResult<T = Record<string, unknown>> = QueryState<T> & {
  refetch: () => void;
};

export function useEntityById<T = Record<string, unknown>>(
  typeName: string | null,
  id: string | null | undefined,
  fields?: string
): UseEntityByIdResult<T> {
  const client = useSimfinityClient();
  const [state, setState] = React.useState<QueryState<T>>({ data: null, loading: !!id, error: null });
  const [refetchKey, setRefetchKey] = React.useState(0);

  React.useEffect(() => {
    if (!typeName || !id) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState(prev => ({ ...prev, loading: true, error: null }));

    client.getById(typeName, id, fields)
      .then((data: unknown) => {
        if (!cancelled) setState({ data: data as T, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ data: null, loading: false, error: err instanceof Error ? err : new Error(String(err)) });
      });

    return () => { cancelled = true; };
  }, [client, typeName, id, fields, refetchKey]);

  const refetch = React.useCallback(() => setRefetchKey(k => k + 1), []);

  return { ...state, refetch };
}

// ---------------------------------------------------------------------------
// useFindByParent — collection items filtered by parent
// ---------------------------------------------------------------------------

export type UseFindByParentOptions = {
  page?: number;
  size?: number;
  sort?: SortTerm[];
  excludeIds?: string[];
  fields?: string;
  pause?: boolean;
  sortFieldByColumn?: Record<string, string>;
};

export type UseFindByParentResult<T = Record<string, unknown>> = UseFindResult<T>;

export function useFindByParent<T = Record<string, unknown>>(
  typeName: string | null,
  connectionField: string | null,
  parentId: string | null | undefined,
  options: UseFindByParentOptions = {}
): UseFindByParentResult<T> {
  const client = useSimfinityClient();
  const { page = 0, size = 10, sort, excludeIds, fields, pause, sortFieldByColumn } = options;
  const [state, setState] = React.useState<QueryState<T[]> & { totalCount: number }>({
    data: null, loading: !pause && !!parentId, error: null, totalCount: 0,
  });
  const [refetchKey, setRefetchKey] = React.useState(0);

  const sortJson = JSON.stringify(sort ?? []);
  const excludeJson = JSON.stringify(excludeIds ?? []);

  React.useEffect(() => {
    if (!typeName || !connectionField || !parentId || pause) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    let cancelled = false;
    setState(prev => ({ ...prev, loading: true, error: null }));

    const builder = client.findByParent(typeName, connectionField, parentId);

    if (fields) {
      builder.fields(fields);
    } else {
      builder.autoSelect();
    }

    builder.page(page + 1, size, true);

    const parsedSort: SortTerm[] = JSON.parse(sortJson);
    if (parsedSort.length > 0) {
      builder.clearSort();
      for (const s of parsedSort) {
        const resolvedField = sortFieldByColumn?.[s.field] ?? s.field;
        builder.sort(resolvedField, s.order);
      }
    }

    const parsedExclude: string[] = JSON.parse(excludeJson);
    if (parsedExclude.length > 0) {
      builder.where("id", "NIN", parsedExclude);
    }

    builder.execWithMeta()
      .then((result: { data: unknown; extensions: Record<string, unknown> | null }) => {
        if (cancelled) return;
        const data = result.data as T[];
        const count = typeof result.extensions?.count === "number" ? result.extensions.count as number : 0;
        setState({ data: Array.isArray(data) ? data : [], loading: false, error: null, totalCount: count });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({ data: null, loading: false, error: err instanceof Error ? err : new Error(String(err)), totalCount: 0 });
      });

    return () => { cancelled = true; };
  }, [client, typeName, connectionField, parentId, page, size, sortJson, excludeJson, fields, pause, sortFieldByColumn, refetchKey]);

  const refetch = React.useCallback(() => setRefetchKey(k => k + 1), []);

  return { ...state, refetch };
}

// ---------------------------------------------------------------------------
// useSearch — FK search-as-you-type
// ---------------------------------------------------------------------------

export type UseSearchOptions = {
  displayField?: string;
  page?: number;
  size?: number;
  pause?: boolean;
};

export type UseSearchResult<T = Record<string, unknown>> = QueryState<T[]>;

export function useSearch<T = Record<string, unknown>>(
  typeName: string | null,
  searchTerm: string,
  options: UseSearchOptions = {}
): UseSearchResult<T> {
  const client = useSimfinityClient();
  const { displayField, page = 1, size = 10, pause } = options;
  const [state, setState] = React.useState<QueryState<T[]>>({ data: null, loading: false, error: null });

  React.useEffect(() => {
    if (!typeName || pause || searchTerm.length < 1) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState(prev => ({ ...prev, loading: true, error: null }));

    client.search(typeName, searchTerm, { displayField, page, size })
      .then((data: unknown) => {
        if (!cancelled) setState({ data: data as T[], loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ data: null, loading: false, error: err instanceof Error ? err : new Error(String(err)) });
      });

    return () => { cancelled = true; };
  }, [client, typeName, searchTerm, displayField, page, size, pause]);

  return state;
}

// ---------------------------------------------------------------------------
// Backward-compat bridge: build a SchemaData-shaped object from the client's
// internal type registry. Used by FormFieldRenderer until Phase 5 migrates it.
// ---------------------------------------------------------------------------

export function getSchemaDataCompat(client: SimfinityClient): SchemaData {
  const types = client.getTypes() as Record<string, unknown>;
  const typeArray = Object.values(types).map((t: unknown) => {
    const typed = t as { kind: string; name: string; fields?: unknown[]; enumValues?: { name: string }[] };
    return {
      kind: typed.kind,
      name: typed.name,
      fields: typed.fields as SchemaData["__schema"]["types"][number]["fields"],
      enumValues: typed.enumValues,
    };
  });
  return { __schema: { types: typeArray } };
}
