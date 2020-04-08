import { Service, Inject } from "@fullstack-one/di";
import { SchemaBuilder } from "@fullstack-one/schema-builder";
import { GraphQl, ReturnIdHandler } from "@fullstack-one/graphql";
import { Auth, AuthProvider, IAuthFactorForProof } from "..";
import * as _ from "lodash";

const schema = `
extend type Mutation {
  """
  Creates a new email AuthFactorCreationToken for the given email-address.
  """
  createEmail(email: String!, returnId: String): String! @custom(resolver: "@fullstack-one/auth/EmailProvider/createEmail", usesQueryRunnerFromContext: true)

  """
  This will send an AuthFactorProofToken via mail to the user if the user exists and has an email-address.
  This will never fail.
  """
  initiateEmailProof(userIdentifier: String!, info: String): Boolean @custom(resolver: "@fullstack-one/auth/EmailProvider/initiateEmailProof")
}
`;

export interface IProofMailPayload {
  email: string;
  authFactorProofToken: string;
  userId: string;
  userAuthenticationId: string;
  info: string;
}

@Service()
export class AuthProviderEmail {
  private authProvider: AuthProvider;
  private sendMail: (mail: IProofMailPayload) => void;

  constructor(
    @Inject((type) => SchemaBuilder) schemaBuilder: SchemaBuilder,
    @Inject((type) => GraphQl) graphQl: GraphQl,
    @Inject((type) => Auth) auth: Auth
  ) {
    schemaBuilder.extendSchema(schema);
    graphQl.addResolvers(this.getResolvers());

    this.authProvider = auth.createAuthProvider("email", 60 * 60 * 24);
  }

  private async createEmail(email: string) {
    return this.authProvider.create(email.toLowerCase(), email.toLowerCase(), false, { email: email.toLowerCase() });
  }

  private async initiateEmailProof(userIdentifier: string, info: string = null): Promise<void> {
    this.authProvider.getAuthQueryHelper().transaction(async (queryRunner) => {
      let currentAuthFactor: IAuthFactorForProof;

      const authFactorProofToken = (await this.authProvider.proof(queryRunner, userIdentifier, async (authFactor: IAuthFactorForProof) => {
        currentAuthFactor = authFactor;

        return authFactor.communicationAddress;
      })).authFactorProofToken;

      if (currentAuthFactor != null && currentAuthFactor.communicationAddress != null) {
        const proofMailPayload: IProofMailPayload = {
          email: currentAuthFactor.communicationAddress,
          authFactorProofToken,
          userId: currentAuthFactor.userId,
          userAuthenticationId: currentAuthFactor.userAuthenticationId,
          info
        };

        this.sendMail(proofMailPayload);
      }
    });
  }

  private async callAndHideErrorDetails(callback) {
    try {
      return await callback();
    } catch (error) {
      _.set(error, "extensions.hideDetails", true);
      throw error;
    }
  }

  private getResolvers() {
    return {
      "@fullstack-one/auth/EmailProvider/createEmail": async (obj, args, context, info, params, returnIdHandler: ReturnIdHandler) => {
        const token = await this.createEmail(args.email);
        if (returnIdHandler.setReturnId(token)) {
          return "Token hidden due to returnId usage.";
        }
        return token;
      },
      "@fullstack-one/auth/EmailProvider/initiateEmailProof": async (obj, args, context, info, params, returnIdHandler: ReturnIdHandler) => {
        try {
          // Don't await this. because we want to make no hint to an attacker wether a user with this email exists or not
          this.initiateEmailProof(returnIdHandler.getReturnId(args.userIdentifier), args.info);
        } catch (err) {
          /* Ignore Error */
        }
        return true;
      }
    };
  }

  public registerSendMailCallback(callback: (mail: IProofMailPayload) => void) {
    if (this.sendMail != null) {
      throw new Error("EmailAuthProvider 'registerSendMailCallback' can only be called once.");
    }
    this.sendMail = callback;
  }
}
