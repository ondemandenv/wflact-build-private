import * as core from "@actions/core";
import {
  Credentials,
  GetCallerIdentityCommand,
  STSClient,
} from "@aws-sdk/client-sts";
import * as process from "process";
import { AwsCredentialIdentity } from "@smithy/types";
import {
  GetParameterCommand,
  GetParametersByPathCommand,
  SSMClient,
} from "@aws-sdk/client-ssm";
import { BuildCimg } from "./lib/build-cimg";
import { BuildCdk } from "./lib/build-cdk";
import { BuildNpm } from "./lib/build-npm";

export const ODMD_buildId = process.env["ODMD_buildId"]!;
export const ODMD_workDirs = process.env["ODMD_workDirs"]!;
export const ODMD_buildType = process.env["ODMD_buildType"]!;
export const ODMD_awsRegion = process.env["ODMD_awsRegion"]!;
export const ODMD_targetRevRef = process.env.GITHUB_REF_NAME!;
export const ODMD_workflowName = process.env.GITHUB_WORKFLOW!;

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  const input_creds_str = process.env["INPUT_AWS_CREDENTIALS"]!;
  const odmd_creds_str = process.env["ODMD_AWS_CREDENTIALS"]!;

  let awsCreds: AwsCredentialIdentity | undefined = undefined;

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
  }

  if (!awsCreds) {
    const creds = JSON.parse(odmd_creds_str) as Credentials;
    awsCreds = {
      accessKeyId: creds.AccessKeyId!,
      secretAccessKey: creds.SecretAccessKey!,
      sessionToken: creds.SessionToken!,
    };
  }
  if (!awsCreds) {
    throw new Error(`can't find aws creds!`);
  }

  const awsSdkConfig = {
    region: ODMD_awsRegion,
    credentials: awsCreds,
  };
  const sts = new STSClient(awsSdkConfig);
  const callerIdResp = await sts.send(new GetCallerIdentityCommand({}));

  core.info(">>>>");
  core.info(JSON.stringify(callerIdResp, null, 2));
  core.info("<<<<");

  process.env.AWS_ACCESS_KEY_ID = awsCreds.accessKeyId;
  process.env.AWS_SECRET_ACCESS_KEY = awsCreds.secretAccessKey;
  process.env.AWS_SESSION_TOKEN = awsCreds.sessionToken;
  process.env.AWS_DEFAULT_REGION = ODMD_awsRegion;

  const ssm = new SSMClient(awsSdkConfig);

  try {
    const getParamOutput = await ssm.send(
      new GetParameterCommand({
        Name: `/odmd/share/${ODMD_buildId}/${ODMD_targetRevRef}/odmd_enver_build_config`,
      }),
    );

    core.info("getParamOutput>>");
    core.info(JSON.stringify(getParamOutput));
    core.info("getParamOutput<<");

    const args = JSON.parse(
      Buffer.from(getParamOutput.Parameter!.Value!, "base64").toString("utf-8"),
    ) as Array<any>;

    let wfBuild: BuildNpm | BuildCimg | BuildCdk;
    if (ODMD_buildType == "CdkGithubWF") {
      wfBuild = new BuildCdk(args[0], args[1], args[2], args[3]);
    } else if (ODMD_buildType == "ContainerImageEcr") {
      wfBuild = new BuildCimg(args[0], args[1], args[3]);
    } else if (ODMD_buildType == "NpmPackGH") {
      wfBuild = new BuildNpm(args[0]);
    } else {
      throw new Error("N/A");
    }
    core.info("wfBuild.run>>");
    await wfBuild.run();
    core.info("wfBuild.run<<");
  } catch (e) {
    core.error(e as Error);
  }

  return Promise.resolve();
}
