import { registerDirectiveParser } from '@fullstack-one/graphql-parser';

// Auth directives
registerDirectiveParser('auth', (gQlDirectiveNode, dbMetaNode, refDbMeta, refDbMetaCurrentTable, refDbMetaCurrentTableColumn) => {
    const directiveKind = gQlDirectiveNode.name.value;
    setAuthValueForColumn(directiveKind,
                          gQlDirectiveNode,
                          dbMetaNode,
                          refDbMeta,
                          refDbMetaCurrentTable,
                          refDbMetaCurrentTableColumn);
});
registerDirectiveParser('tenant', (gQlDirectiveNode, dbMetaNode, refDbMeta, refDbMetaCurrentTable, refDbMetaCurrentTableColumn) => {
    const directiveKind = gQlDirectiveNode.name.value;
    setAuthValueForColumn(directiveKind,
                          gQlDirectiveNode,
                          dbMetaNode,
                          refDbMeta,
                          refDbMetaCurrentTable,
                          refDbMetaCurrentTableColumn);
});
registerDirectiveParser('username', (gQlDirectiveNode, dbMetaNode, refDbMeta, refDbMetaCurrentTable, refDbMetaCurrentTableColumn) => {
    const directiveKind = gQlDirectiveNode.name.value;
    setAuthValueForColumn(directiveKind,
                          gQlDirectiveNode,
                          dbMetaNode,
                          refDbMeta,
                          refDbMetaCurrentTable,
                          refDbMetaCurrentTableColumn);
});
registerDirectiveParser('password', (gQlDirectiveNode, dbMetaNode, refDbMeta, refDbMetaCurrentTable, refDbMetaCurrentTableColumn) => {
    const directiveKind = gQlDirectiveNode.name.value;
    setAuthValueForColumn(directiveKind,
                          gQlDirectiveNode,
                          dbMetaNode,
                          refDbMeta,
                          refDbMetaCurrentTable,
                          refDbMetaCurrentTableColumn);
});

export function setAuthValueForColumn(directiveKind,
                                      gQlSchemaNode,
                                      dbMetaNode,
                                      refDbMeta,
                                      refDbMetaCurrentTable,
                                      refDbMetaCurrentTableColumn) {

    const directiveKindLowerCase = directiveKind.toLowerCase();

    let pathToDirective = '';
    if (refDbMetaCurrentTable != null && refDbMetaCurrentTable.name) {
        pathToDirective = refDbMetaCurrentTable.name;
    }
    if (refDbMetaCurrentTableColumn != null && refDbMetaCurrentTableColumn.name) {
        pathToDirective += '.' + refDbMetaCurrentTableColumn.name;
    }

    if (directiveKindLowerCase === 'auth') {
        // check if other tables were marked already
        // collect all tables from all schemas
        const allTables: any =
            Object.values(refDbMeta.schemas).reduce((result: any, schema: any) => [...result, ...Object.values(schema.tables)], []);

        const markedAuthTables = allTables.filter(table => table.isAuth);
        if (markedAuthTables.length === 0) {
            // set table to auth
            refDbMetaCurrentTable.isAuth = true;
        } else { // other table was marked already
            process.stderr.write(
                'GraphQL.parser.error.table.auth.multiple.tables: ' +
                pathToDirective + '.' + directiveKind + '\n',
            );
        }

    } else { // mark field

        // only possible on tables that were marked as auth
        if (refDbMetaCurrentTable.isAuth) {
            // only one attribute per field is possible
            if (dbMetaNode.auth == null) {
                // add marked different types
                switch (directiveKindLowerCase) {
                    case 'tenant':
                        // check if other columns were already marked same marker
                        const columnMarkedTenant =
                            Object.values(refDbMetaCurrentTable.columns).filter((column: any) => (column.auth && column.auth.isTenant));

                        if (columnMarkedTenant.length === 0) {
                            dbMetaNode.auth = {
                                isTenant: true
                            };
                        } else { // multiple columns marked with same marker
                            process.stderr.write(
                                'GraphQL.parser.error.table.auth.multiple.columns: ' +
                                pathToDirective + '.' + directiveKind + '\n',
                            );
                        }

                        break;
                    case 'username':
                        // check if other columns were already marked same marker
                        const columnMarkedUsername = Object.values(refDbMetaCurrentTable.columns).filter(
                            (column: any) => (column.auth && column.auth.isUsername));
                        if (columnMarkedUsername.length === 0) {
                            dbMetaNode.auth = {
                                isUsername: true
                            };
                        } else { // multiple columns marked with same marker
                            process.stderr.write(
                                'GraphQL.parser.error.table.auth.multiple.columns: ' +
                                pathToDirective + '.' + directiveKind + '\n',
                            );
                        }
                        break;
                    case 'password':
                        // check if other columns were already marked same marker
                        const columnMarkedPassword = Object.values(refDbMetaCurrentTable.columns).filter(
                            (column: any) => (column.auth && column.auth.isPassword));
                        if (columnMarkedPassword.length === 0) {
                            // mark as password
                            dbMetaNode.auth = {
                                isPassword: true
                            };
                            // set type to json
                            dbMetaNode.type = 'jsonb';
                        } else { // multiple columns marked with same marker
                            process.stderr.write(
                                'GraphQL.parser.error.table.auth.multiple.columns: ' +
                                pathToDirective + '.' + directiveKind + '\n',
                            );
                        }
                        break;
                }
            } else {
                process.stderr.write(
                    'GraphQL.parser.error.table.auth.multiple.properties: ' +
                    pathToDirective + '.' + directiveKind + '\n',
                );
            }
        } else {
            process.stderr.write(
                'GraphQL.parser.error.table.auth.missing: ' +
                pathToDirective + '.' + directiveKind + '\n',
            );
        }

    }
}