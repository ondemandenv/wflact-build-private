import {BuildConst} from "../build-const";
import {SpawnCmd} from "./SpawnCmd";

export class BuildBase {
    async exeCmd(cmd: string, args: string[] = []) {
        console.log(`***odmd>>>exeCmd:${cmd}`);
        const sc = new SpawnCmd(cmd, args)
        let r = await sc.execute();
        console.log(`***odmd<<<exeCmd:${cmd}`);
        return r
    }

    async run() {
        if (BuildConst.inst.workDirs.length > 1) {
            await this.exeCmd(`cd ${BuildConst.inst.workDirs}`);
        }
        await this.exeCmd(`pwd`);
        await this.exeCmd(`ls`, ['-ltarh']);
        await this.exeCmd(`aws`, ['sts', 'get-caller-identity']);
    }
}
