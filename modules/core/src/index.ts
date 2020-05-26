import "reflect-metadata";
const STARTUP_TIME: [number, number] = process.hrtime();
// DI
import { Service, Container, ContainerInstance, Inject, InjectMany } from "typedi";
import { Pool, PoolClient, PoolConfig, QueryResult } from "pg";
import * as Ajv from "ajv";
import { Logger, TLogLevelName } from "tslog";

import { IModuleRuntimeConfig, IModuleAppConfig } from "./interfaces";
import { getLatestMigrationVersion, ICoreMigration } from "./helpers";
import { Migration } from "./Migration";
import { SoniqApp, SoniqEnvironment } from "./Application";
import { IModuleMigrationResult } from "./Migration/interfaces";

export interface IGetModuleRuntimeConfigResult {
  runtimeConfig: IModuleRuntimeConfig;
  hasBeenUpdated: boolean;
}

export type TGetModuleRuntimeConfig = (updateKey?: string) => Promise<IGetModuleRuntimeConfigResult>;
export type TMigrationFuntion = (appConfig: IModuleAppConfig, pgClient: PoolClient) => Promise<IModuleMigrationResult>;
export type TBootFuntion = (getRuntimeConfig: TGetModuleRuntimeConfig, pgPool: Pool) => Promise<void>;

export interface IModuleCoreFunctions {
  key: string;
  migrate?: TMigrationFuntion;
  boot?: TBootFuntion;
}

export * from "./interfaces";
export * from "./Migration/interfaces";
export * from "./Migration/constants";
export * from "./Migration/helpers";
export * from "./Application";
export { Pool, PoolClient, PoolConfig, QueryResult, Ajv };

export enum EBootState {
  Initial = "initial",
  Booting = "booting",
  Finished = "finished",
}

export { Service, Container, ContainerInstance, Inject, InjectMany };
export { Logger };

// TODO: move somewhere else later
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

@Service()
export class Core {
  private readonly _className: string = this.constructor.name;
  private readonly _logger: Logger;
  private _state: EBootState = EBootState.Initial;

  private _modules: IModuleCoreFunctions[] = [];
  private _bootReadyPromiseResolver: ((value?: unknown) => void)[] = [];

  private _runTimePgPool: Pool | undefined;
  private _migration: Migration;

  public constructor() {
    // TODO: catch all errors & exceptions
    this._logger = this.getLogger(this._className);
    this._migration = new Migration(this._logger, this);
  }

  public _getModuleCoreFunctionsByKey(key: string): IModuleCoreFunctions | null {
    for (const module of this._modules) {
      if (module.key === key) {
        return module;
      }
    }
    return null;
  }

  public async deployApp(app: SoniqApp, env: SoniqEnvironment): Promise<void> {
    return this._migration.deployApp(app, env);
  }

  private _getModuleRuntimeConfigGetter(moduleKey: string): TGetModuleRuntimeConfig {
    return async () => {
      if (this._runTimePgPool == null) {
        throw new Error("Cannot call getModuleRuntimeConfigGetter when the Pool is not started");
      }

      const pgClient: PoolClient = await this._runTimePgPool.connect();
      try {
        const latestMigration: ICoreMigration = await getLatestMigrationVersion(pgClient);
        await pgClient.release();

        if (latestMigration == null) {
          throw new Error("This database has no runtimeConfig.");
        }
        return {
          runtimeConfig: latestMigration.runtimeConfig[moduleKey],
          hasBeenUpdated: true,
        };
      } catch (err) {
        this._logger.error(`core.boot.error.caught: ${err}\n`);
        throw err;
      }
    };
  }

  public getBootState(): EBootState {
    return this._state;
  }

  public isBooting(): boolean {
    return this._state === EBootState.Booting;
  }

  public hasBooted(): boolean {
    return this._state === EBootState.Finished;
  }

  public addCoreFunctions(moduleCoreFunctions: IModuleCoreFunctions): void {
    this._modules.push(moduleCoreFunctions);
  }

  public hasBootedPromise(): Promise<unknown> | true {
    if (this.hasBooted()) {
      return true;
    } else {
      return new Promise((resolve) => {
        this._bootReadyPromiseResolver.push(resolve);
      });
    }
  }

  public async boot(pgPoolConfig: PoolConfig): Promise<void> {
    this._logger.info("Booting Application...");
    this._runTimePgPool = new Pool(pgPoolConfig);
    this._state = EBootState.Booting;

    try {
      for (const moduleObject of this._modules) {
        if (moduleObject.boot != null) {
          this._logger.info("Module-boot: Start => ", moduleObject.key);
          await moduleObject.boot(this._getModuleRuntimeConfigGetter(moduleObject.key), this._runTimePgPool);
          this._logger.info("Module-boot: Finished => ", moduleObject.key);
        }
      }
      this._state = EBootState.Finished;

      this._logger.info("Finished Module-boot", `Took ${process.hrtime(STARTUP_TIME)} seconds.`);

      for (const resolverFunction of this._bootReadyPromiseResolver) {
        try {
          resolverFunction();
        } catch (err) {
          // Ignore Errors because this is only an Event
        }
      }
      this._logger.info("Soniq Worker running!");
    } catch (err) {
      this._logger.error(`Module-boot failed`, err);
      throw err;
    }
    this._drawCliArt();
  }

  private _drawCliArt(): void {
    process.stdout.write(
      `     
  ___  ___  _ __  _  __ _ 
 / __|/ _ \\| '_ \\| |/ _\` |
 \\__ \\ (_) | | | | | (_| |
 |___/\\___/|_| |_|_|\\__, |
                       | |
                       |_|\n`
    );
    process.stdout.write("____________________________________\n");
    /* process.stdout.write(JSON.stringify({ no: "env" }, undefined, 2) + "\n");
    process.stdout.write("====================================\n"); */
  }

  public getLogger(name?: string, minLevel: TLogLevelName = "silly", exposeStack: boolean = false): Logger {
    return new Logger({
      instanceName: "123", // TODO: Set instance-name
      name,
      minLevel,
      exposeStack,
      displayInstanceName: true,
    });
  }
}
