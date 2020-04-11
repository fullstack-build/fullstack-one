import * as path from "path";
import * as _ from "lodash";

import { Container } from "../index";
import { DefaultConfigNotFoundError } from "./errors";
import ConfigMergeHelper from "./helpers/ConfigMergeHelper";
import EnvironmentBuilder from "./helpers/EnvironmentBuilder";
import { IEnvironment } from "./IEnvironment";

export { IEnvironment };

export class Config {
  private applicationConfig: any = {};
  private config: any = {};

  private readonly NODE_ENV: string = process.env?.NODE_ENV ?? "production";
  public readonly ENVIRONMENT: IEnvironment;

  constructor() {
    this.applicationConfig = this.loadApplicationConfig();
    this.registerConfig("Config", `${__dirname}/../config`);

    const namespace = this.config.Config.namespace;
    this.ENVIRONMENT = EnvironmentBuilder.buildEnvironment(
      this.NODE_ENV,
      namespace
    );
    Container.set("ENVIRONMENT", JSON.parse(JSON.stringify(this.ENVIRONMENT)));
  }

  private loadApplicationConfig(): object {
    const applicationConfigFolderPath = `${path.dirname(
      require.main?.filename ?? ""
    )}/config`;
    return this.getConfigFromConfigFiles(applicationConfigFolderPath);
  }

  private getConfigFromConfigFiles(configDirectory: string): object {
    const defaultConfigPath = `${configDirectory}/default.js`;
    const environmentConfigPath = `${configDirectory}/${this.NODE_ENV}.js`;

    let defaultConfig: object;
    try {
      defaultConfig = require(defaultConfigPath);
    } catch (err) {
      throw new DefaultConfigNotFoundError(
        `config.default.loading.error.not.found: ${defaultConfigPath} \n ${err}`
      );
    }

    let environmentConfig: object;
    try {
      environmentConfig = require(environmentConfigPath);
    } catch (err) {
      environmentConfig = {};
    }

    return _.defaultsDeep(environmentConfig, defaultConfig);
  }

  private applyConfigModule(name: string, baseConfigModule: object): void {
    if (name in this.config) return;

    const applicationConfigOfModule = this.applicationConfig[name] || {};
    const processEnvironmentConfigOfModule = ConfigMergeHelper.getProcessEnvironmentConfig(
      name
    );

    const configModule = _.defaultsDeep(
      processEnvironmentConfigOfModule,
      applicationConfigOfModule,
      baseConfigModule
    );

    ConfigMergeHelper.checkForMissingConfigProperties(name, configModule);

    this.config[name] = configModule;
  }

  public registerConfig(name: string, configDirectory: string): any {
    const baseConfigModule = this.getConfigFromConfigFiles(configDirectory);
    this.applyConfigModule(name, baseConfigModule);
    return this.getConfig(name);
  }

  public registerApplicationConfigModule(name: string): any {
    const baseConfigModule = {};
    this.applyConfigModule(name, baseConfigModule);
    return this.getConfig(name);
  }

  public getConfig(name: string): any {
    if (!_.has(this.config, name)) {
      throw new Error(`config.module.not.found module name: ${name}`);
    }
    return _.cloneDeep(this.config[name]);
  }

  public dangerouslyGetWholeConfig(): any {
    return _.cloneDeep(this.config);
  }
}
