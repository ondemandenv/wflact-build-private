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

        const ghRefArr = process.env["GITHUB_REF"]!.split('/');

        const targetRevRefPathPart = (ghRefArr[1] == 'heads' ? 'b..' : 't..') + ghRefArr[2]

        const localSsm = new SSMClient();

        //todo: this is workplace account !
        const getConfig = await localSsm.send(
            new GetParameterCommand({Name: `/odmd-${buildId}/${targetRevRefPathPart}/enver_config`}),
        )
        const obj = JSON.parse(getConfig.Parameter!.Value!)

        obj.target_build_id = buildId
        obj.target_rev_ref = targetRevRefPathPart

        obj.AWS_ACCESS_KEY_ID = awsCreds.accessKeyId;
        obj.AWS_SECRET_ACCESS_KEY = awsCreds.secretAccessKey;
        obj.AWS_SESSION_TOKEN = awsCreds.sessionToken;
        obj.AWS_REGION = awsRegion
        obj.AWS_DEFAULT_REGION = awsRegion

        for (const key in obj) {
            const i = `echo "${key}=${obj[key]}" >> $GITHUB_ENV`;
            const o = execSync(i).toString()
            console.info(`${i}\n${o}`)
        }
    } catch (e) {
        console.error(e as Error)
    }
}