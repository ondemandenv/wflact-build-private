import * as core from '@actions/core'
// import { wait } from './wait'
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts'
import * as process from 'process'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    core.error(JSON.stringify(process.env))

    const imgToRepoArn = core.getInput('imgToRepoArn', {
      required: true,
      trimWhitespace: true
    })
    const argoManifestRepoArn = core.getInput('argoManifestRepoArn', {
      required: true,
      trimWhitespace: true
    })
    const clusterEndpoint = core.getInput('clusterEndpoint', {
      required: true,
      trimWhitespace: true
    })

    core.error(`imgToRepoArn: ${imgToRepoArn}`)
    core.error(`argoManifestRepoArn: ${argoManifestRepoArn}`)
    core.error(`clusterEndpoint: ${clusterEndpoint}`)

    const sts = new STSClient({ region: process.env.AWS_DEFAULT_REGION })
    const callerId = await sts.send(new GetCallerIdentityCommand({}))
    core.error('>>>>')
    core.error(JSON.stringify(callerId, null, 2))
    core.error('<<<<')
  } catch (error) {
    core.error(JSON.stringify(error as Error, null, 2))
  }
}
