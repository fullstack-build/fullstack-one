import * as _ from "lodash";

import * as helper from "../helper";
import { IMigrationSqlObj, IAction } from "../IMigrationSqlObj";
import { LoggerFactory, Logger } from "@fullstack-one/logger";
import { IDbMeta, IDbRelation } from "../IDbMeta";
import { MigrationObject } from "../migrationObject";

// EXTENSIONS
// table
import { getTableMigrationExtension } from "./tableMigrationExtension";
export { registerTableMigrationExtension } from "./tableMigrationExtension";
// column
import { getColumnMigrationExtension } from "./columnMigrationExtension";
export { registerColumnMigrationExtension } from "./columnMigrationExtension";

export class SqlObjFromMigrationObject {
  private readonly ACTION_KEY: string;
  private readonly DELETED_PREFIX: string = "_deleted:";
  // TODO: Eugene get schemas to ignore from a setting
  private readonly schemasToIgnore: any = ["_versions", "_graphql", "pgboss"];
  private readonly isRenameInsteadOfDrop: boolean = true;
  private readonly fromDbMeta: IDbMeta = null;
  private readonly toDbMeta: IDbMeta = null;
  private readonly migrationObj: IDbMeta = null;
  public readonly sqlStatements: string[] = [];

  constructor(migrationObject: MigrationObject, isRenameInsteadOfDrop: boolean = true) {
    this.ACTION_KEY = migrationObject.ACTION_KEY;
    this.migrationObj = migrationObject.migrationObj;
    this.fromDbMeta = migrationObject.fromDbMeta;
    // save final state for comparison
    this.toDbMeta = migrationObject.toDbMeta;
    this.isRenameInsteadOfDrop = isRenameInsteadOfDrop;

    // check if pMigrationObj is empty -> Parsing error
    if (this.migrationObj == null || Object.keys(this.migrationObj).length === 0) {
      throw new Error("Migration Error: Provided migration object state is empty.");
    }

    this.sqlStatements = this.sqlMigrationObjToSqlStatements(this.createSqlObjFromMigrationDbMeta());
  }

  private splitActionFromNode(node: {} = {}): { action: IAction; node: any } {
    return helper.splitActionFromNode(this.ACTION_KEY, node);
  }

  // iterate sqlMigrationObj in a certain order in order to create SQL statement in the correct order
  private sqlMigrationObjToSqlStatements(sqlMigrationObj: IMigrationSqlObj): string[] {
    const sqlStatements = [];

    // create, drop and recreate enums
    if (sqlMigrationObj.enums != null) {
      Object.values(sqlMigrationObj.enums).forEach((enumSqlObj) => {
        // add down statements first (enum change or rename)
        _addStatemensArrayToSqlStatements(enumSqlObj.sql.down);
        // add up statements
        _addStatemensArrayToSqlStatements(enumSqlObj.sql.up);
      });
    }

    // create tables
    if (sqlMigrationObj.schemas != null) {
      Object.values(sqlMigrationObj.schemas).forEach((schemaSqlObj) => {
        // drop all updatable views
        if (schemaSqlObj.views != null) {
          Object.values(schemaSqlObj.views).forEach((viewSqlObj) => {
            // add view down statements
            _addStatemensArrayToSqlStatements(viewSqlObj.sql.down);
          });
        }

        // no need to create schemas, they will be generated with tables
        // create tables
        if (schemaSqlObj.tables != null) {
          Object.values(schemaSqlObj.tables).forEach((tableSqlObj) => {
            // add table up statements
            _addStatemensArrayToSqlStatements(tableSqlObj.sql.up);

            // drop relations
            if (sqlMigrationObj.relations != null) {
              Object.values(sqlMigrationObj.relations).forEach((relationSqlObj) => {
                // add drop statements
                _addStatemensArrayToSqlStatements(relationSqlObj.sql.down);
              });
            }

            // drop constraints
            if (tableSqlObj.constraints != null) {
              // add down statements reversed order
              _addStatemensArrayToSqlStatements(tableSqlObj.constraints.sql.down.reverse());
            }

            // create columns
            if (tableSqlObj.columns != null) {
              Object.values(tableSqlObj.columns).forEach((columnSqlObj) => {
                // add up statements
                _addStatemensArrayToSqlStatements(columnSqlObj.sql.up);
                // add down statements reversed order
                _addStatemensArrayToSqlStatements(columnSqlObj.sql.down.reverse());
              });
            }

            // create constraints
            if (tableSqlObj.constraints != null) {
              // add up statements
              _addStatemensArrayToSqlStatements(tableSqlObj.constraints.sql.up);
            }

            // add table down statements
            _addStatemensArrayToSqlStatements(tableSqlObj.sql.down);
          });
        }

        // create all updatable views
        if (schemaSqlObj.views != null) {
          Object.values(schemaSqlObj.views).forEach((viewSqlObj) => {
            // add view up statements
            _addStatemensArrayToSqlStatements(viewSqlObj.sql.up);
          });
        }
      });
    }

    // create relations
    if (sqlMigrationObj.relations != null) {
      Object.values(sqlMigrationObj.relations).forEach((relationSqlObj) => {
        // add up statements
        _addStatemensArrayToSqlStatements(relationSqlObj.sql.up);
      });
    }

    // drop schemas
    if (sqlMigrationObj.schemas != null) {
      Object.values(sqlMigrationObj.schemas).forEach((schemasSqlObj) => {
        // add down statements
        _addStatemensArrayToSqlStatements(schemasSqlObj.sql.down);
      });
    }

    // run CRUD commands
    if (sqlMigrationObj.crud != null && sqlMigrationObj.crud.sql != null) {
      // add down statements
      _addStatemensArrayToSqlStatements(sqlMigrationObj.crud.sql.down);
      // add up statements
      _addStatemensArrayToSqlStatements(sqlMigrationObj.crud.sql.up);
    }

    // helper to put collect unique statements
    function _addStatemensArrayToSqlStatements(statementsArray) {
      Object.values(statementsArray).forEach((statement) => {
        // only push each ones
        if (sqlStatements.indexOf(statement) === -1) {
          sqlStatements.push(statement);
        }
      });
    }

    return sqlStatements;
  }

