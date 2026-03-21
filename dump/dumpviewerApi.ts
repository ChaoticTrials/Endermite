import fetch from 'node-fetch'

export async function uploadDump(url: string, ttl: number): Promise<Dump | null> {
    try {
        const response = await fetch(`https://dumps.chaotictrials.de/api/dump/import`, {
            method: 'POST',
            body: Buffer.from(JSON.stringify({
                url, ttl
            })),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + process.env.DUMPVIEWER_TOKEN
            }
        });

        if (!response.ok) {
            console.error(`Error uploading dump: ${ response.statusText }`);
            return null;
        }

        const data: UploadDumpResponse = await response.json() as UploadDumpResponse;
        return {
            viewUrl: `https://dumps.chaotictrials.de/${ data.id }`,
            deleteUrl: `https://dumps.chaotictrials.de/api/delete/${ encodeURIComponent(data.deleteKey) }`
        };
    } catch (error) {
        console.error(`Unexpected error: ${ error.message }`);
        return null;
    }
}

interface UploadDumpResponse {
    id: string,
    deleteKey: string
}

export interface Dump {
    viewUrl: string,
    deleteUrl: string
}
