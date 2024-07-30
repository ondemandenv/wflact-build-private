import {BuildBase} from "./build-base";
import {CloudFormationClient, DescribeStacksCommand} from "@aws-sdk/client-cloudformation";

import * as fs from 'fs';
import {BuildConst} from "../build-const";


export class BuildCdk extends BuildBase {
    private readonly clientStackNames: string[];
    private readonly cdkVer: string;
    private readonly preInstallCmds: string[];
    private readonly preCdkCmds: string[];
    private readonly contextStrs: string[];

    constructor(
        clientStackNames: string[],
        cdkVer: string,
        preInstallCmds: string[],
        preCdkCmds: string[],
        ctxStr: string[],
    ) {
        super();
        this.clientStackNames = clientStackNames;
        this.cdkVer = cdkVer;
        this.preInstallCmds = preInstallCmds
        this.preCdkCmds = preCdkCmds;
        this.contextStrs = ctxStr;
    }


    async run() {
        await super.run();
        const pkgDeps: { [k: string]: string } = {}
        const pkgJsn = JSON.parse(fs.readFileSync(BuildConst.inst.workDirs + '/package.json', 'utf-8'));
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

        for (const preInstall of this.preInstallCmds) {
            await this.exeCmd(preInstall)
        }

        await this.exeCmd(`npm install -g aws-cdk@${this.cdkVer}`);
        await this.exeCmd(`npm install -g cross-env`);

        await this.exeCmd(`npm install`);

        console.warn('this.preCdkCmds:' + this.preCdkCmds.join(', '))
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
            const params = [
                `--parameters odmdDepRev=${JSON.stringify(pkgDeps)}`,
                `--parameters odmdBuildId=${BuildConst.inst.buildId}`,

                `--parameters buildSrcRev=${BuildConst.inst.githubSHA}`,
                `--parameters buildSrcRef=${BuildConst.inst.targetRevRefPathPart}`,
                `--parameters buildSrcRepo=${BuildConst.inst.githubRepo}`,
                `--parameters ContractsShareInNow=${new Date().getTime()}`
            ].join(' ')
            const args = [`deploy`, this.contextStrs.join() ?? "", clientStackName, rollBackStr, params, '--require-approval never']
            // console.log(args)
            await this.exeCmd(`cdk`, args)
        }
    }
}
