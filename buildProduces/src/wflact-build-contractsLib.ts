import * as process from "node:process";
import {execSyncLog} from "./wflactBuildProducing";
import fs from "fs";
import {
    S3Client,
    PutObjectCommand,
} from "@aws-sdk/client-s3";
import {
    STSClient,
    AssumeRoleCommand,
} from "@aws-sdk/client-sts";
import {
    SSMClient,
    GetParameterCommand,
    PutParameterCommand
} from "@aws-sdk/client-ssm";

export async function wflactBuildContractsLib(): Promise<void> {
    const token = process.env.github_token;
    const response = await fetch(
        `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY!}`,
        {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        }
    );

    const data = await response.json();

    function awsTagStr(producingVal: string) {
        return producingVal.trim().replace(/[^a-zA-Z0-9\s_.:/=+\-@]/g, '_');
    }

    if (data.default_branch === process.env.GITHUB_REF_NAME) {
        const regionToPrdcr = JSON.parse(process.env.ODMD_region__contractsLibLatest!) as { [p: string]: string };
        execSyncLog('npm pack');

        for (const region in regionToPrdcr) {
            const [pcId, shPath, centrRole] = regionToPrdcr[region].split(',');
            const producingVal = fs.readFileSync(`${process.env.RUNNER_TEMP}/${pcId}.txt`, 'utf8');
            const [sha, pkgJsnName, pkgVersion] = producingVal.split(',');
            const [org, pkg] = pkgJsnName.split('/');

            // Assume role
            const stsClient = new STSClient({region});
            const assumeRoleResponse = await stsClient.send(new AssumeRoleCommand({
                RoleArn: centrRole,
                RoleSessionName: 'contracts_pkg'
            }));

            const credentials = {
                accessKeyId: assumeRoleResponse.Credentials!.AccessKeyId!,
                secretAccessKey: assumeRoleResponse.Credentials!.SecretAccessKey!,
                sessionToken: assumeRoleResponse.Credentials!.SessionToken
            };

            // Create service clients with assumed role credentials
            const s3Client = new S3Client({region, credentials});
            const ssmClient = new SSMClient({region, credentials});

            // Get bucket name from SSM
            const bucketParam = await ssmClient.send(new GetParameterCommand({
                Name: `/odmd-share/${process.env.ODMD_buildId}/${process.env.ODMD_rev_ref}/targetBucketName`
            }));
            const bucketName = bucketParam.Parameter!.Value!;

            // Upload file to S3
            const tgzFile = fs.readdirSync('.').find(file => file.endsWith('.tgz'));
            const fileContent = fs.readFileSync(tgzFile!);

            await s3Client.send(new PutObjectCommand({
                Bucket: bucketName,
                Key: 'odmd_contractsLib.tgz',
                Body: fileContent,
                Tagging: `contracts_lib_ver=${awsTagStr(producingVal)}`
            }));

            // Update SSM parameter
            await ssmClient.send(new PutParameterCommand({
                Name: shPath,
                Type: 'String',
                Value: producingVal.trim(),
                Overwrite: true
            }));

        }
    } else {
        console.log('data.default_branch != process.env.GITHUB_REF_NAME and only default branch publish contracts lib!');
    }
}