  private createEmptySqlObj(name?: string) {
    return {
      name,
      sql: {
        up: [],
        down: []
      }
    };
  }

  public createSqlObjFromMigrationDbMeta(): IMigrationSqlObj {
    const sqlMigrationObj: IMigrationSqlObj = {
      version: 1.0,
      schemas: {
        public: {
          // public schema is available per default
          name: "public",
          sql: {
            up: [],
            down: []
          },
          tables: {}
        }
      },
      enums: {},
      relations: {},
      crud: {
        sql: {
          up: [],
          down: []
        }
      }
    };

    // create enum types first
    if (this.migrationObj.enums != null) {
      const enums = this.splitActionFromNode(this.migrationObj.enums).node;
      Object.entries(enums).map((enumTypeArray) => {
        this.createSqlForEnumObject(sqlMigrationObj, enumTypeArray[0], enumTypeArray[1]);
      });
    }

    if (this.migrationObj.schemas != null) {
      const schemas = this.splitActionFromNode(this.migrationObj.schemas).node;

      // iterate over database schemas
      Object.entries(schemas).map((schemaEntry) => {
        const schemaName = schemaEntry[0];
        const schemaDefinition: any = schemaEntry[1];

        // avoid dropping or creating mandatory schemas (and tables)
        if (!this.schemasToIgnore.includes(schemaName)) {
          this.createSqlFromSchemaObject(sqlMigrationObj, schemaName, schemaDefinition);

          // iterate over database tables
          if (schemaDefinition != null && schemaDefinition.tables != null) {
            const tables = this.splitActionFromNode(schemaDefinition.tables).node;
            Object.entries(tables).map((tableEntry) => {
              const tableName = tableEntry[0];
              const tableObject = tableEntry[1];
              this.createSqlFromTableObject(sqlMigrationObj, schemaName, tableName, tableObject);
            });
          }
        }
      });
    }

    // iterate over database relations
    if (this.migrationObj.relations != null) {
      const relations = this.splitActionFromNode(this.migrationObj.relations).node;

      Object.values(relations).map((relationObj: { [tableName: string]: IDbRelation }) => {
        const relationDefinition: IDbRelation[] = Object.values(this.splitActionFromNode(relationObj).node);

        // write error for many-to-many
        if (relationDefinition[0].type === "MANY" && relationDefinition[1] != null && relationDefinition[1].type === "MANY") {
          process.stdout.write(
            `migration.relation.unsupported.type: ${relationDefinition[0].name}: ${relationDefinition[0].tableName}:
              ${relationDefinition[1].tableName} => MANY:MANY\n Many to many relations are not yet supported by the
              query builder. Create a through table instead.\n`
          );

          this.createSqlManyToManyRelation(sqlMigrationObj, relationDefinition[0].name, relationDefinition);
        } else {
          if (relationDefinition[0].type === "ONE" && relationDefinition[1] != null && relationDefinition[1].type === "ONE") {
            process.stdout.write(
              `migration.relation.type.hint: ${relationDefinition[0].name}: ${relationDefinition[0].tableName}:
                ${relationDefinition[1].tableName} => ONE:ONE\n Try to avoid using one to one relations.
                Consider combining both entities into one, using JSON type instead or pointing only in one direction.\n`
            );
          }

          // create one:many / one:one relation
          this.createRelation(sqlMigrationObj, relationDefinition[0].name, relationDefinition);
        }
      });
    }

    // return down statements reversed and before up statements
    return sqlMigrationObj;
  }

