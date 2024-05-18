import { exec } from "child_process";
import { BuildConst } from "../build-const";

export class BuildBase {
  exeCmd(cmd: string): Promise<string> {
    console.log(`******>>>exeCmd:
    ${cmd}
-----`);
    return new Promise((resolve, reject) => {
      exec(cmd, (error: any, stdout: string, stderr: string) => {
        if (error) {
          console.error(error);
          reject(error);
        }
        console.error(stdout || stderr);

        resolve(stdout || stderr);
        console.log(`******<<<exeCmd`);
      });
    });
  }

  async run() {
    if (BuildConst.inst.workDirs.length > 1) {
      await this.exeCmd(`cd ${BuildConst.inst.workDirs}`);
    }
    await this.exeCmd(`pwd`);
    await this.exeCmd(`ls -ltarh`);
  }
}
