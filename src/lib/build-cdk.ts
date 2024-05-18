import { BuildBase } from "./build-base";

export class BuildCdk extends BuildBase {
  private readonly clientStackNames: string[];
  private readonly cdkVer: string;
  private readonly preCdkCmds: string[];
  private readonly contextStrs: string[];

  constructor(
    clientStackNames: string[],
    cdkVer: string,
    preCdkCmds: string[],
    ctxStr: string[],
  ) {
    super();
    this.clientStackNames = clientStackNames;
    this.cdkVer = cdkVer;
    this.preCdkCmds = preCdkCmds;
    this.contextStrs = ctxStr;
  }

  async run() {
    await super.run();

    await this.exeCmd(`npm install -g aws-cdk@${this.cdkVer}`);
    await this.exeCmd(`npm install -g cross-env`);

    for (const preCdkCmd of this.preCdkCmds) {
      await this.exeCmd(preCdkCmd);
    }

    await this.exeCmd(`npm install`);
    await this.exeCmd(`cdk ls`);
    // let rollBackStr = `${this.csProps!.disableAutoRollback ? '--no-rollback' : ''}`
    const rollBackStr = ``;
    await this.exeCmd(
      `cdk deploy ${this.contextStrs.join() ?? ""} ${this.clientStackNames}  ${rollBackStr} --require-approval never -vvv`,
    );
  }
}
