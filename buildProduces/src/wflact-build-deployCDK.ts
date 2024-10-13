import fs from "fs";
import * as process from "node:process";
import {CloudFormationClient, DescribeStacksCommand} from "@aws-sdk/client-cloudformation";
import {execSyncLog} from "./wflact-buildProduces";


export async function wflactBuildDeployCDK(): Promise<void> {

    const workdir = process.env.ODMD_work_dir!
    const clientStackNames = process.env.ODMD_clientStackNames!.split(',')

    const pkgDeps: { [k: string]: string } = {}
    const pkgJsn = JSON.parse(fs.readFileSync(workdir + '/package.json', 'utf-8'));
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

    execSyncLog(`npm install -g aws-cdk@$ODMD_CDK_CLI_VERSION`);
    execSyncLog(`npm install -g cross-env`);

    execSyncLog(`npm install`);

    execSyncLog(`cdk ls`);

    const client = new CloudFormationClient();
    const stackExists = await Promise.all(clientStackNames.map(async stackName => {
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

    const params = [
        `--parameters odmdDepRev=${JSON.stringify(pkgDeps)}`,
        `--parameters odmdBuildId=$ODMD_build_id`,

        `--parameters buildSrcRev=$GITHUB_SHA`,
        `--parameters buildSrcRef=$ODMD_rev_ref`,
        `--parameters buildSrcRepo=$GITHUB_REPOSITORY`,
        `--parameters ContractsShareInNow=${new Date().getTime()}`
    ].join(' ')

    for (let i = 0; i < clientStackNames.length; i++) {
        const clientStackName = clientStackNames[i];
        const rollBackStr = stackExists[i] ? '' : '--no-rollback';
        const arr = ['cdk', `deploy`, /*this.contextStrs.join() ?? "",*/ clientStackName, rollBackStr, params, '--require-approval never']
        execSyncLog(arr.join(' '))
    }

}
