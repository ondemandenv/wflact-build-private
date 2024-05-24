import {BuildConst} from "../build-const";
import {SpawnCmd} from "./SpawnCmd";

export class BuildBase {
    async exeCmd(cmd: string, args: string[] = []) {
        const cwd = BuildConst.inst.workDirs;
        console.log(`***odmd>${cwd}>>exeCmd:${cmd} ${args}`);
        const sc = new SpawnCmd(cwd, cmd, args)
        const r = await sc.execute();
        console.log(`***odmd<${cwd}<<exeCmd:${cmd}`);
        return r
    }

    async run() {
        await this.exeCmd(`pwd`);
        await this.exeCmd(`ls`, ['-ltarh']);
        await this.exeCmd(`aws`, ['sts', 'get-caller-identity']);
    }
}
