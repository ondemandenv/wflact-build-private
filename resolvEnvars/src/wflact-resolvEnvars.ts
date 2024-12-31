import * as process from "node:process";
import {execSync} from "child_process";
import {AwsCredentialIdentity} from "@smithy/types";
import {Credentials, GetCallerIdentityCommand, STSClient} from "@aws-sdk/client-sts";
import {GetParameterCommand, SSMClient} from "@aws-sdk/client-ssm";
import * as yaml from "yaml";


export function execSyncLog(cmd: string) {
    execSync(cmd, {cwd: process.env.ODMD_work_dir, stdio: "inherit"});
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {

    const input_creds_str = process.env["INPUT_AWS_CREDENTIALS"]!;// input_ always all upper case

    let awsCreds: AwsCredentialIdentity | undefined = undefined;

    try {
        if (input_creds_str && input_creds_str.startsWith("[")) {
            const regex =
                /\[(.+?)\]\s+aws_access_key_id=(.+?)\s+aws_secret_access_key=(.+?)\s+aws_session_token=(.+)/;
            const match = input_creds_str.match(regex);

            if (match) {
                const [org, profile, accessKeyId, secretAccessKey, sessionToken] = match;
                awsCreds = {
                    accessKeyId,
                    secretAccessKey,
                    sessionToken,
                } as AwsCredentialIdentity;
            } else {
                console.warn(`can't find match to input:
                     
    ${input_creds_str}
    
    `);
            }
        } else {
            console.log("no input_creds_str found!")
        }
    } catch (e) {
        console.error(e)
        throw e
    }

    if (!awsCreds) {
        const secrets = JSON.parse(process.env["ODMD_SECRETS"]!) as {
            awsCred: Credentials,
            odmdAcc: { central: string }
        };
        awsCreds = {
            accessKeyId: secrets.awsCred.AccessKeyId!,
            secretAccessKey: secrets.awsCred.SecretAccessKey!,
            sessionToken: secrets.awsCred.SessionToken!,
            // expiration: secrets.awsCred.Expiration, // TypeError: t.expiration.getTime is not a function
        };
    }

    // this._awsAccount = localBuildRoleId.Account!

    const awsRegion = process.env["ODMD_awsRegion"]!;
    process.env.AWS_ACCESS_KEY_ID = awsCreds.accessKeyId;
    process.env.AWS_SECRET_ACCESS_KEY = awsCreds.secretAccessKey;
    process.env.AWS_SESSION_TOKEN = awsCreds.sessionToken;
    process.env.AWS_REGION = awsRegion
    process.env.AWS_DEFAULT_REGION = awsRegion

    const buildId = process.env["ODMD_buildId"]!;

    try {
        const localSts = new STSClient();

        const localBuildRoleId = await localSts.send(new GetCallerIdentityCommand({}));

        console.info(">>>>");
        console.info(yaml.stringify(localBuildRoleId, null, 2));
        console.info("<<<<");

        const awsAccount = localBuildRoleId.Account!

        const ghRefArr = process.env["GITHUB_REF"]!.split('/');

        //D:\odmd\ONDEMAND_CENTRAL_REPO\src\lib\repo-build-pp-base.ts
        /*
parameterName: `/odmd-${enver.owner.buildId}/${enver.targetRevision.type + '..' + enver.targetRevision.value}/enver_config`,
        */
        const targetRevTypeVal = (ghRefArr[1] == 'heads' ? 'b..' : 't..') + ghRefArr[2];


        const localSsm = new SSMClient();

        //todo: this is workplace account !
        const Name = `/odmd-${buildId}/${targetRevTypeVal}/enver_config`;
        console.info(`enver config: Param Name>>${Name}`)
        const getConfig = await localSsm.send(
            new GetParameterCommand({Name}),
        )
        console.info(`Param Rsp yaml>>${yaml.stringify(getConfig)}`)
        console.info(`Param val string>>${getConfig.Parameter!.Value!}`)
        const enverConfigObj = yaml.parse(getConfig.Parameter!.Value!)

        /**
         *
         *             ghWflPpStackName: (this.getCsResType() != 'Custom::CdkGithubWF'// will directly thru contracts lib
         *                 && this.getCsResType() != 'Custom::ContainerImageEcr'// no dependencies except src sha
         *                 && this.enver.owner != this.enver.owner.contracts.contractsLibBuild // no dependencies except src sha
         *             ) ? this.stackName : undefined //used in D:\odmd\wflact-build-private\resolvEnvars\src\wflact-resolvEnvars.ts
         *
         */
        const envarStack = enverConfigObj['ghWflPpStackName'] as string
        if (envarStack && envarStack.includes(buildId)) {// will be string 'undefined' in github action ! fk github

            /*
    https://awscli.amazonaws.com/v2/documentation/api/2.1.29/reference/cloudformation/update-stack.html

    aws cloudformation update-stack --stack-name mystack --use-previous-template \
    --parameters ParameterKey=KeyPairName,UsePreviousValue=true ParameterKey=SubnetIDs,ParameterValue=SampleSubnetID1

            * */

            try {
                execSyncLog(`aws cloudformation update-stack --stack-name ${
                    envarStack} --use-previous-template --parameters ${
                    ['buildSrcRepo', 'CfnVersion', 'BuildUrl', 'ByPipeline', 'odmdBuildId', 'odmdDepRev', 'buildSrcRev', 'buildSrcRef']
                        .map(p => `ParameterKey=${p},UsePreviousValue=true`)
                        .join(' ')} ParameterKey=ContractsShareInNow,ParameterValue=${
                    new Date().getTime()} `)
            } catch (e) {
                //is in UPDATE_IN_PROGRESS state and can not be updated.
                console.error(e)
            }
            execSyncLog(`aws cloudformation wait stack-update-complete --stack-name ${envarStack}`)
        }

        for (const key in enverConfigObj) {
            const lk = key.toLowerCase();
            const kk = (!lk.startsWith('odmd_') && !lk.startsWith('aws_')) ? 'ODMD_' + key : key
            execSyncLog(`echo '${kk}=${enverConfigObj[key]}' >> $GITHUB_ENV`)
        }

        execSyncLog(`echo "ODMD_build_id=${buildId}" >> $GITHUB_ENV`)

        execSyncLog(`echo "AWS_ACCOUNT=${awsAccount}" >> $GITHUB_ENV`)
        execSyncLog(`echo "AWS_ACCESS_KEY_ID=${awsCreds.accessKeyId}" >> $GITHUB_ENV`)
        execSyncLog(`echo "AWS_SECRET_ACCESS_KEY=${awsCreds.secretAccessKey}" >> $GITHUB_ENV`)
        execSyncLog(`echo "AWS_SESSION_TOKEN=${awsCreds.sessionToken}" >> $GITHUB_ENV`)
        execSyncLog(`echo "AWS_REGION=${awsRegion}" >> $GITHUB_ENV`)
        execSyncLog(`echo "AWS_DEFAULT_REGION=${awsRegion}" >> $GITHUB_ENV`)


        const contractsLibPkgName = enverConfigObj ['ODMD_contractsLibPkgName'] as string
        if (contractsLibPkgName && contractsLibPkgName.includes('/')) {
            console.info('>>contractsLibPkgName:' + contractsLibPkgName)
            const contractsLibBuildPkgOrg = contractsLibPkgName.split('/')[0] as string

            [
                `echo "@ondemandenv:registry=https://npm.pkg.github.com/" >> .npmrc`,
                `echo "${contractsLibBuildPkgOrg}:registry=https://npm.pkg.github.com/" >> .npmrc`,
                'echo "//npm.pkg.github.com/:_authToken=$github_token" >> .npmrc'
            ].forEach(c => {
                execSyncLog(c)
            })

            console.info("<<contractsLibBuildPkgOrg<<" + contractsLibBuildPkgOrg);
            execSyncLog('ls -ltarh')
        }

    } catch (e) {
        console.error(e as Error)
    }
}
