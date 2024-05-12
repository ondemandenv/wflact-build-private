import * as core from '@actions/core'
// import { wait } from './wait'
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts'
import * as process from 'process'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
    console.log( `>>>>>>>>>`)
    for (const tmp in process.env) {
      core.warning(tmp + '>>>>' + process.env[tmp])
    }

    const sts = new STSClient({ region: process.env.AWS_DEFAULT_REGION })
    const callerId = await sts.send(new GetCallerIdentityCommand({}))

    core.error('>>>>')
    core.error(JSON.stringify(callerId, null, 2))
    core.error('<<<<')

}
