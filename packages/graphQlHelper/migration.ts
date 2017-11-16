import * as fastGlob from 'fast-glob';
import { readFile } from 'fs';
import { basename } from 'path';
import { promisify } from 'util';
const readFileAsync = promisify(readFile);

import { ITableObjects } from './ITableObjects';

export const getMigrationsUp =
  async (pMigrationsPath: string, pMigrationDate?: number): Promise<string[]> => {
    const migrationDate = pMigrationDate || (new Date()).getTime();

    // get latest migration before migrationDate
    try {

      const files = await fastGlob.default(
        `${pMigrationsPath}/*.json`,
        { deep: true, onlyFiles: true });

      // sort files
      files.sort();

      // find relevant migartion file
      const relevantMigartionFilePath = files.reduce((relevantFile, currentPath) => {
        const versionId = parseInt(basename(currentPath, '.json'), 10);
        return (versionId <= migrationDate) ? currentPath : relevantFile;
      });

      const tableObject = require(relevantMigartionFilePath);
      return createSqlFromTableObjects(tableObject);

    } catch (err) {
      throw err;
    }

  };

export const createSqlFromTableObjects = (pTableObjects: ITableObjects): string[] => {

  const sqlCommands: string[] = [];

  // copy into regular object
  Object.values(pTableObjects).map((tableObject) => {
    // only parse those with isDbModel = true
    if (!!tableObject.isDbModel) {
      createSqlFromTableObject(sqlCommands, tableObject);
    }
  });

  return sqlCommands;

};

const createSqlFromTableObject = (sqlCommands, pTableObject) => {

  // create table statement
  sqlCommands.push(`CREATE TABLE "${pTableObject.tableName}"();`);

  // create column statements
  for (const field of pTableObject.fields) {

    if (field.type === 'computed') {
      // ignore computed
    } else if (field.type === 'relation') {
      // ignore relations
    } else {
      const fieldStatementArray = [];
      fieldStatementArray.push(
        `ALTER TABLE "${pTableObject.tableName}" ADD COLUMN "${field.name}"`);

      // add type
      fieldStatementArray.push(field.type);

      // constraints

      // primary key
      if (!!field.constraints.isPrimaryKey) {
        fieldStatementArray.push('PRIMARY KEY');
      }

      // unique
      if (!!field.constraints.unique) {
        fieldStatementArray.push('UNIQUE');
      }

      // not null
      if (!!field.constraints.nullable) {
        fieldStatementArray.push('NOT NULL');
      }

      // add end of statement
      fieldStatementArray.push(';');

      const fieldStatementStr = fieldStatementArray.join(' ');
      sqlCommands.push(fieldStatementStr);
    }
  }

};