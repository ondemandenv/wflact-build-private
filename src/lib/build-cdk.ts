import {BuildBase} from "./build-base";

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
        await this.exeCmd(`npm install`);

        for (const preCdkCmd of this.preCdkCmds) {
            await this.exeCmd(preCdkCmd);
        }

        await this.exeCmd(`cdk ls`);
        // let rollBackStr = `${this.csProps!.disableAutoRollback ? '--no-rollback' : ''}`
        const rollBackStr = ``;
        const contextsStr = this.contextStrs.join() ?? "";

        for (const clientStackName of this.clientStackNames) {
            await this.exeCmd(`cdk`, [`deploy`, contextsStr, clientStackName, rollBackStr, '--require-approval never'])
        }
    }
}
