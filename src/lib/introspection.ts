import { gql } from "graphql-tag";

export const INTROSPECTION_QUERY = gql`
  query IntrospectionQuery {
    __schema {
      queryType { name }
      types {
        kind
        name
        fields {
          name
          type {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                  ofType {
                    kind
                    name
                  }
                }
              }
            }
          }
          extensions {
            relation {
              displayField
              embedded
              connectionField
            }
            stateMachine
          }
        }
        enumValues {
          name
        }
      }
    }
  }
`;

export function isEntityListQueryField(fieldName: string): boolean {
  // Heuristic: simfinity list queries are usually pluralized names (e.g., series, seasons, episodes, stars)
  // Additionally, simfinity generates single-item queries with singular name (e.g., serie, season).
  // We'll filter for lowercase plural-ish names that aren't prefixed with __.
  if (!fieldName) return false;
  if (fieldName.startsWith("__")) return false;
  // basic plural hint: ends with s
  return /s$/.test(fieldName);
}

export type IntrospectionTypeRef = {
  kind: string | null;
  name?: string | null;
  ofType?: IntrospectionTypeRef | null;
};

export function unwrapNamedType(typeRef?: IntrospectionTypeRef | null): string | null {
  let current: IntrospectionTypeRef | undefined | null = typeRef;
  while (current && current.kind && current.kind !== "SCALAR" && current.kind !== "OBJECT" && current.kind !== "ENUM") {
    current = current.ofType ?? null;
  }
  return current?.name ?? null;
}

export function isScalarOrEnum(kind?: string | null): boolean {
  return kind === "SCALAR" || kind === "ENUM";
}

export function isListType(typeRef?: IntrospectionTypeRef | null): boolean {
  let current: IntrospectionTypeRef | undefined | null = typeRef;
  while (current) {
    if (current.kind === "LIST") return true;
    current = current.ofType ?? null;
  }
  return false;
}

export function isListTypeOf(typeRef?: IntrospectionTypeRef | null, ofType?: string | null): boolean {
  let current: IntrospectionTypeRef | undefined | null = typeRef;
  while (current) {
    if (current.kind === "LIST" && current.ofType?.name === ofType) return true;
    current = current.ofType ?? null;
  }
  return false;
}

// Helper function to extract actual scalar type from validated scalar names
function getActualScalarType(name?: string | null): string | null {
  if (!name) return null;
  // Handle Simfinity validated scalars (e.g., "SeasonNumber_Int" -> "Int")
  return name.includes('_') ? name.split('_').pop() || name : name;
}

