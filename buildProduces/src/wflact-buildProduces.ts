import * as process from "node:process";
import {wflactBuildCtnImg} from "./wflact-build-ctnImg";
import {wflactBuildDeployCDK} from "./wflact-build-deployCDK";
import {execSync} from "child_process";
import {wflactBuildContractsLib} from "./wflact-build-contractsLib";

export function genNpmRcCmds(contractsLibBuildPkgOrg: string): string[] {
    return [

        `echo "@ondemandenv:registry=https://npm.pkg.github.com/" >> .npmrc`,
        `echo "${contractsLibBuildPkgOrg}:registry=https://npm.pkg.github.com/" >> .npmrc`,
        'echo "//npm.pkg.github.com/:_authToken=$github_token" >> .npmrc'

    ]
}


export function execSyncLog(cmd: string) {
    execSync(cmd, {cwd: process.env.ODMD_work_dir, stdio: "inherit"});
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {

    if (process.env.ODMD_build_id == process.env.ODMD_contractsLibBuild) {
        return await wflactBuildContractsLib()
    }

    if (process.env.ODMD_csResType == 'Custom::ContainerImageEcr') {
        return await wflactBuildCtnImg()
    }

    if (process.env.ODMD_csResType == 'Custom::CdkGithubWF') {
        return await wflactBuildDeployCDK()
    }

    execSyncLog(`
 assume_role_output=$(aws sts assume-role --role-arn $ODMD_centralRoleArn --role-session-name contracts_pkg) 
 export AWS_ACCESS_KEY_ID=$(echo $assume_role_output | jq -r '.Credentials.AccessKeyId')
 export AWS_SECRET_ACCESS_KEY=$(echo $assume_role_output | jq -r '.Credentials.SecretAccessKey')
 export AWS_SESSION_TOKEN=$(echo $assume_role_output | jq -r '.Credentials.SessionToken')
 aws sts get-caller-identity`
    )
/* D:\odmd\ONDEMAND_CENTRAL_REPO\src\lib\repo-build-pp-cmds-with-github-workflow.ts#ODMD__productions
    execSyncLog(`
 aws ssm put-parameter --name ?? --type String --value "???" --overwrite
    `)
*/
    console.warn("No resType Found>>>")
    execSyncLog('pwd')
    execSyncLog('env')
    console.warn("No resType Found<<<")

}
