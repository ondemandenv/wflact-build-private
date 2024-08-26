import process from "node:process";
import {AwsCredentialIdentity} from "@smithy/types";
import {AssumeRoleCommand, Credentials, GetCallerIdentityCommand, STSClient} from "@aws-sdk/client-sts";
import * as core from "@actions/core";
import {GetParameterCommand, GetParametersByPathCommand, SSMClient} from "@aws-sdk/client-ssm";

export class BuildConst {
    private static _inst: BuildConst;
    public static get inst(): BuildConst {
        return this._inst;
    }

    constructor() {

        this._buildId = process.env["ODMD_buildId"]!;
        this._workDirs = process.env["ODMD_workDirs"]!;
        this._buildType = process.env["ODMD_buildType"]!;
        this._awsRegion = process.env["ODMD_awsRegion"]!;

        // 2024-06-17T14:18:54.5190355Z ##[warning]process.env.GITHUB_REF = "refs/tags/v0.0.1"
        // Warning: process.env.GITHUB_REF = "refs/heads/odmdSbxUsw1"

        const ghRefArr = process.env["GITHUB_REF"]!.split('/');
        // this._targetRevRef = (ghRefArr[1] == 'heads' ? 'b' : 't') + '..' + ghRefArr[2]
        this._targetRevRefPathPart = (ghRefArr[1] == 'heads' ? 'b..' : 't..') + ghRefArr[2]
        this._workflowName = process.env["GITHUB_WORKFLOW"]!;
        this._githubSHA = process.env["GITHUB_SHA"]!;
        this._githubRepo = process.env["GITHUB_REPOSITORY"]!;

        if (BuildConst._inst) {
            throw new Error("singleton");
        }
        this._awsAccount = ''
        BuildConst._inst = this;
    }

    private _buildId: string;
    private _workDirs: string;
    private _buildType: string;
    private _awsRegion: string;
    private _awsAccount: string;
    private _accounts: { central: string } | undefined;
    // private _targetRevRef: string;
    private _targetRevRefPathPart: string;
    private _workflowName: string;
    private _githubSHA: string;
    private _githubRepo: string;

    public get buildId() {
        return this._buildId;
    }

    public get workDirs() {
        return this._workDirs;
    }

    public get buildType() {
        return this._buildType;
    }

    public get awsRegion() {
        return this._awsRegion;
    }

    public get awsAccount() {
        return this._awsAccount;
    }

    // public get targetRevRef() {
    //     return this._targetRevRef;
    // }
    public get targetRevRefPathPart() {
        return this._targetRevRefPathPart;
    }

    public get workflowName() {
        return this._workflowName;
    }

    public get githubSHA() {
        return this._githubSHA;
    }

    public get githubRepo() {
        return this._githubRepo;
    }

    async initBuildArgs() {
        console.log("initBuildArgs>>>")

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

        console.log(`JSON.stringify(secrets.awsCred)>>>>>`)
        console.log(secrets.awsCred)
        console.log(`--------------------------`)
        console.log(JSON.stringify(secrets.odmdAcc))
        console.log(`JSON.stringify(secrets.awsCred)<<<<<<`)

        this._accounts = secrets.odmdAcc

        if (!awsCreds) {
            awsCreds = {
                accessKeyId: secrets.awsCred.AccessKeyId!,
                secretAccessKey: secrets.awsCred.SecretAccessKey!,
                sessionToken: secrets.awsCred.SessionToken!,
                // expiration: secrets.awsCred.Expiration, // TypeError: t.expiration.getTime is not a function
            };
        }

        const localSdkConfig = {
            region: this._awsRegion,
            credentials: awsCreds,
        };

        const localSts = new STSClient(localSdkConfig);

        const localBuildRoleId = await localSts.send(new GetCallerIdentityCommand({}));

        core.info(">>>>");
        core.info(JSON.stringify(localBuildRoleId, null, 2));
        core.info("<<<<");

        this._awsAccount = localBuildRoleId.Account!


        process.env.AWS_ACCESS_KEY_ID = awsCreds.accessKeyId;
        process.env.AWS_SECRET_ACCESS_KEY = awsCreds.secretAccessKey;
        process.env.AWS_SESSION_TOKEN = awsCreds.sessionToken;
        process.env.AWS_DEFAULT_REGION = process.env["ODMD_awsRegion"]!


        const localSsm = new SSMClient(localSdkConfig);

        try {

            //todo: this is workplace account !
            const getEnverConfigOut = await localSsm.send(
                new GetParametersByPathCommand({Path: `/odmd-${BuildConst.inst.buildId}/`, Recursive: true}),
            );

            console.log(`
            BuildConst.inst: ${BuildConst.inst},
            getEnverConfigOut: ${JSON.stringify(getEnverConfigOut, null, 2)},
            `)

            const envConf = getEnverConfigOut.Parameters!.find(p => p.Name!.endsWith(`${this._targetRevRefPathPart}/enver_config`))!;

            /*
            /odmd-odmd-contracts-cdk/b..odmdSbxUsw1/enver_config
            */

            process.env.ODMD_ACCOUNTS = Buffer.from(JSON.stringify(secrets.odmdAcc)).toString('base64')
            process.env.target_rev_ref = envConf.Name!.split('/')[2]
            process.env.target_build_id = this._buildId

            return JSON.parse(envConf.Value!)
        } catch (e) {
            console.error(e)
            const stsCentralRoleOut = await localSts.send(new AssumeRoleCommand({
                RoleArn: `${this._buildId}-${localSdkConfig.region}${localBuildRoleId.Account!}-centerRole`,
                RoleSessionName: process.env['GITHUB_RUN_ID']!
            }))

            const centerSsm = new SSMClient({
                region: process.env["ODMD_awsRegion"]!,
                credentials: {
                    accessKeyId: stsCentralRoleOut.Credentials!.AccessKeyId,
                    secretAccessKey: stsCentralRoleOut.Credentials!.SecretAccessKey,
                    sessionToken: stsCentralRoleOut.Credentials!.SessionToken,
                    expiration: stsCentralRoleOut.Credentials!.Expiration
                } as AwsCredentialIdentity
            })

            const dynaEnvers = await centerSsm.send(new GetParameterCommand({Name: `/odmd-envers/${this._buildId}`}))

        }

    }
}
