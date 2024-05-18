import { exec } from "child_process";
import { ODMD_workDirs } from "../main";

export class BuildBase {
  exeCmd(cmd: string): Promise<string> {
    console.log(`*********exeCmd:
    ${cmd}
*************`);
    return new Promise((resolve, reject) => {
      exec(cmd, (error: any, stdout: string, stderr: string) => {
        if (error) {
          reject(error);
        }
        resolve(stdout || stderr);
      });
    });
  }

  async run() {
    if (ODMD_workDirs.length > 1) {
      await this.exeCmd(`cd ${ODMD_workDirs}`);
    }
  }
}
