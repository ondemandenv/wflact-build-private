import * as process from "node:process";
import {execSync} from "child_process";
import {AwsCredentialIdentity} from "@smithy/types";
import {Credentials, GetCallerIdentityCommand, STSClient} from "@aws-sdk/client-sts";
import {GetParameterCommand, SSMClient} from "@aws-sdk/client-ssm";

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {

    const input_creds_str = process.env["INPUT_AWS_CREDENTIALS"]!;

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


    const secrets = JSON.parse(process.env["ODMD_SECRETS"]!) as {
        awsCred: Credentials,
        odmdAcc: { central: string }
    };

    if (!awsCreds) {
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
        console.info(JSON.stringify(localBuildRoleId, null, 2));
        console.info("<<<<");

        const awsAccount = localBuildRoleId.Account!

        const ghRefArr = process.env["GITHUB_REF"]!.split('/');

        const targetRevRefPathPart = (ghRefArr[1] == 'heads' ? 'b..' : 't..') + ghRefArr[2]

        const localSsm = new SSMClient();

        //todo: this is workplace account !
        let Name = `/odmd-${buildId}/${targetRevRefPathPart}/enver_config`;
        console.info(`Name>>${Name}`)
        const getConfig = await localSsm.send(
            new GetParameterCommand({Name}),
        )
        console.info(`Rsp>>${JSON.stringify(getConfig)}`)
        const obj = JSON.parse(getConfig.Parameter!.Value!)

        for (const key in obj) {
            const lk = key.toLowerCase();
            const kk = (!lk.startsWith('odmd_') && !lk.startsWith('aws_')) ? 'ODMD_' + key : key
            execSync(`echo '${kk}=${obj[key]}' >> $GITHUB_ENV`)
        }

        execSync(`echo "ODMD_build_id=${buildId}" >> $GITHUB_ENV`)
        execSync(`echo "ODMD_rev_ref=${targetRevRefPathPart}" >> $GITHUB_ENV`)

        execSync(`echo "AWS_ACCOUNT=${awsAccount}" >> $GITHUB_ENV`)
        execSync(`echo "AWS_ACCESS_KEY_ID=${awsCreds.accessKeyId}" >> $GITHUB_ENV`)
        execSync(`echo "AWS_SECRET_ACCESS_KEY=${awsCreds.secretAccessKey}" >> $GITHUB_ENV`)
        execSync(`echo "AWS_SESSION_TOKEN=${awsCreds.sessionToken}" >> $GITHUB_ENV`)
        execSync(`echo "AWS_REGION=${awsRegion}" >> $GITHUB_ENV`)
        execSync(`echo "AWS_DEFAULT_REGION=${awsRegion}" >> $GITHUB_ENV`)

    } catch (e) {
        console.error(e as Error)
    }
}