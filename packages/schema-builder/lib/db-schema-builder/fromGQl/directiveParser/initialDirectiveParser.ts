import * as _ from 'lodash';
import { addConstraint, setDefaultValueForColumn, addMigration } from '../gQlAstToDbMetaHelper';
import * as utils from '../../../gql-schema-builder/utils';
import { registerDirectiveParser } from './index';

const { parseDirectiveArguments } = utils;

// ignore table, just make it available
registerDirectiveParser('table', (gQlDirectiveNode, dbMetaNode, refDbMeta, refDbMetaCurrentTable, refDbMetaCurrentTableColumn) => {
    // nothing to do here -> has been done in ObjectTypeDefinition
});

// mark as computed
registerDirectiveParser('computed', (gQlDirectiveNode, dbMetaNode, refDbMeta, refDbMetaCurrentTable, refDbMetaCurrentTableColumn) => {
    dbMetaNode.type = 'computed';
});

// mark as customResolver
registerDirectiveParser('custom', (gQlDirectiveNode, dbMetaNode, refDbMeta, refDbMetaCurrentTable, refDbMetaCurrentTableColumn) => {
    dbMetaNode.type = 'customResolver';
});
// add unique constraint
registerDirectiveParser('unique', (gQlDirectiveNode, dbMetaNode, refDbMeta, refDbMetaCurrentTable, refDbMetaCurrentTableColumn) => {
    addConstraint('UNIQUE',
                gQlDirectiveNode,
                dbMetaNode,
                refDbMeta,
                refDbMetaCurrentTable,
                refDbMetaCurrentTableColumn);
});
// native PG check constraint
registerDirectiveParser('check', (gQlDirectiveNode, dbMetaNode, refDbMeta, refDbMetaCurrentTable, refDbMetaCurrentTableColumn) => {
    // iterate over all constraints
    gQlDirectiveNode.arguments.forEach((argument) => {
        addConstraint('CHECK',
                    argument,
                    dbMetaNode,
                    refDbMeta,
                    refDbMetaCurrentTable,
                    refDbMetaCurrentTableColumn);
    });
});
// validate constraint
registerDirectiveParser('validate', (gQlDirectiveNode, dbMetaNode, refDbMeta, refDbMetaCurrentTable, refDbMetaCurrentTableColumn) => {
        // iterate over all constraints
        gQlDirectiveNode.arguments.forEach((argument) => {
            addConstraint('validate',
                        argument,
                        dbMetaNode,
                        refDbMeta,
                        refDbMetaCurrentTable,
                        refDbMetaCurrentTableColumn);
        });
});
// embedded json types -> jsonb
registerDirectiveParser('json', (gQlDirectiveNode, dbMetaNode, refDbMeta, refDbMetaCurrentTable, refDbMetaCurrentTableColumn) => {
    dbMetaNode.type = 'jsonb';
});
// override type with PG native type
registerDirectiveParser('type', (gQlDirectiveNode, dbMetaNode, refDbMeta, refDbMetaCurrentTable, refDbMetaCurrentTableColumn) => {
    const customType = _.get(gQlDirectiveNode, 'arguments[0].value.value');
    // detect known PG types
    switch (customType) {
        case 'Date':
            dbMetaNode.type = 'date';
            break;
        default:
            dbMetaNode.type = 'customType';
            dbMetaNode.customType = customType;
            break;
    }
});
// set default value
registerDirectiveParser('default', (gQlDirectiveNode, dbMetaNode, refDbMeta, refDbMetaCurrentTable, refDbMetaCurrentTableColumn) => {
    setDefaultValueForColumn(gQlDirectiveNode,
                            dbMetaNode,
                            refDbMeta,
                            refDbMetaCurrentTable,
                            refDbMetaCurrentTableColumn);
});
// add special miration
registerDirectiveParser('migrate', (gQlDirectiveNode, dbMetaNode, refDbMeta, refDbMetaCurrentTable, refDbMetaCurrentTableColumn) => {
    addMigration(gQlDirectiveNode, dbMetaNode, refDbMeta);
});

// file trigger
registerDirectiveParser('files', (gQlDirectiveNode, dbMetaNode, refDbMeta, refDbMetaCurrentTable, refDbMetaCurrentTableColumn) => {
    refDbMetaCurrentTable.extensions.fileTrigger = {
        isActive: true
    };
    const directiveArguments: any = parseDirectiveArguments(gQlDirectiveNode);
    refDbMetaCurrentTableColumn.isFileColumn = {
        isActive: true,
        types: JSON.stringify(directiveArguments.types || ['DEFAULT'])
    };
});