  public createSqlForEnumObject(sqlMigrationObj, enumTypeName, enumTypeValue) {
    // create sql object if it doesn't exist
    const thisSqlObj = (sqlMigrationObj.enums[enumTypeName] = sqlMigrationObj.enums[enumTypeName] || this.createEmptySqlObj(enumTypeName));
    const thisSql = thisSqlObj.sql;

    // node
    const { action, node } = this.splitActionFromNode(enumTypeValue);
    const values = this.splitActionFromNode(node.values).node;
    const enumValues = Object.values(values);

    // add and remove can both happen at the same time (e.g. when changing value => recreate)
    if (action.add) {
      thisSql.up.push(`CREATE TYPE "${enumTypeName}" AS ENUM ('${enumValues.join("','")}');`);
    }
    if (action.remove) {
      // get all columns that use this Type and cast them to varchar
      // will be executed in opposite order -> first cast than drop type
      const enumColumns = this.splitActionFromNode(node.columns).node;
      Object.values(enumColumns).forEach((enumColumn) => {
        const enumColumnNode = this.splitActionFromNode(enumColumn).node;
        if (enumColumnNode.schemaName != null && enumColumnNode.tableName != null && enumColumnNode.columnName != null) {
          thisSql.down.push(
            `ALTER TABLE "${enumColumnNode.schemaName}"."${enumColumnNode.tableName}" ` +
              `ALTER COLUMN "${enumColumnNode.columnName}" TYPE "varchar" USING "${enumColumnNode.columnName}"::"varchar";`
          );
        }
      });

      // drop type
      thisSql.down.push(`DROP TYPE "${enumTypeName}";`);
    }
  }

  public createSqlFromSchemaObject(sqlMigrationObj, schemaName: string, schemDefinition: any) {
    // create sql object if it doesn't exist
    const thisSqlObj = (sqlMigrationObj.schemas[schemaName] = sqlMigrationObj.schemas[schemaName] || this.createEmptySqlObj(schemaName));
    // add tables to schema
    thisSqlObj.tables = thisSqlObj.tables || {};
    // add views to schema
    thisSqlObj.views = thisSqlObj.views || {};

    const thisSql = thisSqlObj.sql;

    // node
    const { action, node } = this.splitActionFromNode(schemDefinition);

    if (action.add) {
      // don't create schema, it will be created automatically with table creation
      // thisSql.up.push(`CREATE SCHEMA IF NOT EXISTS "${schemaName}";`);
    } else if (action.remove) {
      // drop or rename schema
      if (!this.isRenameInsteadOfDrop) {
        thisSql.down.push(`DROP SCHEMA IF EXISTS "${schemaName}";`);
      } else {
        // create rename instead
        thisSql.down.push(`ALTER SCHEMA "${schemaName}" RENAME TO "${this.DELETED_PREFIX}${schemaName}";`);
      }
    }
  }

