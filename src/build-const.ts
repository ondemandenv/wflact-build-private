import * as process from "node:process";

export class BuildConst {
  private static _inst: BuildConst;
  public static get inst(): BuildConst {
    return this._inst;
  }

  constructor(acc: string) {
    this._awsAccount = acc;

    this._buildId = process.env["ODMD_buildId"]!;
    this._workDirs = process.env["ODMD_workDirs"]!;
    this._buildType = process.env["ODMD_buildType"]!;
    this._awsRegion = process.env["ODMD_awsRegion"]!;
    this._targetRevRef = process.env["GITHUB_REF_NAME"]!;
    this._workflowName = process.env["GITHUB_WORKFLOW"]!;

    if (BuildConst._inst) {
      throw new Error("singleton");
    }
    BuildConst._inst = this;
  }

  private _buildId: string;
  private _workDirs: string;
  private _buildType: string;
  private _awsRegion: string;
  private _awsAccount: string;
  private _targetRevRef: string;
  private _workflowName: string;

  public get buildId() {
    return this._buildId;
  }

  public get workDirs() {
    return this._workDirs;
  }

  public get buildType() {
    return this._buildType;
  }

  public get awsRegion() {
    return this._awsRegion;
  }

  public get awsAccount() {
    return this._awsAccount;
  }

  public get targetRevRef() {
    return this._targetRevRef;
  }

  public get workflowName() {
    return this._workflowName;
  }
}
