import * as core from "@actions/core";
import {
  Credentials,
  GetCallerIdentityCommand,
  STSClient,
} from "@aws-sdk/client-sts";
import * as process from "process";
import { AwsCredentialIdentity } from "@smithy/types";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { BuildCimg } from "./lib/build-cimg";
import { BuildCdk } from "./lib/build-cdk";
import { BuildNpm } from "./lib/build-npm";
import { BuildConst } from "./build-const";

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
    region: process.env["ODMD_awsRegion"]!,
    credentials: awsCreds,
  };
  const sts = new STSClient(awsSdkConfig);
  const callerIdResp = await sts.send(new GetCallerIdentityCommand({}));

  core.info(">>>>");
  core.info(JSON.stringify(callerIdResp, null, 2));
  core.info("<<<<");

  new BuildConst(callerIdResp.Account!);

  process.env.AWS_ACCESS_KEY_ID = awsCreds.accessKeyId;
  process.env.AWS_SECRET_ACCESS_KEY = awsCreds.secretAccessKey;
  process.env.AWS_SESSION_TOKEN = awsCreds.sessionToken;
  process.env.AWS_DEFAULT_REGION = BuildConst.inst.awsRegion;

  const ssm = new SSMClient(awsSdkConfig);

  try {
    let paramName = `/gyang-tst/${BuildConst.inst.buildId}/${BuildConst.inst.targetRevRef}/enver_config`;
    console.log("paramName>>>" + paramName);
    const getParamOutput = await ssm.send(
      new GetParameterCommand({
        /*
                todo: this is temp:
                /gyang-tst/OdmdBuildDefaultVpcRds/us_west_1_420887418376_springcdkecs/enver_config
                */
        Name: paramName,
      }),
    );

    core.info("getParamOutput>>");
    core.info(JSON.stringify(getParamOutput));
    core.info("getParamOutput<<");

    const args = JSON.parse(
      Buffer.from(getParamOutput.Parameter!.Value!, "base64").toString("utf-8"),
    ) as Array<any>;

    let wfBuild: BuildNpm | BuildCimg | BuildCdk;
    if (BuildConst.inst.buildType == "CdkGithubWF") {
      wfBuild = new BuildCdk(args[0], args[1], args[2], args[3]);
    } else if (BuildConst.inst.buildType == "ContainerImageEcr") {
      wfBuild = new BuildCimg(args[0], args[1], args[3]);
    } else if (BuildConst.inst.buildType == "NpmPackGH") {
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