  // http://www.postgresqltutorial.com/postgresql-alter-table/
  public createSqlFromTableObject(sqlMigrationObj, schemaName, tableName, tableDefinition: any) {
    // create sql object if it doesn't exist
    const thisSqlObj = (sqlMigrationObj.schemas[schemaName].tables[tableName] =
      sqlMigrationObj.schemas[schemaName].tables[tableName] || this.createEmptySqlObj(tableName));
    const thisSqlViewObj = (sqlMigrationObj.schemas[schemaName].views[tableName] =
      sqlMigrationObj.schemas[schemaName].views[tableName] || this.createEmptySqlObj(tableName));

    // add columns to table
    thisSqlObj.columns = thisSqlObj.columns || {};
    const thisSql = thisSqlObj.sql;
    const thisSqlView = thisSqlViewObj.sql;

    // node
    const { action, node } = this.splitActionFromNode(tableDefinition);

    // use the current table name, otherwise name of node
    // (in case it got removed on dbMeta merge)
    const tableNameUp = node.name || tableName;
    const tableNameDown = action.rename ? node.oldName : tableNameUp;
    const viewNameUp = `A${tableNameUp}`;
    const viewNameDown = `A${tableNameDown}`;

    const tableNameWithSchemaUp = `"${schemaName}"."${tableNameUp}"`;
    const viewTableNameWithSchemaUp = `"${schemaName}"."${viewNameUp}"`;
    const tableNameWithSchemaDown = `"${schemaName}"."${tableNameDown}"`;
    const viewTableNameWithSchemaDown = `"${schemaName}"."${viewNameDown}"`;

    // only if table needs to be created
    if (tableDefinition.name != null) {
      if (action.add) {
        // create table statement
        thisSql.up.push(`CREATE SCHEMA IF NOT EXISTS "${schemaName}";`);
        thisSql.up.push(`CREATE TABLE IF NOT EXISTS ${tableNameWithSchemaUp}();`);
      } else if (action.remove) {
        // create or rename table
        if (!this.isRenameInsteadOfDrop) {
          // drop table
          thisSql.down.push(`DROP TABLE IF EXISTS ${tableNameWithSchemaDown};`);
        } else {
          // create rename instead, ignore if already renamed

          if (tableDefinition.name.indexOf(this.DELETED_PREFIX) !== 0) {
            thisSql.down.push(`ALTER TABLE ${tableNameWithSchemaDown} RENAME TO "${this.DELETED_PREFIX}${node.name}";`);
          } else {
            // table was already renamed instead of deleted
          }
        }
      } else if (action.rename) {
        // move to other schema in down, so that it happens BEFORE old schema gets removed and table gets renamed
        if (node.oldSchemaName != null && node.schemaName != null && node.oldSchemaName !== node.schemaName) {
          // create schema first if not available yet
          thisSql.up.push(`CREATE SCHEMA IF NOT EXISTS "${node.schemaName}";`);
          thisSql.up.push(`ALTER TABLE "${node.oldSchemaName}"."${node.oldName}" SET SCHEMA "${node.schemaName}";`);
        }
        // don't rename if old and new names are equal (could happen when moving from one schema to another)
        if (node.oldName !== node.name) {
          thisSql.up.push(`ALTER TABLE "${schemaName}"."${node.oldName}" RENAME TO "${node.name}";`);
        }
      }

      // update views on any table or nested column change
      let tableAndColumnActions = action;
      // iterate columns and merge all actions into one
      Object.values(node.columns).forEach((column: any) => {
        // ignore computed and customResolver columns
        if (column.type !== "computed" && column.type !== "customResolver") {
          const columnAction = this.splitActionFromNode(column).action;
          tableAndColumnActions = { ...tableAndColumnActions, ...columnAction };
        }
      });
      // recreate views for every table and/or column change
      if (tableAndColumnActions.add || tableAndColumnActions.remove || tableAndColumnActions.rename || tableAndColumnActions.change) {
        // create updatbale views for all tables, no matter the action
        // -> even a column change could result in a view change
        // create direct access updatable view / on the down run, after the table was created
        thisSqlView.up.push(`CREATE OR REPLACE VIEW ${viewTableNameWithSchemaUp} AS
                          SELECT * FROM ${tableNameWithSchemaUp} WHERE _auth.is_admin() = true WITH LOCAL CHECK OPTION;`);
        // drop direct access updatable view
        thisSqlView.down.push(`DROP VIEW IF EXISTS ${viewTableNameWithSchemaDown};`);
      }
    }

    // iterate columns
    if (tableDefinition.columns != null) {
      const columns = this.splitActionFromNode(tableDefinition.columns).node;
      for (const columnObject of Object.entries(columns)) {
        const columnName = columnObject[0];
        const columnDefinition = columnObject[1];
        this.createSqlFromColumnObject(sqlMigrationObj, schemaName, tableNameUp, columnName, columnDefinition);
      }
    }

    // generate constraints for column
    if (tableDefinition.constraints != null) {
      const constraints = this.splitActionFromNode(tableDefinition.constraints).node;
      for (const constraintObject of Object.entries(constraints)) {
        const constraintName = constraintObject[0];
        const constraintDefinition = constraintObject[1];
        this.createSqlFromConstraintObject(sqlMigrationObj, schemaName, tableNameUp, constraintName, constraintDefinition);
      }
    }
    // extensions
    if (tableDefinition.extensions != null) {
      const extensions = this.splitActionFromNode(tableDefinition.extensions).node;
      // run through extension definitions
      Object.entries(extensions).forEach((extension) => {
        const extensionName = extension[0];
        const extensionDefinitionWithAction = extension[1];

        // execute extension migration callback if available
        if (getTableMigrationExtension(extensionName) != null) {
          getTableMigrationExtension(extensionName)(extensionDefinitionWithAction, sqlMigrationObj, thisSql, schemaName, tableNameDown, tableNameUp);
        }
      });
    }
  }

