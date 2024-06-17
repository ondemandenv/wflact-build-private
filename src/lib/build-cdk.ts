import {BuildBase} from "./build-base";
import {CloudFormationClient, DescribeStacksCommand} from "@aws-sdk/client-cloudformation";

import * as core from "@actions/core";
import * as fs from 'fs';
import {BuildConst} from "../build-const";
import {PutParameterCommand, SSMClient} from "@aws-sdk/client-ssm";


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
        const pkgDeps: { [k: string]: string } = {}
        const pkgJsn = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
        for (const k in pkgJsn.devDependencies) {
            if (k.startsWith("@ondemandenv/")) {
                pkgDeps[k] = pkgJsn.devDependencies[k]
            }
        }
        for (const k in pkgJsn.dependencies) {
            if (k.startsWith("@ondemandenv/")) {
                pkgDeps[k] = pkgJsn.dependencies[k]
            }
        }

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


        for (let i = 0; i < this.clientStackNames.length; i++) {
            const clientStackName = this.clientStackNames[i];
            const rollBackStr = stackExists[i] ? '' : '--no-rollback';
            const args = [`deploy`, this.contextStrs.join() ?? "", clientStackName, rollBackStr, '--require-approval never']
            // console.log(args)
            await this.exeCmd(`cdk`, args)
        }

        const ssm = new SSMClient({region: BuildConst.inst.awsRegion})

        try {
            const putdeps = await ssm.send(new PutParameterCommand({
                Name: `/odmd/${BuildConst.inst.buildId}/${BuildConst.inst.targetRevRefPathPart}/stacks_deps`,
                Overwrite: true,
                Type: 'String',
                Value: JSON.stringify(pkgDeps)
            }))

            console.log(JSON.stringify(putdeps))
        } catch (e) {
            core.error(JSON.stringify(e));
        }

    }
}
