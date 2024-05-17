import * as core from '@actions/core'
import { Credentials, GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts'
import * as process from 'process'
import {
  AwsCredentialIdentity
} from '@smithy/types'


/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  console.log(`>>>>>>>>>`)
  for (const tmp in process.env) {
    core.warning(tmp + '>>>>' + process.env[tmp])
  }

  const workflowName = process.env.GITHUB_WORKFLOW!

  const buildId = process.env['ODMD_buildId']!
  const buildType = process.env['ODMD_buildType']!
  const awsAccount = process.env['ODMD_awsAccount']!
  const awsRegion = process.env['ODMD_awsRegion']!

  const input_creds_str = process.env['INPUT_AWS_CREDENTIALS']!
  const odmd_creds_str = JSON.parse(process.env['ODMD_AWS_CREDENTIALS']!) as Credentials

  let awsCreds: AwsCredentialIdentity | undefined = undefined

  if (input_creds_str && input_creds_str.startsWith('[')) {
    const regex = /\[(.+?)\\]\s+aws_access_key_id=(.+?)\s+aws_secret_access_key=(.+?)\s+aws_session_token=(.+)/
    const match = input_creds_str.match(regex)

    if (match) {
      const [profile, accessKeyId, secretAccessKey, sessionToken] = match
      awsCreds = {
        accessKeyId,
        secretAccessKey,
        sessionToken
      } as AwsCredentialIdentity
    }
  }

  if (!awsCreds) {
    awsCreds = {
      accessKeyId: odmd_creds_str.AccessKeyId!,
      secretAccessKey: odmd_creds_str.SecretAccessKey!,
      sessionToken: odmd_creds_str.SessionToken!
    }
  }
  if (!awsCreds) {
    throw new Error(`can't find aws creds!`)
  }

  const sts = new STSClient({
    region: awsRegion,
    credentials: awsCreds
  })
  const callerId = await sts.send(new GetCallerIdentityCommand({}))

  core.error('>>>>')
  core.error(JSON.stringify(callerId, null, 2))
  core.error('<<<<')

  return Promise.resolve()
}