  public createSqlFromColumnObject(sqlMigrationObj, schemaName, tableName, columnName, columnDefinition: any) {
    // create sql object if it doesn't exist
    const thisSqlObj = (sqlMigrationObj.schemas[schemaName].tables[tableName].columns[columnName] =
      sqlMigrationObj.schemas[schemaName].tables[tableName].columns[columnName] || this.createEmptySqlObj(columnName));
    const thisSql = thisSqlObj.sql;

    // node
    const { action, node } = this.splitActionFromNode(columnDefinition);

    const tableNameWithSchema = `"${schemaName}"."${tableName}"`;

    if (node.type === "computed") {
      // ignore computed
    } else if (node.type === "customResolver") {
      // ignore custom
    } else if (node.type === "relation") {
      // ignore relations
    } else {
      let type = node.type;
      // is type an enum/custom or just a customType change of an existing type
      if (type === "enum" || type === "customType" || (type == null && node.customType != null)) {
        type = `${node.customType}`;
      }

      if (action.add && node.name != null) {
        // create column statement
        thisSql.up.push(`ALTER TABLE ${tableNameWithSchema} ADD COLUMN IF NOT EXISTS "${node.name}" varchar;`);
      } else if (action.remove) {
        // drop or rename
        if (!this.isRenameInsteadOfDrop) {
          thisSql.down.push(`ALTER TABLE ${tableNameWithSchema} DROP COLUMN IF EXISTS "${node.name}" CASCADE;`);
        } else {
          // create rename instead
          thisSql.down.push(`ALTER TABLE ${tableNameWithSchema} RENAME COLUMN "${node.name}" TO "${this.DELETED_PREFIX}${node.name}";`);
        }
      } else if (action.rename && node.oldName != null && node.name != null) {
        thisSql.up.push(`ALTER TABLE ${tableNameWithSchema} RENAME COLUMN "${node.oldName}" TO "${node.name}";`);
      }

      // for every column that should not be removed
      if (action != null && !action.remove && type != null && columnName != null) {
        // cast array or any other type
        const castType = type.includes("[]")
          ? `uuid[] USING string_to_array("${columnName}"::text, ''::text)::${type}`
          : `"${type}" USING "${columnName}"::"${type}";`;

        // set or change column type
        thisSql.up.push(`ALTER TABLE ${tableNameWithSchema} ALTER COLUMN "${columnName}" TYPE ${castType};`);
      }
    }

    // add default values // create or recreate
    if (node.defaultValue != null && node.defaultValue.value != null) {
      const defaultValueObj = this.splitActionFromNode(node.defaultValue);
      // set default
      if (defaultValueObj.action.add || defaultValueObj.action.change) {
        thisSql.up.push(`ALTER TABLE ${tableNameWithSchema} ALTER COLUMN "${columnName}" SET DEFAULT ${defaultValueObj.node.value};`);
      } else if (action.remove || defaultValueObj.action.change) {
        thisSql.down.push(`ALTER TABLE ${tableNameWithSchema} ALTER COLUMN "${columnName}" DROP DEFAULT;`);
      }
    }

    // extensions
    if (columnDefinition.extensions != null) {
      const extensions = this.splitActionFromNode(columnDefinition.extensions).node;
      // run through extension definitions
      Object.entries(extensions).forEach((extension) => {
        const extensionName = extension[0];
        const extensionDefinitionWithAction = extension[1];

        // execute extension migration callback if available
        if (getColumnMigrationExtension(extensionName) != null) {
          getColumnMigrationExtension(extensionName)(extensionDefinitionWithAction, sqlMigrationObj, thisSql, schemaName, tableName, columnName);
        }
      });
    }
  }

