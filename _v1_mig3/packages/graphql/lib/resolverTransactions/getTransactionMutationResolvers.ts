import { ILogger } from "@fullstack-one/logger";
import { IFieldResolver } from "graphql-tools";
import { Pool } from "@fullstack-one/core";
import { ICustomResolverCreator } from ".";

export function getBeginTransactionResolver(pgPool: Pool, logger: ILogger): ICustomResolverCreator {
  return (resolver) => {
    return {
      usesPgClientFromContext: false,
      resolver: async (obj, args, context: any, info, revertibleResult) => {
        if (context._transactionPgClient != null) {
          throw new Error("You cannot begin a second transaction within another.");
        }

        let txidCurrent = "TransactionId is not available in production.";
        try {
          context._transactionPgClient = await pgPool.connect();
          context._transactionRollbackFunctions = [];
          context._transactionOnCommitedHandlers = [];
          context._transactionRunning = true;
          context._transactionIsAuthenticated = false;
          await context._transactionPgClient.query("BEGIN;");
          if (process.env.NODE_ENV !== "production") {
            const { rows } = await context._transactionPgClient.query("SELECT txid_current();");
            txidCurrent = rows[0].txid_current;
          }
        } catch (err) {
          logger.error("Failed to connect and create transaction.");
          try {
            await context._transactionPgClient.query("ROLLBACK;");
          } catch (e) {
            logger.error("Failed to rollback transaction.", e);
          }
          try {
            await context._transactionPgClient.release();
          } catch (e) {
            logger.error("Failed to release transactionPgClient.", e);
          } finally {
            context._transactionPgClient = null;
          }
          throw err;
        }
        return txidCurrent;
      }
    };
  };
}

export function getCommitTransactionResolver(pgPool: Pool, logger: ILogger): ICustomResolverCreator {
  return (resolver) => {
    return {
      usesPgClientFromContext: true,
      resolver: async (obj, args, context: any, info) => {
        if (context._transactionRunning !== true) {
          throw new Error("You cannot commit a not existing transaction.");
        }
        let txidCurrent = "TransactionId is not available in production.";
        try {
          if (process.env.NODE_ENV !== "production") {
            const { rows } = await context._transactionPgClient.query("SELECT txid_current();");
            txidCurrent = rows[0].txid_current;
          }

          await context._transactionPgClient.query("COMMIT;");

          context._transactionOnCommitedHandlers.forEach(async ({ onCommitedHandler, resolverKey }) => {
            try {
              await onCommitedHandler();
            } catch (err) {
              logger.error(`Failed to call onCommitedHandler of resolverKey '${resolverKey}'.`, err);
            }
          });
        } catch (err) {
          logger.error("Failed to commit transaction.");
          try {
            await context._transactionPgClient.query("ROLLBACK;");
          } catch (e) {
            logger.error("Failed to rollback transaction.", e);
          }
          throw err;
        } finally {
          try {
            await context._transactionPgClient.release();
          } catch (e) {
            logger.error("Failed to release transactionPgClient.", e);
          } finally {
            context._transactionPgClient = null;
          }
        }
        context._transactionRollbackFunctions = [];
        context._transactionOnCommitedHandlers = [];
        context._transactionRunning = false;
        context._transactionIsAuthenticated = false;

        return txidCurrent;
      }
    };
  };
}