// Heuristics to detect date/time scalars and fields
export function isDateTimeScalarName(name?: string | null): boolean {
  if (!name) return false;
  const actualType = getActualScalarType(name);
  if (!actualType) return false;
  
  const normalized = actualType.toLowerCase();
  return (
    normalized === "date" ||
    normalized === "datetime" ||
    normalized === "timestamp" ||
    normalized === "isodate" ||
    normalized === "graphqldate" ||
    normalized === "graphqldatetime"
  );
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

export function getQueryType(schema: SchemaData): SchemaObjectType | undefined {
  const queryTypeName = schema.__schema.queryType?.name;
  return schema.__schema.types.find((t) => t.name === queryTypeName);
}

export function getListEntityFieldNamesOfType(schema: SchemaData, ofType?: string | null): string[] {
  const queryType = getQueryType(schema);
  if (!queryType?.fields) return [];
  return queryType.fields
    .filter((f) => isListTypeOf(f.type, ofType))
    .map((f) => f.name)
    .sort((a, b) => a.localeCompare(b));
}

export function getListEntityFieldNames(schema: SchemaData): string[] {
  const queryType = getQueryType(schema);
  if (!queryType?.fields) return [];
  return queryType.fields
    .filter((f) => isListType(f.type) && !f.name.endsWith('_aggregate'))
    .map((f) => f.name)
    .sort((a, b) => a.localeCompare(b));
}

export function getTypeByName(schema: SchemaData, name?: string | null): SchemaObjectType | undefined {
  if (!name) return undefined;
  return schema.__schema.types.find((t) => t.name === name);
}

export function getElementTypeNameOfListField(schema: SchemaData, listFieldName: string): string | null {
  const queryType = getQueryType(schema);
  const f = queryType?.fields?.find((field) => field.name === listFieldName);
  if (!f) return null;
  return unwrapNamedType(f.type);
}

export type ValueResolver = (row: Record<string, unknown>) => unknown;

export function buildSelectionSetForObjectType(
  schema: SchemaData,
  objectTypeName: string
): { selection: string; columns: string[]; valueResolvers: Record<string, ValueResolver>; sortFieldByColumn: Record<string, string>; fieldTypeByColumn: Record<string, string> } {
  const type = getTypeByName(schema, objectTypeName);
  const columns: string[] = [];
  const valueResolvers: Record<string, ValueResolver> = {};
  const sortFieldByColumn: Record<string, string> = {};
  const fieldTypeByColumn: Record<string, string> = {};
  if (!type?.fields) return { selection: "id", columns: ["id"], valueResolvers, sortFieldByColumn, fieldTypeByColumn };

  const fieldSelections: string[] = [];
  for (const field of type.fields) {
    const { name, type: t } = field;
    // Skip lists per requirement
    if (isListType(t)) continue;

    // Determine the named type and kind
    let current: IntrospectionTypeRef | null | undefined = t;
    while (current?.ofType) {
      current = current.ofType;
    }
    const kind = current?.kind ?? t.kind;
    const namedTypeName = current?.name ?? null;

    if (isScalarOrEnum(kind)) {
      fieldSelections.push(name);
      if (name !== "id") {
        columns.push(name);
      }
      const shouldFormatDate = isDateTimeScalarName(namedTypeName) || looksLikeDateTimeField(name);
      valueResolvers[name] = (row: Record<string, unknown>) => {
        const v = row?.[name as keyof typeof row];
        if (!shouldFormatDate) return v;
        if (typeof v === "string" || typeof v === "number") {
          const d = new Date(v as string | number);
          return isNaN(d.getTime()) ? v : d.toLocaleString();
        }
        return v;
      };
      sortFieldByColumn[name] = name;
      fieldTypeByColumn[name] = namedTypeName ?? kind ?? "SCALAR";
    } else if (kind === "OBJECT" && namedTypeName) {
      // Prefer displayField from Simfinity extensions; fallback to name, then first scalar field; include id only if not embedded and present
      const objType = getTypeByName(schema, namedTypeName);
      const objFields = objType?.fields ?? [];
      const objFieldNames = new Set(objFields.map((f) => f.name));
      const displayField = field.extensions?.relation?.displayField ?? undefined;
      const isEmbedded = field.extensions?.relation?.embedded === true;

      // Choose display field
      let chosenDisplay: string | undefined = undefined;
      if (displayField && objFieldNames.has(displayField)) {
        chosenDisplay = displayField;
      } else if (objFieldNames.has("name")) {
        chosenDisplay = "name";
      } else {
        const firstScalar = objFields.find((f) => !isListType(f.type) && isScalarOrEnum(unwrapNamedType(f.type) ? getTypeByName(schema, unwrapNamedType(f.type)!)?.kind ?? undefined : undefined));
        // The above tries to find a scalar/enum named field; fallback handled below if undefined
        chosenDisplay = firstScalar?.name ?? undefined;
      }

      // Build sub selection
      const subFields = new Set<string>();
      if (chosenDisplay) subFields.add(chosenDisplay);
      if (!isEmbedded && objFieldNames.has("id")) subFields.add("id");
      // Ensure at least one subfield to avoid GraphQL errors
      if (subFields.size === 0) {
        if (objFieldNames.has("id") && !isEmbedded) subFields.add("id");
        else if (objFieldNames.has("name")) subFields.add("name");
        else if (objFields[0]) subFields.add(objFields[0].name);
      }
      const subSelection = Array.from(subFields).join(" ");
      fieldSelections.push(`${name} { ${subSelection} }`);
      columns.push(name);
      valueResolvers[name] = (row: Record<string, unknown>) => {
        const v = row?.[name];
        if (v == null) return v;
        if (typeof v === "object") {
          const objVal = v as Record<string, unknown>;
          const dfVal = chosenDisplay ? objVal[chosenDisplay] : undefined;
          // If display field looks like a date, format in local time
          if (chosenDisplay) {
            const displayTypeName = unwrapNamedType(objFields.find((f) => f.name === chosenDisplay)?.type);
            const shouldFormatDate = isDateTimeScalarName(displayTypeName) || looksLikeDateTimeField(chosenDisplay);
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
      // For sorting, prefer dot notation to the chosen display field when available
      if (chosenDisplay) {
        sortFieldByColumn[name] = `${name}.${chosenDisplay}`;
        const displayType = unwrapNamedType(objFields.find((f) => f.name === chosenDisplay)?.type);
        fieldTypeByColumn[name] = displayType ?? "OBJECT";
      } else {
        sortFieldByColumn[name] = name;
        fieldTypeByColumn[name] = "OBJECT";
      }
    }
  }

  // Ensure id is included if present
  // Ensure id is present in selection for stable keys, but do not include it as a column
  const hasIdField = type.fields.some((f) => f.name === "id");
  if (hasIdField && !fieldSelections.includes("id")) {
    fieldSelections.unshift("id");
    valueResolvers["id"] = (row: Record<string, unknown>) => row?.["id"];
  }

  const selection = fieldSelections.join("\n");
  return { selection, columns, valueResolvers, sortFieldByColumn, fieldTypeByColumn };
}

export function isNumericScalarName(name?: string | null): boolean {
  if (!name) return false;
  const actualType = getActualScalarType(name);
  if (!actualType) return false;
  
  const n = actualType.toLowerCase();
  return (
    n === "int" ||
    n === "float" ||
    n === "idnumber" // fallback if custom
  );
}

export function isBooleanScalarName(name?: string | null): boolean {
  if (!name) return false;
  const actualType = getActualScalarType(name);
  if (!actualType) return false;
  
  return actualType.toLowerCase() === "boolean";
}




