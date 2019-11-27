import { IColumnInfo, IGqlMigrationResult } from "../../interfaces";
import {
  IColumnExtension,
  IColumnExtensionContext,
  IColumnExtensionDeleteContext,
  IPropertieValidationResult,
  IQueryFieldData,
  IMutationFieldData
} from "../IColumnExtension";
import { IDbMutationColumn, IDbMutation } from "../../DbSchemaInterface";
import * as uuidValidate from "uuid-validate";
import { findTableById, getPgSelector, findColumnById } from "../../helpers";
import { PoolClient } from "@fullstack-one/core";
import { ICompiledExpression } from "../../ExpressionCompiler";

export const columnExtensionOneToMany: IColumnExtension = {
  type: "oneToMany",
  validateProperties: (context: IColumnExtensionContext) => {
    const result: IPropertieValidationResult = {
      errors: [],
      warnings: []
    };

    if (context.column.properties == null) {
      result.errors.push({
        message: `Properties are required for oneToMany column '${context.table.schema}.${context.table.name}.${context.column.name}'.`,
        meta: {
          tableId: context.table.id,
          columnId: context.column.id
        }
      });
      return result;
    }
    const properties = context.column.properties;

    Object.keys(properties).forEach((key) => {
      if (["foreignTableId", "foreignColumnId"].indexOf(key) < 0) {
        result.errors.push({
          message: `Unknown property '${key}' on '${context.table.schema}.${context.table.name}.${context.column.name}' for type 'oneToMany'.`,
          meta: {
            tableId: context.table.id,
            columnId: context.column.id
          }
        });
      }
    });
    if (properties.foreignTableId == null || uuidValidate(properties.foreignTableId) !== true) {
      result.errors.push({
        message: `The property 'foreignTableId' must be an uuid on '${context.table.schema}.${context.table.name}.${context.column.name}' for type 'oneToMany'.`,
        meta: {
          tableId: context.table.id,
          columnId: context.column.id
        }
      });
    } else {
      const foreignTable = findTableById(context.schema, properties.foreignTableId);
      if (foreignTable == null) {
        result.errors.push({
          message: `Could not find foreignTableId '${properties.foreignTableId}' on '${context.table.schema}.${context.table.name}.${context.column.name}' for type 'oneToMany'.`,
          meta: {
            tableId: context.table.id,
            columnId: context.column.id
          }
        });
      } else {
        if (properties.foreignColumnId == null || uuidValidate(properties.foreignColumnId) !== true) {
          result.errors.push({
            message: `The property 'foreignColumnId' must be an uuid on '${context.table.schema}.${context.table.name}.${context.column.name}' for type 'oneToMany'.`,
            meta: {
              tableId: context.table.id,
              columnId: context.column.id
            }
          });
        } else {
          if (findColumnById(foreignTable, properties.foreignColumnId) == null) {
            result.errors.push({
              message: `The table '${foreignTable.schema}.${foreignTable.name}' must have column '${properties.foreignColumnId}' for relation on '${context.table.schema}.${context.table.name}.${context.column.name}' for type 'oneToMany'.`,
              meta: {
                tableId: context.table.id,
                columnId: context.column.id
              }
            });
          }
        }
      }
    }

    return result;
  },
  // Get the columnName in DB (e.g. userId instead of user). Overwrite and return null if it is a virtual column
  getPgColumnName: (context: IColumnExtensionContext): string => {
    return null;
  },
  getQueryFieldData: (
    context: IColumnExtensionContext,
    localTableAlias: string,
    getCompiledExpressionById: (appliedExpressionId) => ICompiledExpression
  ): IQueryFieldData => {
    const foreignTable = findTableById(context.schema, context.column.properties.foreignTableId);
    const foreignColumn = findColumnById(foreignTable, context.column.properties.foreignColumnId);

    return {
      field: `${context.column.name}: [${foreignTable.name}!]!`,
      fieldName: context.column.name,
      pgSelectExpression: `TRUE`,
      viewColumnName: context.column.name,
      canBeFilteredAndOrdered: false,
      queryFieldMeta: {
        oneToMany: {
          foreignColumnName: `${foreignColumn.name}Id`
        }
      }
    };
  },
  getMutationFieldData: (
    context: IColumnExtensionContext,
    localTableAlias: string,
    mutation: IDbMutation,
    mutationColumn: IDbMutationColumn
  ): IMutationFieldData => {
    throw new Error("Column-type oneToMany cannot be mutated.");
  },
  create: async (context: IColumnExtensionContext): Promise<IGqlMigrationResult> => {
    return {
      errors: [],
      warnings: [],
      commands: []
    };
  },
  update: async (context: IColumnExtensionContext, columnInfo: IColumnInfo, dbClient: PoolClient): Promise<IGqlMigrationResult> => {
    return {
      errors: [],
      warnings: [],
      commands: []
    };
  },
  cleanUp: async (context: IColumnExtensionDeleteContext, columnInfo: IColumnInfo, dbClient: PoolClient): Promise<IGqlMigrationResult> => {
    return {
      errors: [],
      warnings: [],
      commands: []
    };
  }
};