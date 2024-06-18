
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

        // 2024-06-17T14:18:54.5190355Z ##[warning]process.env.GITHUB_REF = "refs/tags/v0.0.1"
        // Warning: process.env.GITHUB_REF = "refs/heads/odmdSbxUsw1"

        const ghRefArr = process.env["GITHUB_REF"]!.split('/');
        this._targetRevRef = (ghRefArr[1] == 'heads' ? 'b' : 't') + ':' + ghRefArr[2]
        this._targetRevRefPathPart = (ghRefArr[1] == 'heads' ? '' : 't_') + ghRefArr[2]
        this._workflowName = process.env["GITHUB_WORKFLOW"]!;
        this._githubSHA = process.env["GITHUB_SHA"]!;
        this._githubRepo = process.env["GITHUB_REPOSITORY"]!;

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
    private _targetRevRefPathPart: string;
    private _workflowName: string;
    private _githubSHA: string;
    private _githubRepo: string;

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
    public get targetRevRefPathPart() {
        return this._targetRevRefPathPart;
    }

    public get workflowName() {
        return this._workflowName;
    }

    public get githubSHA() {
        return this._githubSHA;
    }
    public get githubRepo() {
        return this._githubRepo;
    }
}
