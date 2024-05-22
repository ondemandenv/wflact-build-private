import {spawn, SpawnOptionsWithoutStdio, ChildProcessWithoutNullStreams} from 'child_process';

export class SpawnCmd {

    private cwd: string;
    private command: string;
    private args: string[];

    constructor(cwd: string, command: string, args: string[] = []) {
        this.cwd = cwd;
        this.command = command;
        this.args = args;
    }

    public async execute(): Promise<string> {
        return new Promise((resolve, reject) => {
            const options: SpawnOptionsWithoutStdio = {
                shell: true,
                cwd: this.cwd
            };
            const child: ChildProcessWithoutNullStreams = spawn(this.command, this.args, options);

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data: any) => {
                const message = data.toString();
                stdout += message;
                console.log(message);
            });

            child.stderr.on('data', (data: any) => {
                const message = data.toString();
                stderr += message;
                console.error(message);
            });

            child.on('close', (exitCode: number) => {
                if (exitCode != 0) {
                    throw new Error("Failed")
                }
                resolve(stdout);
            });

            child.on('error', (error: Error) => {
                reject(new Error(`Failed to start command: ${error.message}`));
            });
        });
    }
}