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

    const sts = new STSClient({region: process.env.AWS_DEFAULT_REGION})
    const callerId = await sts.send(new GetCallerIdentityCommand({}))
    core.error('>>>>')
    core.error(JSON.stringify(callerId, null, 2))
    core.error('<<<<')
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
