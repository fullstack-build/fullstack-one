import * as _ from "lodash";
import { IDbMeta, IDbRelation } from "../IDbMeta";
import * as deepmerge from "deepmerge";

export function setDefaultValueForColumn(gQlSchemaNode, dbMetaNode, refDbMeta, refDbMetaCurrentTable, refDbMetaCurrentTableColumn) {
  const isExpression = _.get(gQlSchemaNode, "arguments[0].name.value").toLocaleLowerCase() === "expression";
  const defaultValue = _.get(gQlSchemaNode, "arguments[0].value.value");
  const value = isExpression === true ? defaultValue : `'${defaultValue}'::character varying`;
  // add default object to column
  refDbMetaCurrentTableColumn.defaultValue = {
    value
  };
}

export function createConstraint(
  constraintName: string,
  constraintType: "PRIMARY KEY" | "NOT NULL" | "UNIQUE" | "CHECK",
  options: any,
  refDbMeta,
  refDbMetaCurrentTable,
  refDbMetaCurrentTableColumn?
): void {
  // add new constraint if name was set
  if (constraintName != null) {
    const constraint = (refDbMetaCurrentTable.constraints[constraintName] = refDbMetaCurrentTable.constraints[constraintName] || {
      type: constraintType
    });

    // merge options wth the existing one
    const constraintOptions = constraint.options || {};
    constraint.options = deepmerge(constraintOptions, options);

    // link constraint to field
    if (refDbMetaCurrentTableColumn != null) {
      // add columns field if not available
      constraint.columns = constraint.columns || [];

      // add column name to constraint
      constraint.columns.push(refDbMetaCurrentTableColumn.name);

      // sort columns to make sure they are always in the same order on both sides (GQl and PG)
      constraint.columns.sort();

      // add constraint to field
      refDbMetaCurrentTableColumn.constraintNames = refDbMetaCurrentTableColumn.constraintNames || [];
      refDbMetaCurrentTableColumn.constraintNames.push(constraintName);
      // keep them sorted for better comparison of objects
      refDbMetaCurrentTableColumn.constraintNames.sort();
    }
  }
}

