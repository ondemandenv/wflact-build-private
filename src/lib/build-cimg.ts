import {BuildBase} from "./build-base";
import {BuildConst} from "../build-const";

export class BuildCimg extends BuildBase {
    private readonly buildCmds: string[];
    private readonly imgNameToRepoArn: { [p: string]: string };

    //lib/repo-build-pp-container-image-to-ecr-with-github-workflow.ts createRepobuildImplPerBranch
    constructor(
        buildCmds: string[],
        imgToRepoArns: { [p: string]: string },
    ) {
        super();
        this.buildCmds = buildCmds;
        this.imgNameToRepoArn = imgToRepoArns;
    }

    async run() {
        await super.run()

        for (const buildCmd of this.buildCmds) {
            await this.exeCmd(buildCmd);
        }
        const {imgToRepoUri, pushAll} = this.calImgToRepoUri();

        console.log(`imgToRepoUri>>>
        ${JSON.stringify(imgToRepoUri)}
imgToRepoUri<<<`)

        console.log(`pushall>>>${pushAll}`)

        for (const builtIt in this.imgNameToRepoArn) {
            console.log(`builtIt: ${builtIt}`)
            // const imgName = builtIt.split(':')[0]
            await this.exeCmd(`docker tag ${builtIt} ${imgToRepoUri[builtIt]}:latest`)
            await this.exeCmd(`docker tag ${builtIt} ${imgToRepoUri[builtIt]}:${BuildConst.inst.githubSHA}`)

        }

        const getEcrPassCmd = `aws ecr get-login-password --region ${BuildConst.inst.awsRegion}`;
        const loginEcrCmd = `docker login --username AWS --password-stdin ${BuildConst.inst.awsAccount}.dkr.ecr.${BuildConst.inst.awsRegion}.amazonaws.com`;
        await this.exeCmd(` ${getEcrPassCmd} | ${loginEcrCmd} `)

        for (const p of pushAll) {
            await this.exeCmd(`${p}`)
        }


    }

    private calImgToRepoUri() {
        const imgToRepoUri = {} as { [imgName: string]: string }
        const pushAll = []
        for (const imgName in this.imgNameToRepoArn) {
            //arn:aws:ecr:us-west-1:975050243618:repository/spring-rds-img/cdk-spring-rds-appbodmdsbxusw1
            const arnParts = this.imgNameToRepoArn[imgName].split(':');

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
        return {imgToRepoUri, pushAll};
    }
}
