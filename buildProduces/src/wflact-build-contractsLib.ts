import * as process from "node:process";
import {execSyncLog} from "./wflactBuildProducing";
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
        const ghToken = process.env.github_token;
        execSyncLog('npm pack')
        for (const rgn in regionToPrdcr) {
            const [pcId, shPath, centrRole] = regionToPrdcr[rgn].split(',')
            const producingVal = fs.readFileSync(`${process.env.RUNNER_TEMP}/${pcId}.txt`, 'utf8')
            const [sha, pkgJsnName, pkgVersion] = producingVal.split(',')
            const [org, pkg] = pkgJsnName.split('/')
            /*

#${producer Id}.txt this is contract lib enver's single producer ...
echo "$GITHUB_SHA,$PKG_NAME,$PKG_VER" > "$RUNNER_TEMP/contractsLibLatest.txt"

048e5c8149a7cfb81cf5856e37e162e0995d9e85,@odmd-seed/seed-contracts,0.0.99
            */

            execSyncLog(`
assume_role_output=$(aws sts assume-role --region ${rgn} --role-arn ${centrRole} --role-session-name contracts_pkg) 
export AWS_ACCESS_KEY_ID=$(echo $assume_role_output | jq -r '.Credentials.AccessKeyId')
export AWS_SECRET_ACCESS_KEY=$(echo $assume_role_output | jq -r '.Credentials.SecretAccessKey')
export AWS_SESSION_TOKEN=$(echo $assume_role_output | jq -r '.Credentials.SessionToken')
aws sts get-caller-identity

version="${pkgVersion.trim()}"
token="${ghToken}"
org="${org}"
package_name="${pkg}"

TGZ_FILE=$(ls *.tgz)

bucket_name=$(aws ssm get-parameter --region ${rgn} --name "/odmd-share/$ODMD_buildId/$ODMD_rev_ref/targetBucketName" --query "Parameter.Value" --output text)
echo $bucket_name 
aws s3  --region ${rgn}  cp $TGZ_FILE "s3://\${bucket_name}/odmd_contractsLib.tgz"

aws ssm put-parameter --region ${rgn} --name ${shPath} --type String --value "${producingVal.trim()}" --overwrite

aws s3api put-object-tagging --region ${rgn} --bucket \${bucket_name} --key odmd_contractsLib.tgz \\
--tagging '{"TagSet": [
    { "Key": "contracts_lib_ver", "Value": "${producingVal}" }
]}'

`)
            /*
             D:\odmd\ONDEMAND_CENTRAL_REPO\src\lib\ondemand_region-repobuild.ts
                        new StringParameter(this, 'ha', {
                            parameterName: `/odmd-share/${this.odmdModel.buildCentral.buildId}/${this.odmdModel.buildCentral.envers[0].targetRevision.toPathPartStr()}/targetBucketName`,
                            stringValue: Ondemand__root.ROOT_STACK.centralBootstrapS3.theBucket.bucketName
                        })
            */
        }

    } else {
        console.log(`data.default_branch != process.env.GITHUB_REF_NAME and only default branch publish contracts lib!`)
    }


}