  public createSqlFromConstraintObject(sqlMigrationObj, schemaName, tableName, constraintName, constraintObject) {
    // create sql object if it doesn't exist
    // up
    const thisSqlObj = (sqlMigrationObj.schemas[schemaName].tables[tableName].constraints =
      sqlMigrationObj.schemas[schemaName].tables[tableName].constraints || this.createEmptySqlObj());
    const thisSql = thisSqlObj.sql;

    // node
    const { action, node } = this.splitActionFromNode(constraintObject);
    const fromNode = _.get(this.fromDbMeta, `schemas.${schemaName}.tables.${tableName}.constraints.${constraintName}`);
    const toNode = _.get(this.toDbMeta, `schemas.${schemaName}.tables.${tableName}.constraints.${constraintName}`);

    const tableNameWithSchema = `"${schemaName}"."${tableName}"`;

    const columnNamesAsStr =
      node.columns != null
        ? Object.values(this.splitActionFromNode(node.columns).node)
            .map((columnName) => `"${columnName}"`)
            .join(",")
        : null;

    const nodeType = node.type || toNode.type || fromNode.type;
    switch (nodeType) {
      case "NOT NULL":
        if (columnNamesAsStr != null) {
          if (action.add) {
            thisSql.up.push(`ALTER TABLE ${tableNameWithSchema} ALTER COLUMN ${columnNamesAsStr} SET NOT NULL;`);
          } else if (action.remove) {
            thisSql.down.push(`ALTER TABLE ${tableNameWithSchema} ALTER COLUMN ${columnNamesAsStr} DROP NOT NULL;`);
          }
        }
        // rename constraint
        if (action.rename && node.oldName != null) {
          // NOT NULL does not have to be renamed
        }
        break;
      case "PRIMARY KEY":
        /* moved to graphQlSchemaToDbMeta -> expression
				// convention: all PKs are generated uuidv4
				node.columns.forEach((columnName) => {
					sqlCommands.up.push(
						`ALTER TABLE ${tableName} ALTER COLUMN "${columnName}" SET DEFAULT uuid_generate_v4();`
					);
				});
				*/

        if (action.add) {
          // make sure column names for constraint are set
          if (columnNamesAsStr != null) {
            thisSql.up.push(`ALTER TABLE ${tableNameWithSchema} ADD CONSTRAINT "${constraintName}" PRIMARY KEY (${columnNamesAsStr});`);
          }
        } else if (action.remove) {
          thisSql.down.push(`ALTER TABLE ${tableNameWithSchema} DROP CONSTRAINT IF EXISTS "${constraintName}" CASCADE;`);
        }

        // rename constraint
        if (action.rename && node.oldName != null) {
          thisSql.up.push(`ALTER INDEX "${schemaName}"."${node.oldName}" RENAME TO "${constraintName}";`);
        }
        break;
      case "UNIQUE":
        /*
         * The preferred way to add a unique constraint to a table is ALTER TABLE ... ADD CONSTRAINT. The use of indexes to enforce unique constraints could be considered an implementation detail that should not be accessed directly. One should, however, be aware that there's no need to manually create indexes on unique columns; doing so would just duplicate the automatically-created index.
         * https://www.postgresql.org/docs/9.0/indexes-unique.html
         * */
        const uniqueSql = {
          up: [],
          down: []
        };

        if (action.add) {
          // make sure column names for constraint are set
          if (columnNamesAsStr != null) {
            uniqueSql.up.push(`ALTER TABLE ${tableNameWithSchema} ADD CONSTRAINT "${constraintName}" UNIQUE (${columnNamesAsStr});`);
          }
        } else if (action.remove) {
          uniqueSql.down.push(`ALTER TABLE ${tableNameWithSchema} DROP CONSTRAINT IF EXISTS "${constraintName}" CASCADE;`);
        }

        // rename constraint
        if (action.rename && node.oldName != null) {
          uniqueSql.up.push(`ALTER INDEX "${schemaName}"."${node.oldName}" RENAME TO "${constraintName}";`);
        }

        // check for conditions (as long as constraint wasn't removed)
        if (!action.remove && node.options != null) {
          const optionsObj = this.splitActionFromNode(node.options);

          if (optionsObj.node.condition != null) {
            // in case an index or constraint was created already, drop it and recreate as a partial index
            uniqueSql.up = [];
            uniqueSql.down = [];
            // drop old one
            if (optionsObj.action.add || optionsObj.action.remove || optionsObj.action.change) {
              // needs to be in this order, to make sure a constraint is removed first
              uniqueSql.down.push(`DROP INDEX IF EXISTS "${constraintName}";`);
              uniqueSql.down.push(`ALTER TABLE ${tableNameWithSchema} DROP CONSTRAINT IF EXISTS "${constraintName}" CASCADE;`);
            }
            // create new one
            if (optionsObj.action.add || optionsObj.action.change) {
              // make sure column names for constraint are set
              if (columnNamesAsStr != null) {
                uniqueSql.up.push(
                  `CREATE UNIQUE INDEX "${constraintName}" ON ${tableNameWithSchema}(${columnNamesAsStr}) WHERE (${optionsObj.node.condition});`
                );
              }
            }
          }
        }

        // push unique sql into final sql
        thisSql.down = thisSql.down.concat(uniqueSql.down);
        thisSql.up = thisSql.up.concat(uniqueSql.up);

        break;
      case "CHECK":
        if (action.add) {
          const checkExpression = node.options.param1;
          thisSql.up.push(`ALTER TABLE ${tableNameWithSchema} ADD CONSTRAINT "${constraintName}" CHECK (${checkExpression});`);
        } else if (action.remove) {
          thisSql.down.push(`ALTER TABLE ${tableNameWithSchema} DROP CONSTRAINT IF EXISTS "${constraintName}" CASCADE;`);
        }
        // rename constraint
        if (action.rename && node.oldName != null) {
          // check does not have to be renamed
        }
        break;
    }
  }

