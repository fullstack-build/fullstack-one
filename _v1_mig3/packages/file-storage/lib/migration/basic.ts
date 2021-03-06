import { IDbSchema, IDbFunction } from "@fullstack-one/graphql";
import { authTablesSchema } from "./tables";

import { readFile, readdir } from "fs";

export async function generateFileStorageSchema(): Promise<IDbSchema> {
  const schema = JSON.parse(JSON.stringify(authTablesSchema));

  schema.functions = await loadFileStorageFunctions();

  return schema;
}

async function loadFileStorageFunctions(): Promise<IDbFunction[]> {
  const fileNames = await loadFileStorageFunctionList();
  const functions: IDbFunction[] = [];

  for (const fileName of fileNames) {
    const dbFunction: IDbFunction = {
      schema: "_file_storage",
      name: fileName.split(".")[1],
      definition: await readFunctionFile(fileName),
      runAfterTables: true
    };

    functions.push(dbFunction);
  }

  return functions;
}

function loadFileStorageFunctionList(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    readdir(`${__dirname}/../../pgFunctions`, (err, fileNames) => {
      if (err) {
        return reject(err);
      }
      resolve(fileNames);
    });
  });
}

function readFunctionFile(fileName: string): Promise<string> {
  return new Promise((resolve, reject) => {
    readFile(`${__dirname}/../../pgFunctions/${String(fileName)}`, { encoding: "utf-8" }, (err, data) => {
      if (err) {
        return reject(err);
      }
      resolve(data.toString());
    });
  });
}
