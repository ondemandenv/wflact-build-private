import * as process from "node:process";
import {execSyncLog} from "./wflactBuildProducing";

export async function wflactBuildCtnImg(): Promise<void> {

    const imgNameToRepoArn = JSON.parse(process.env.ODMD_imgToRepoArns!) as { [p: string]: string }

    const imgToRepoUri = {} as { [imgName: string]: string }
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
        const repositoryName = arnParts[5].substring('repository/'.length);

        imgToRepoUri[imgName] = `${accountId}.dkr.ecr.${region}.amazonaws.com/${repositoryName}`;
        pushAll.push(`docker push --all-tags ${imgToRepoUri[imgName]}`)
    }


    console.log(`imgToRepoUri>>>
        ${JSON.stringify(imgToRepoUri)}
imgToRepoUri<<<`)

    console.log(`pushall>>>${pushAll}`)

    for (const builtIt in imgNameToRepoArn) {
        console.log(`builtIt: ${builtIt}`)
        // const imgName = builtIt.split(':')[0]
        execSyncLog(`docker tag ${builtIt} ${imgToRepoUri[builtIt]}:latest`)
        execSyncLog(`docker tag ${builtIt} ${imgToRepoUri[builtIt]}:$GITHUB_SHA`)
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
