import * as process from "node:process";
import {execSyncLog, genNpmRcCmds} from "./wflact-buildProduces";

export async function wflactBuildContractsLib(): Promise<void> {

    const contractsLibLatestVerPath = process.env.ODMD_contractsLibLatestVerPath!
    const contractsLibBuildId = process.env.ODMD_contractsLibBuildId!
    const contractsLibPkgName = process.env.ODMD_contractsLibPkgName!
    const contractsLibRepoOwner = process.env.ODMD_contractsLibRepoOwner!
    const contractsLibRepoName = process.env.ODMD_contractsLibRepoName!
    const contractsLibLatestPath = process.env.ODMD_contractsLibLatestPath!

    genNpmRcCmds(contractsLibPkgName).forEach(c => execSyncLog(c))

    const arr = [
        `PKG_NAME=$(jq -r '.name' package.json) && test "$PKG_NAME" != "${contractsLibPkgName}" || echo $PKG_NAME is good`,

        `tsc --build --clean && tsc --build && npm publish`,
        `git config user.name "odmd_wfl"`,
        `git config user.email "odmd_wfl$@ondemandenv.dev"`,


        `PKG_VER=$(jq -r '.version' package.json)
 git tag "v$PKG_VER" && git tag "latest" -m "odmd" && git push origin --tags --force
 assume_role_output=$(aws sts assume-role --role-arn $ODMD_centralRoleArn --role-session-name contracts_pkg) 
 export AWS_ACCESS_KEY_ID=$(echo $assume_role_output | jq -r '.Credentials.AccessKeyId')
 export AWS_SECRET_ACCESS_KEY=$(echo $assume_role_output | jq -r '.Credentials.SecretAccessKey')
 export AWS_SESSION_TOKEN=$(echo $assume_role_output | jq -r '.Credentials.SessionToken')
 aws ssm put-parameter --name ${contractsLibLatestPath} --type String --value "$GITHUB_SHA\n${contractsLibPkgName}:$PKG_VER" --overwrite
 npm dist-tag add ${contractsLibPkgName}@$PKG_VER $GITHUB_SHA --registry=https://npm.pkg.github.com`,
    ]

    arr.forEach(c => execSyncLog(c))


}
