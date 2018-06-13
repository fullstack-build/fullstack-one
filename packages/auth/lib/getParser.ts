
function getAuthTokenArgument() {
  return {
    kind: 'InputValueDefinition',
    name: {
      kind: 'Name',
      value: 'authToken'
    },
    type: {
      kind: 'NamedType',
      name: {
        kind: 'Name',
        value: 'String'
      }
    },
    defaultValue: null,
    directives: []
  };
}

function getPrivacyTokenArgument() {
  return {
    kind: 'InputValueDefinition',
    name: {
      kind: 'Name',
      value: 'privacyToken'
    },
    type: {
      kind: 'NamedType',
      name: {
        kind: 'Name',
        value: 'String'
      }
    },
    defaultValue: null,
    directives: []
  };
}

function getMetaArgument() {
  return {
    kind: 'InputValueDefinition',
    name: {
      kind: 'Name',
      value: 'meta'
    },
    type: {
      kind: 'NamedType',
      name: {
        kind: 'Name',
        value: 'String'
      }
    },
    defaultValue: null,
    directives: []
  };
}

export function getParser(setParserMeta, getParserMeta) {
  const parser: any = {};

  parser.parseReadField = (ctx) => {
    const { fieldName, directives, table } = ctx;

    if (directives.privacyPolicyAcceptedVersion != null) {
      setParserMeta('privacyPolicyAcceptedVersion', fieldName);
    }
    if (directives.privacyPolicyAcceptedAtInUTC != null) {
      setParserMeta('privacyPolicyAcceptedAtInUTC', fieldName);
    }
    if (directives.username != null) {
      setParserMeta('username', fieldName);
    }
    if (directives.tenant != null) {
      setParserMeta('tenant', fieldName);
    }
    if (directives.password != null) {
      setParserMeta('password', fieldName);
    }
    if (directives.password != null || directives.tenant != null || directives.username != null) {
      setParserMeta('authTableName', table.tableName);
      setParserMeta('authSchemaName', table.schemaName);
      setParserMeta('authGqlTypeName', table.gqlTypeName);
    }

    return null;
  };

  parser.modifyMutation = (mutation) => {
    if (mutation.type === 'CREATE' && mutation.gqlTypeName === getParserMeta('authGqlTypeName')) {
      mutation.gqlReturnTypeName = 'ID';
      mutation.extensions.auth = 'REGISTER_USER_MUTATION';

      return {
        mutation,
        extendArguments: [
          getAuthTokenArgument(),
          getPrivacyTokenArgument(),
          getMetaArgument()
        ]
      };
    }

    return null;
  };

  return parser;
}