export function relationBuilderHelper(gQlDirectiveNode, dbMetaNode, refDbMeta, refDbMetaCurrentTable) {
  // find the right directive
  const relationDirective = gQlDirectiveNode.directives.find((directive) => {
    return directive.name.value === "relation";
  });

  // create empty relation
  const emptyRelation: IDbRelation = {
    name: null,
    type: null,
    schemaName: null,
    tableName: null,
    columnName: null,
    virtualColumnName: null,
    onUpdate: null,
    onDelete: null,
    description: null,
    reference: {
      schemaName: null,
      tableName: null,
      columnName: null
    }
  };

  let relationName = null;
  let relationType = null;
  const relationSchemaName = refDbMetaCurrentTable.schemaName;
  const relationTableName = refDbMetaCurrentTable.name;
  const virtualColumnName = gQlDirectiveNode.name.value;
  let relationOnUpdate = null;
  let relationOnDelete = null;
  let referencedExposedName = null;
  let referencedSchemaName = null;
  let referencedTableName = null;
  const referencedColumnName = "id"; // fk convention: always points to id

  // iterate arguments, choose what to do onUpdate and onDelete
  relationDirective.arguments.map((argument) => {
    const argumentName = argument.name.value;
    const argumentValue = argument.value.value;
    switch (argumentName) {
      case "name":
        relationName = argument.value.value;
        break;
      case "onUpdate":
        switch (argumentValue.toLocaleLowerCase()) {
          case "restrict":
            relationOnUpdate = "RESTRICT";
            break;
          case "cascade":
            relationOnUpdate = "CASCADE";
            break;
          case "set null":
            relationOnUpdate = "SET NULL";
            break;
          case "set default":
            relationOnUpdate = "SET DEFAULT";
            break;
        }
        break;
      case "onDelete":
        switch (argumentValue.toLocaleLowerCase()) {
          case "restrict":
            relationOnDelete = "RESTRICT";
            break;
          case "cascade":
            relationOnDelete = "CASCADE";
            break;
          case "set null":
            relationOnDelete = "SET NULL";
            break;
          case "set default":
            relationOnDelete = "SET DEFAULT";
            break;
        }
        break;
    }

    ((node) => {
      if (node.type.kind === "NamedType") {
        relationType = "ONE";
        referencedExposedName = _.get(gQlDirectiveNode, "type.name.value");
      } else if (node.type.kind === "NonNullType" && node.type.type.kind === "NamedType") {
        relationType = "ONE";
        referencedExposedName = _.get(gQlDirectiveNode, "type.type.name.value");
      } else if (
        node.type.kind === "NonNullType" &&
        node.type.type.kind === "ListType" &&
        node.type.type.type.kind === "NonNullType" &&
        node.type.type.type.type.kind === "NamedType"
      ) {
        relationType = "MANY";
        referencedExposedName = _.get(gQlDirectiveNode, "type.type.type.type.name.value");
      }
    })(gQlDirectiveNode);
  });

  // check if relation table exists
  if (refDbMeta.schemas[relationSchemaName].tables[relationTableName] == null || refDbMeta.exposedNames[referencedExposedName] == null) {
    // not found, display error
    process.stderr.write(`GraphQL.parser.error.unknown.relation.table: ${relationName}.${referencedExposedName}\n`);
  } else {
    // get actual referenced table
    referencedSchemaName = refDbMeta.exposedNames[referencedExposedName].schemaName;
    referencedTableName = refDbMeta.exposedNames[referencedExposedName].tableName;

    const thisRelationName = `${relationSchemaName}.${relationTableName}`;
    const referencedRelationName = `${referencedSchemaName}.${referencedTableName}`;

    // get or add new relations and keep reference for later
    const relations = (refDbMeta.relations[relationName] = refDbMeta.relations[relationName] || {
      [thisRelationName]: _.cloneDeep(emptyRelation),
      [referencedRelationName]: _.cloneDeep(emptyRelation)
    });
    const thisRelation = relations[thisRelationName];
    const otherRelation = relations[referencedRelationName];

    // check if empty => more then one relation in GraphQl Error, maybe same name for different relations
    if (thisRelation == null || otherRelation == null) {
      process.stderr.write(
        `GraphQL.parser.error.relation.too.many: ${relationName}
        Make sure to use unique relation names for different relations and use the same name on both sides of the relation.`
      );
      return;
    }

    // fill current relation
    thisRelation.name = relationName;
    thisRelation.type = relationType;
    thisRelation.schemaName = relationSchemaName;
    thisRelation.tableName = relationTableName;
    thisRelation.columnName = relationType === "ONE" ? _referencingColumnNameHelper(virtualColumnName) : thisRelation.columnName;
    thisRelation.virtualColumnName = virtualColumnName;
    thisRelation.onUpdate = relationOnUpdate;
    thisRelation.onDelete = relationOnDelete;
    // thisRelation.description        = null;
    thisRelation.reference.schemaName = referencedSchemaName;
    thisRelation.reference.tableName = referencedTableName;
    thisRelation.reference.columnName = relationType === "MANY" ? null : referencedColumnName;

    // "invent" other side of relation if still empty
    // if other part of relation exists in GraphQL, it will get overridden with the actual data
    if (otherRelation.type == null) {
      // assume other side of relation is the opposite
      const referencedType = relationType === "ONE" ? "MANY" : "ONE";
      otherRelation.name = relationName;
      otherRelation.type = referencedType;
      otherRelation.schemaName = referencedSchemaName;
      otherRelation.tableName = referencedTableName;
      otherRelation.columnName = referencedType === "ONE" ? _referencingColumnNameHelper(virtualColumnName) : otherRelation.columnName;
      // "invent" virtual column name by making plural (maybe a library later for real plurals)
      otherRelation.virtualColumnName = `${relationTableName.toLowerCase()}s`;
      // otherRelation.onUpdate           = null; // can't be "invented"
      // otherRelation.onDelete           = null; // can't be "invented"
      // otherRelation.description        = null;
      otherRelation.reference.schemaName = relationSchemaName;
      otherRelation.reference.tableName = relationTableName;
      otherRelation.reference.columnName = referencedType === "MANY" ? null : otherRelation.reference.columnName || "id"; // fallback is 'id'
    }

    // adjust for MANY:MANY
    if (thisRelation.type === "MANY" && otherRelation.type === "MANY") {
      thisRelation.reference.columnName = referencedColumnName;
      thisRelation.columnName = _referencingColumnNameHelper(thisRelation.virtualColumnName, true);

      otherRelation.reference.columnName = referencedColumnName;
      otherRelation.columnName = _referencingColumnNameHelper(otherRelation.virtualColumnName, true);
    }
  }

  // fk column naming convention: {name}_{foreignTableName}_{foreignFieldName}
  function _referencingColumnNameHelper(pVirtualColumnName: string, pIsArray: boolean = false) {
    return !pIsArray ? `${pVirtualColumnName}Id` : `${pVirtualColumnName}IdsArray`;
  }
}

export function addMigration(gQlDirectiveNode, dbMetaNode, refDbMeta) {
  const oldNameArgument = gQlDirectiveNode.arguments.find((argument) => {
    return argument.name.value.toLowerCase() === "from";
  });

  const oldName = oldNameArgument != null ? oldNameArgument.value.value : null;
  const newName = dbMetaNode.name;
  // add oldName to dbMeta node
  if (dbMetaNode != null && oldName != null) {
    dbMetaNode.oldName = oldName;
  }

  // check if node has schemaName (= table), if so, check for oldSchemaName
  if (dbMetaNode.schemaName != null) {
    const oldSchemaNameArgument = gQlDirectiveNode.arguments.find((argument) => {
      return argument.name.value.toLowerCase() === "fromschema";
    });
    const oldSchemaName = oldSchemaNameArgument != null ? oldSchemaNameArgument.value.value : null;

    // add oldSchemaName to dbMeta node
    if (dbMetaNode != null && oldSchemaName != null) {
      dbMetaNode.oldSchemaName = oldSchemaName;
    }
  }
}
