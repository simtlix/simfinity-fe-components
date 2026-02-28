export type IntrospectionTypeRef = {
  kind: string | null;
  name?: string | null;
  ofType?: IntrospectionTypeRef | null;
};

export function isScalarOrEnum(kind?: string | null): boolean {
  return kind === "SCALAR" || kind === "ENUM";
}

export function looksLikeDateTimeField(fieldName: string): boolean {
  const n = fieldName.toLowerCase();
  return /date|time|at$/.test(n);
}

export type SchemaField = {
  name: string;
  type: IntrospectionTypeRef;
  extensions?: {
    relation?: {
      displayField?: string | null;
      embedded?: boolean | null;
      connectionField?: string | null;
    } | null;
    stateMachine?: boolean | null;
    readOnly?: boolean | null;
  } | null;
};

export type SchemaObjectType = {
  kind: string;
  name: string;
  fields?: SchemaField[];
  enumValues?: { name: string }[];
};

export type SchemaData = {
  __schema: {
    queryType?: { name?: string } | null;
    types: SchemaObjectType[];
  };
};

export type ValueResolver = (row: Record<string, unknown>) => unknown;
