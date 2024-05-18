import { BuildBase } from "./build-base";

export class BuildNpm extends BuildBase {
  private readonly buildCmds: string[];

  constructor(buildCmds: string[]) {
    super();
    this.buildCmds = buildCmds;
  }

  async run() {}
}
