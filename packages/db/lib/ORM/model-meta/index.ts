import * as _ from "lodash";
import checkAndAdjustColumnOptions from "./check-and-adjust-column-options";
import { generateSdl } from "./generateSdl";
import { IModelMeta, IEntityMeta, IColumnMeta, TColumnOptions } from "./types";

export { TColumnOptions } from "./types";

const modelMeta: IModelMeta = {
  entities: {},
  enums: {}
};

function registerEnum(name: string, enumObj: object): void {
  const values: string[] = Object.entries(enumObj)
    .filter(([key, value]) => typeof value === "string")
    .map(([key, value]) => value);
  if (modelMeta.enums[name] != null) {
    if (_.isEqual(modelMeta.enums[name].values.sort(), values.sort()) === true) return;
    throw Error(`
      orm.model.meta.enum.duplicate.name: ${name} with values ${modelMeta.enums[name].values} already exists.
      New enum with values ${values} cannot be registerd.
    `);
  }
  modelMeta.enums[name] = { name, values };
}

// ============= EntityMeta

function createEntityMetaIfNotExists(entityName: string): IEntityMeta {
  if (modelMeta.entities[entityName] == null) {
    modelMeta.entities[entityName] = {
      name: entityName,
      columns: {},
      synchronized: true
    };
  }
  return modelMeta.entities[entityName];
}

export function enhanceEntityMeta(entityName: string, entityMeta: IEntityMeta): void {
  const currentEntityMeta = createEntityMetaIfNotExists(entityName);
  modelMeta.entities[entityName] = { name: entityName, ...currentEntityMeta, ...entityMeta };
}

export function addEntityMeta(entityName: string): void {
  createEntityMetaIfNotExists(entityName);
}

export function setEntitySynchronizedTrue(entityName: string): void {
  const entityMeta = createEntityMetaIfNotExists(entityName);
  entityMeta.synchronized = true;
}

// ============= ColumnMeta

function createColumnMetaIfNotExists(entityName: string, columnName: string): IColumnMeta {
  const entitiyMeta = createEntityMetaIfNotExists(entityName);
  return entitiyMeta.columns[columnName] == null ? createColumnMeta(entityName, columnName) : entitiyMeta.columns[columnName];
}

export function createColumnMeta(entityName: string, columnName: string, columnOptions: TColumnOptions = {}, directives: string[] = []): IColumnMeta {
  const entitiyMeta = createEntityMetaIfNotExists(entityName);
  if (entitiyMeta.columns[columnName] != null) throw new Error(`orm.column.already.exists: ${entityName}.${columnName}`);
  entitiyMeta.columns[columnName] = {
    name: columnName,
    columnOptions: { name: columnName, ...columnOptions },
    directives,
    synchronized: false
  };
  return entitiyMeta.columns[columnName];
}

export function getFinalColumnOptions(entityName: string, columnName: string): TColumnOptions {
  const columnMeta = createColumnMetaIfNotExists(entityName, columnName);
  return checkAndAdjustColumnOptions(columnMeta.columnOptions);
}

export function addColumnDirective(entityName: string, columnName: string, directive: string): void {
  const columnMeta = createColumnMetaIfNotExists(entityName, columnName);
  columnMeta.directives.push(directive);
}

export function addColumnOptions(entityName: string, columnName: string, columnOptions: TColumnOptions): void {
  const columnMeta = createColumnMetaIfNotExists(entityName, columnName);
  columnMeta.columnOptions = { ...columnMeta.columnOptions, ...columnOptions };
}

export function setColumnSynchronizedTrue(entityName: string, columnName: string): void {
  const columnMeta = createColumnMetaIfNotExists(entityName, columnName);
  const { columnOptions } = columnMeta;
  if (columnOptions.enum != null && columnOptions.enumName != null) registerEnum(columnOptions.enumName, columnOptions.enum);
  columnMeta.synchronized = true;
}

export function isColumnSynchronized(entityName: string, columnName: string): boolean {
  const columnMeta = createColumnMetaIfNotExists(entityName, columnName);
  return columnMeta.synchronized === true;
}

// ============= Generate

export function toString(): string {
  return JSON.stringify(modelMeta, null, 2);
}

export function toSdl(): string {
  return generateSdl(modelMeta);
}