import { BuildBase } from "./build-base";

export class BuildCimg extends BuildBase {
  private readonly buildCmds: String[];
  private readonly imgTagging: string[][];
  private readonly imgToRepoArns: { [p: string]: string };

  //lib/repo-build-pp-container-image-to-ecr-with-github-workflow.ts createRepobuildImplPerBranch
  constructor(
    buildCmds: String[],
    imgTagging: string[][],
    imgToRepoArns: { [p: string]: string },
  ) {
    super();
    this.buildCmds = buildCmds;
    this.imgTagging = imgTagging;
    this.imgToRepoArns = imgToRepoArns;
  }

  async run() {}
}
