import { IParsedResolveInfo } from "../types";
import { IMutationBuildObject, IMutationInputObject } from "./types";
import parseValue from "./parseValue";
import { ReturnIdHandler } from "../../resolverTransactions/ReturnIdHandler";
import { IMutationViewMeta, IDefaultResolverMeta } from "../../RuntimeInterfaces";

export default function resolveCreateMutation(
  defaultResolverMeta: IDefaultResolverMeta,
  query: IParsedResolveInfo<IMutationInputObject>,
  mutation: IMutationViewMeta,
  returnIdHandler: ReturnIdHandler
): IMutationBuildObject {
  const fieldNames: string = Object.keys(query.args.input)
    .map((name) => `"${name}"`)
    .join(", ");

  const values: string[] = [];
  const valuesString: string = Object.values(query.args.input)
    .map((value, index) => {
      const finalValue: string | null = parseValue(value, returnIdHandler);

      if (finalValue != null) {
        values.push(finalValue);
      }
      return `$${index + 1}`;
    })
    .join(", ");

  return {
    sql: `INSERT INTO "${defaultResolverMeta.viewsSchemaName}"."${mutation.viewName}" (${fieldNames}) VALUES (${valuesString});`,
    values,
    mutation,
    id: returnIdHandler.getReturnId(query.args.input.id || null),
  };
}
