import * as _ from "lodash";

import { MissingConfigPropertiesError } from "../errors";

class ConfigMergeHelper {
  public static checkForMissingConfigProperties(
    moduleName: string,
    config: object
  ): void {
    const missingProperties: string[] = [];
    this.deepForEach(config, (key, val, nestedPath) => {
      if (val == null) {
        missingProperties.push(nestedPath);
      }
    });

    if (missingProperties.length > 0) {
      throw new MissingConfigPropertiesError(moduleName, missingProperties);
    }
  }

  public static getProcessEnvironmentConfig(moduleName: string): any {
    const processEnvironmentConfig = {};

    Object.entries(process.env).forEach(
      ([key, value]: [string, string | undefined]) => {
        if (value != null) {
          const parsedValue: any = this.parseTrueAndFalseToBooleans(value);
          _.set(processEnvironmentConfig, key, parsedValue);
        }
      }
    );

    const processEnvironmentConfigOfModule =
      processEnvironmentConfig[moduleName] || {};

    return processEnvironmentConfigOfModule;
  }

  private static parseTrueAndFalseToBooleans(value: string): any {
    const lowerCaseValue = value.toLocaleLowerCase();
    if (lowerCaseValue === "true") return true;
    if (lowerCaseValue === "false") return false;
    return value;
  }

  private static deepForEach(
    obj: object,
    callback: (key: string, val: any, nestedPath: string) => void,
    nestedPath = ""
  ) {
    Object.entries(obj).map((entry) => {
      const newPath = `${nestedPath}${entry[0]}.`;
      typeof entry[1] === "object" && entry[1] != null
        ? this.deepForEach(entry[1], callback, newPath)
        : callback(entry[0], entry[1], newPath.slice(0, -1));
    });
  }
}

export default ConfigMergeHelper;
