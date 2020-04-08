import { FieldDefinitionNode } from "graphql";

export function createIdArrayField(fieldName: string, isNonNullType: boolean = false): FieldDefinitionNode {
  const field: any = {
    kind: "FieldDefinition",
    name: {
      kind: "Name",
      value: fieldName
    },
    arguments: [],
    type: {
      kind: "ListType",
      type: {
        kind: "NonNullType",
        type: {
          kind: "NamedType",
          name: {
            kind: "Name",
            value: "ID"
          }
        }
      }
    },
    directives: []
  };

  if (isNonNullType === true) {
    field.type = {
      kind: "NonNullType",
      type: field.type
    };
  }

  return field;
}
