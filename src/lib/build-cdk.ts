import {BuildBase} from "./build-base";
import {CloudFormationClient, DescribeStacksCommand} from "@aws-sdk/client-cloudformation";

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

        const client = new CloudFormationClient({region: process.env.AWS_DEFAULT_REGION!});
        const stackExists = await Promise.all(this.clientStackNames.map(async stackName => {
            try {
                await client.send(new DescribeStacksCommand({StackName: stackName}));
                return true;
            } catch (er) {
                const error = er as Error
                if (error.name === 'ValidationError' && error.message.includes('does not exist')) {
                    return false;
                } else {
                    throw error;
                }
            }
        }))


        const contextsStr = this.contextStrs.join() ?? "";

        for (let i = 0; i < this.clientStackNames.length; i++) {
            const clientStackName = this.clientStackNames[i];
            const rollBackStr = stackExists[i] ? '' : '--no-rollback';
            const args = [`deploy`, contextsStr, clientStackName, rollBackStr, '--require-approval never']
            // console.log(args)
            await this.exeCmd(`cdk`, args )
        }
    }
}
