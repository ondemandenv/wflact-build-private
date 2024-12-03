import * as process from "node:process";
import {execSyncLog} from "./wflactBuildProducing";
import {execSync} from "child_process";

export async function wflactBuildCtnImg(): Promise<void> {

    const imgNameToRepoArn = JSON.parse(process.env.ODMD_imgToRepoArns!) as { [p: string]: string }

    const pushAll = []
    for (const imgName in imgNameToRepoArn) {
        //arn:aws:ecr:us-west-1:975050243618:repository/spring-rds-img/cdk-spring-rds-appbodmdsbxusw1
        const arnParts = imgNameToRepoArn[imgName].split(':');

        if (arnParts[2] !== 'ecr') {
            throw new Error(`invalidate ecr repo arn:${imgName}`)
        }

        const region = arnParts[3];
        //975050243618
        const accountId = arnParts[4];
        //repository/spring-rds-img/cdk-spring-rds-appbodmdsbxusw1
        const repoName = arnParts[5].substring('repository/'.length);

        const repoUrl = `${accountId}.dkr.ecr.${region}.amazonaws.com/${repoName}`;
        pushAll.push(`docker push --all-tags ${repoUrl}`)
        /*
aws ecr describe-images --repository-name samplespringopenapi3img/bmaster/open3 --image-ids imageTag=latest --query 'imageDetails[].imageTags[]'
[
    "latest",
    "766f48744a972e95aa7b0b89e82779622f3f4b0a"
]*/
        let tagsArr: string[] = []
        try {
            tagsArr = JSON.parse(execSync(`aws ecr describe-images --repository-name ${repoName} --image-ids imageTag=latest --query 'imageDetails[].imageTags[]' --output json`).toString()) as string[]
        } catch (e) {
        }
        if (tagsArr.length > 50) {
            throw new Error('too many tags for one image ' + repoName + '/' + imgName)
        }

        // const imgName = imgName.split(':')[0]
        execSyncLog(`docker tag ${imgName} ${repoUrl}:latest`)
        execSyncLog(`docker tag ${imgName} ${repoUrl}:$GITHUB_SHA`)
    }

    const awsAccount = process.env.AWS_ACCOUNT!
    const awsRegion = process.env.AWS_REGION!

    const getEcrPassCmd = `aws ecr get-login-password --region $AWS_REGION`;
    const loginEcrCmd = `docker login --username AWS --password-stdin ${awsAccount}.dkr.ecr.${awsRegion}.amazonaws.com`;
    execSyncLog(` ${getEcrPassCmd} | ${loginEcrCmd} `)

    for (const p of pushAll) {
        execSyncLog(`${p}`)
    }

}
