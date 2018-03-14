"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function getTypenamesArgument(typesEnumName) {
    return {
        kind: 'InputValueDefinition',
        name: {
            kind: 'Name',
            value: 'viewnames'
        },
        type: {
            kind: 'ListType',
            type: {
                kind: 'NonNullType',
                type: {
                    kind: 'NamedType',
                    name: {
                        kind: 'Name',
                        value: typesEnumName
                    }
                }
            }
        },
        defaultValue: null,
        directives: []
    };
}
function getSqlArgument() {
    return {
        kind: 'InputValueDefinition',
        name: {
            kind: 'Name',
            value: 'sql',
        },
        type: {
            kind: 'NamedType',
            name: {
                kind: 'Name',
                value: 'SqlQuery',
            },
        },
        defaultValue: null,
        directives: [],
    };
}
exports.default = (typesEnumName) => {
    const args = [
        getTypenamesArgument(typesEnumName),
        getSqlArgument()
    ];
    return args;
};
