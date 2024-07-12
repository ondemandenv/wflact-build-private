import * as core from "@actions/core";
import {BuildCimg} from "./lib/build-cimg";
import {BuildCdk} from "./lib/build-cdk";
import {BuildNpm} from "./lib/build-npm";
import {BuildConst} from "./build-const";
import * as process from "node:process";

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {

    console.log(`process.env[tmp]>>>>>>>>>`)
    for (const tmp in process.env) {
        core.warning(`process.env.${tmp} = "${process.env[tmp]}"`)
    }
    console.log(`process.env[tmp]<<<<<<<<<\n\n\n`)

    const buildArgs = await new BuildConst().initBuildArgs()

    let wfBuild: BuildNpm | BuildCimg | BuildCdk;
    if (BuildConst.inst.buildType == "CdkGithubWF") {
        wfBuild = new BuildCdk(buildArgs[0], buildArgs[1], buildArgs[2], buildArgs[3]);
    } else if (BuildConst.inst.buildType == "ContainerImageEcr") {
        wfBuild = new BuildCimg(buildArgs[0], buildArgs[1], buildArgs[2]);
    } else if (BuildConst.inst.buildType == "NpmPackGH") {
        wfBuild = new BuildNpm(buildArgs[0]);
    } else {
        throw new Error("N/A");
    }
    core.info("wfBuild.run>>");
    await wfBuild.run();
    core.info("wfBuild.run<<");

    return Promise.resolve();
}
