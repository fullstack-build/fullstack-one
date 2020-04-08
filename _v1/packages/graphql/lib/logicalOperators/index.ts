import * as equal from "./equal";
import * as lessAndGreaterThan from "./lessAndGreaterThan";
import * as boolean from "./boolean";
import * as inOperators from "./in";
import * as pattern from "./pattern";
import { IOperatorObject, IOperator } from "./types";
import getDuplicates from "./helpers/getDuplicates";
import getOperatorsDefinitionNode from "./helpers/getOperatorsDefinitionNode";
import getOperatorsSchemaExtension from "./helpers/getOperatorsSchemaExtension";

export * from "./types";

const operatorsObject: IOperatorObject = { ...equal, ...lessAndGreaterThan, ...boolean, ...inOperators, ...pattern };

const operatorNames = Object.values(operatorsObject).map(({ name }) => name);
const duplicateOpertorNames = getDuplicates(operatorNames);
if (duplicateOpertorNames.length !== 0) {
  throw new Error(`Operators have been defined twice or more: '${duplicateOpertorNames}'`);
}

export function getOperator(name: string): IOperator | undefined {
  return Object.values(operatorsObject).find((operator) => operator.name === name);
}

export const operatorsSchemaExtension: string = getOperatorsSchemaExtension(operatorsObject);

export const operatorsDefinitionNode = getOperatorsDefinitionNode(operatorsObject);