  public createRelation(sqlMigrationObj, relationName, relationObject: IDbRelation[]) {
    // create sql object if it doesn't exist
    const thisSqlObj = (sqlMigrationObj.relations[relationName] = sqlMigrationObj.relations[relationName] || this.createEmptySqlObj(relationName));
    const thisSql = thisSqlObj.sql;

    // relation sides
    // iterate all sides of relation
    relationObject.forEach((thisRelation) => {
      _createSqlRelation.call(this, thisRelation);
    });
    function _createSqlRelation(oneRelation: IDbRelation, ignoreColumnsCreation: boolean = false) {
      const { action, node } = this.splitActionFromNode(oneRelation);

      // ignore the 'MANY' side
      if (node.type === "ONE") {
        // CANNOT BE DONE FOR MIGRATIONS WHERE TABLES MIGHT BE MISSING
        // check if both sides of relation exist, ignore relation otherwise
        // todo redundant => combine into function
        /*
        // todo: remove, cannot be checked for relations. trust, DB will test!
        if (sqlMigrationObj.schemas[node.schemaName] == null ||
            sqlMigrationObj.schemas[node.schemaName].tables[node.tableName] == null) {
          process.stdout.write(
            'migration.relation.missing.table: ' +
            `${node.name}: ${node.schemaName}.${node.tableName} not found` + '\n'
          );
          return;
        } else if (sqlMigrationObj.schemas[node.reference.schemaName] == null ||
                   sqlMigrationObj.schemas[node.reference.schemaName].tables[node.reference.tableName] == null) {
          process.stdout.write(
            'migration.relation.missing.table: ' +
            `${node.name}: ${node.reference.schemaName}.${node.reference.tableName} not found` + '\n'
          );
          return;
        }*/

        const tableName = `"${node.schemaName}"."${node.tableName}"`;
        const fullRelationToNode = this.toDbMeta.relations[node.name];

        // create column for FK // convention: uuid
        if (!ignoreColumnsCreation) {
          if (action.add) {
            // does not have to be extra created -> will be created IF NOT EXISTS with the relation itself
          } else if (action.remove) {
            // in case of FK recreation, no need to remove column (removeConstraintOnly = true)
            // drop or rename column
            if (!this.isRenameInsteadOfDrop) {
              thisSql.down.push(`ALTER TABLE ${tableName} DROP COLUMN IF EXISTS "${node.columnName}" CASCADE;`);
            } else {
              thisSql.down.push(`ALTER TABLE ${tableName} RENAME COLUMN "${node.columnName}" TO "${this.DELETED_PREFIX}${node.columnName}";`);
            }
          }
        }

        // foreign key constraint
        const constraintName = `fk_${node.name}`;

        // change constraint description for add and rename / drop for remove
        if (action.add || action.rename) {
          // make sure foreign key columns is there
          thisSql.up.push(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS "${node.columnName}" uuid;`);
          // we need to drop a possible existing one, in order to update onUpdate and onDelete
          thisSql.up.push(`ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS "${constraintName}" CASCADE;`);
          // and add a new version with all attributes
          let newFkConstraint =
            `ALTER TABLE ${tableName} ADD CONSTRAINT "${constraintName}" FOREIGN KEY ("${node.columnName}") ` +
            `REFERENCES "${node.reference.schemaName}"."${node.reference.tableName}"("${node.reference.columnName}")`;

          // check onUpdate and onDelete
          if (node.onDelete != null) {
            newFkConstraint += ` ON DELETE ${node.onDelete}`;
          }
          if (node.onUpdate != null) {
            newFkConstraint += ` ON UPDATE ${node.onUpdate}`;
          }
          newFkConstraint += ";";
          thisSql.up.push(newFkConstraint);
          thisSql.up.push(`COMMENT ON CONSTRAINT "${constraintName}" ON ${tableName} IS '${JSON.stringify(fullRelationToNode)}';`);
        } else if (action.remove) {
          thisSql.down.push(`ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS "${constraintName}" CASCADE;`);
          // drop or rename column
          if (!this.isRenameInsteadOfDrop) {
            thisSql.down.push(`COMMENT ON CONSTRAINT "${constraintName}" ON ${tableName} IS NULL;`);
          }
        }
      } else {
        // for MANY => update ONE side of relation in case of a rename
        if (action.rename) {
          // foreign key constraint
          const constraintName = `fk_${node.name}`;

          const oneSideTableName = `"${node.reference.schemaName}"."${node.reference.tableName}"`;
          const fullRelationToNode = this.toDbMeta.relations[node.name];
          thisSql.up.push(`COMMENT ON CONSTRAINT "${constraintName}" ON ${oneSideTableName} IS '${JSON.stringify(fullRelationToNode)}';`);
        }
      }

      // change relation? -> recreate
      if (action.change) {
        /*
        // FROM find one side and copy and add "remove" action
        const fullRelationFromNodeOneSide = { ...Object.values(fromDbMeta.relations[node.name]).find((relation) => {
          return (relation.type === 'ONE');
        }), [ACTION_KEY]: {
          remove: true
        }};
        // remove old FK, keep column
        _createSqlRelation.call(this, fullRelationFromNodeOneSide, true);
        */
        // TO: find one side and copy and add "add" action
        let fullRelationToNodeOneSide: any = Object.values(this.toDbMeta.relations[node.name]).find((relation: any) => {
            return relation.type === "ONE";
          });
        fullRelationToNodeOneSide.ACTION_KEY = { add: true };
        // recreate new FK, keep column
        _createSqlRelation.call(this, this.fullRelationToNodeOneSide, true);
      }
    }
  }

  public createSqlManyToManyRelation(sqlMigrationObj, relationName, relationObject: IDbRelation[]) {
    // create sql object if it doesn't exist
    const thisSqlObj = (sqlMigrationObj.relations[relationName] = sqlMigrationObj.schemas[relationName] || this.createEmptySqlObj(relationName));
    const thisSql = thisSqlObj.sql;

    // relation sides
    const relation1 = this.splitActionFromNode(relationObject[0]);
    const actionRelation1 = relation1.action;
    const nodeRelation1 = relation1.node;
    const nodeRelation1Clean = helper.removeFromEveryNode(nodeRelation1, this.ACTION_KEY);
    const relation2 = this.splitActionFromNode(relationObject[1]);
    const actionRelation2 = relation2.action;
    const nodeRelation2 = relation2.node;
    const nodeRelation2Clean = helper.removeFromEveryNode(nodeRelation2, this.ACTION_KEY);

    /*
    // CANNOT BE DONE FOR MIGRATIONS WHERE TABLES MIGHT BE MISSING
    // check if both sides of relation exist, ignore relation otherwise
    // todo redundant => combine into function
    if (sqlMigrationObj.schemas[nodeRelation1Clean.schemaName] == null ||
      sqlMigrationObj.schemas[nodeRelation1Clean.schemaName].tables[nodeRelation1Clean.tableName] == null) {
      process.stdout.write(
        'migration.relation.missing.table: ' +
        `${nodeRelation1Clean.name}: ${nodeRelation1Clean.schemaName}.${nodeRelation1Clean.tableName} not found` + '\n'
      );
      return;
    } else if (sqlMigrationObj.schemas[nodeRelation1Clean.reference.schemaName] == null ||
      sqlMigrationObj.schemas[nodeRelation1Clean.reference.schemaName].tables[nodeRelation1Clean.reference.tableName] == null) {
      process.stdout.write(
        'migration.relation.missing.table: ' +
        `${nodeRelation1Clean.name}: ${nodeRelation1Clean.reference.schemaName}.${nodeRelation1Clean.reference.tableName} not found` + '\n'
      );
      return;
    }

    // check if both sides of relation exist, ignore relation otherwise
    // todo redundant => combine into function
    if (sqlMigrationObj.schemas[nodeRelation2Clean.schemaName] == null ||
      sqlMigrationObj.schemas[nodeRelation2Clean.schemaName].tables[nodeRelation2Clean.tableName] == null) {
      process.stdout.write(
        'migration.relation.missing.table: ' +
        `${nodeRelation2Clean.name}: ${nodeRelation2Clean.schemaName}.${nodeRelation2Clean.tableName} not found` + '\n'
      );
      return;
    } else if (sqlMigrationObj.schemas[nodeRelation2Clean.reference.schemaName] == null ||
      sqlMigrationObj.schemas[nodeRelation2Clean.reference.schemaName].tables[nodeRelation2Clean.reference.tableName] == null) {
      process.stdout.write(
        'migration.relation.missing.table: ' +
        `${nodeRelation2Clean.name}: ${nodeRelation2Clean.reference.schemaName}.${nodeRelation2Clean.reference.tableName} not found` + '\n'
      );
      return;
    }
*/
    // relation 1
    const tableName1 = `"${nodeRelation1.schemaName}"."${nodeRelation1.tableName}"`;
    if (actionRelation1.add) {
      // create fk column 1
      thisSql.up.push(`ALTER TABLE ${tableName1} ADD COLUMN IF NOT EXISTS "${nodeRelation1.columnName}" uuid[];`);
    } else if (actionRelation1.remove) {
      // drop or rename column
      if (!this.isRenameInsteadOfDrop) {
        // remove fk column 1
        thisSql.down.push(`ALTER TABLE ${tableName1} DROP COLUMN IF EXISTS "${nodeRelation1.columnName}" CASCADE;`);
        // remove meta information
        thisSql.down.push(`COMMENT ON COLUMN ${tableName1}."${nodeRelation1.columnName}" IS NULL;`);
      } else {
        // create rename instead
        thisSql.down.push(
          `ALTER TABLE ${tableName1} RENAME COLUMN "${nodeRelation1.columnName}" TO "${this.DELETED_PREFIX}${nodeRelation1.columnName}";`
        );
      }
    }
    // add relation description for add and rename
    if (actionRelation1.add || actionRelation1.rename) {
      // add comment with meta information
      thisSql.up.push(`COMMENT ON COLUMN ${tableName1}."${nodeRelation1.columnName}" IS '${JSON.stringify(nodeRelation1Clean)}';`);
    }

    // relation2
    const tableName2 = `"${nodeRelation2.schemaName}"."${nodeRelation2.tableName}"`;
    if (actionRelation2.add) {
      // create fk column 2
      thisSql.up.push(`ALTER TABLE ${tableName2} ADD COLUMN IF NOT EXISTS "${nodeRelation2.columnName}" uuid[];`);
    } else if (actionRelation2.remove) {
      // drop or rename column
      if (!this.isRenameInsteadOfDrop) {
        // remove fk column 2
        thisSql.down.push(`ALTER TABLE ${tableName2} DROP COLUMN IF EXISTS "${nodeRelation2.columnName}" CASCADE;`);

        // remove meta information
        thisSql.down.push(`COMMENT ON COLUMN ${tableName2}."${nodeRelation2.columnName}" IS NULL;`);
      } else {
        // create rename instead
        thisSql.down.push(
          `ALTER TABLE ${tableName2} RENAME COLUMN "${nodeRelation2.columnName}" TO "${this.DELETED_PREFIX}${nodeRelation2.columnName}";`
        );
      }
    }
    // add relation description for add and rename
    if (actionRelation2.add || actionRelation2.rename) {
      // add comment with meta information
      thisSql.up.push(`COMMENT ON COLUMN ${tableName2}."${nodeRelation2.columnName}" IS '${JSON.stringify(nodeRelation2Clean)}';`);
    }

    // todo create trigger to check consistency and cascading
  }
}
