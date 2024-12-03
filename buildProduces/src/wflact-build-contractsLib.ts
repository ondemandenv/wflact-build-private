import * as process from "node:process";
import {execSyncLog, genNpmRcCmds} from "./wflactBuildProducing";
import fs from "fs";

export async function wflactBuildContractsLib(): Promise<void> {

    const token = process.env.github_token;
    const response = await fetch(
        `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY!}`,
        {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        }
    );

    const data = await response.json();
    if (data.default_branch == process.env.GITHUB_REF_NAME) {
        const regionToPrdcr = JSON.parse(process.env.ODMD_region__contractsLibLatest!) as { [p: string]: string };
        for (const rgn in regionToPrdcr) {
            const [pcId, shPath, centrRole] = regionToPrdcr[rgn].split(',')
            const producingVal = fs.readFileSync(`${process.env.RUNNER_TEMP}/${pcId}.txt`, 'utf8')
            execSyncLog(`
assume_role_output=$(aws sts assume-role --region ${rgn} --role-arn ${centrRole} --role-session-name contracts_pkg) 
export AWS_ACCESS_KEY_ID=$(echo $assume_role_output | jq -r '.Credentials.AccessKeyId')
export AWS_SECRET_ACCESS_KEY=$(echo $assume_role_output | jq -r '.Credentials.SecretAccessKey')
export AWS_SESSION_TOKEN=$(echo $assume_role_output | jq -r '.Credentials.SessionToken')
aws ssm put-parameter --region ${rgn} --name ${shPath} --type String --value "${producingVal.trim()}" --overwrite
`)
        }

    } else {
        console.log(`data.default_branch != process.env.GITHUB_REF_NAME and only default branch publish contracts lib!`)
    }


}
