import * as core from "@actions/core";
// import { wait } from './wait'
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import * as process from "process";
import * as fs from "fs";
import * as path from "path";

function printFolderTree(folderPath: string, level: number = 0) {
  const indent = "  ".repeat(level);
  const items = fs.readdirSync(folderPath);

  for (const item of items) {
    const itemPath = path.join(folderPath, item);
    const stats = fs.statSync(itemPath);

    if (stats.isDirectory()) {
      console.log(`${indent}📁 ${item}`);
      printFolderTree(itemPath, level + 1);
    } else {
      console.log(`${indent}📄 ${item}`);
    }
  }
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  console.log(`>>>>>>>>>`);
  for (const tmp in process.env) {
    core.warning(tmp + ">>>>" + process.env[tmp]);
  }

  printFolderTree(".");

  const sts = new STSClient({ region: process.env.AWS_DEFAULT_REGION });
  const callerId = await sts.send(new GetCallerIdentityCommand({}));

  core.error(">>>>");
  core.error(JSON.stringify(callerId, null, 2));
  core.error("<<<<");

  return Promise.resolve();
}
