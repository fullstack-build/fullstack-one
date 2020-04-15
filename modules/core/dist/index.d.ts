import "reflect-metadata";
import { Service, Container, ContainerInstance, Inject, InjectMany } from "typedi";
export { Service, Container, ContainerInstance, Inject, InjectMany };
import { Logger } from "./Logger";
import { ConfigManager, IEnvironment } from "./ConfigManager";
export { IEnvironment };
export { Logger };
export declare class Core {
    private readonly className;
    private readonly bootLoader;
    readonly configManager: ConfigManager | undefined;
    readonly ENVIRONMENT: IEnvironment;
    private readonly logger;
    private constructor();
    private drawCliArt;
    boot(): Promise<void>;
}
