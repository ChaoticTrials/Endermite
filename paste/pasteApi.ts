import fetch from 'node-fetch'

export async function createPaste(title: string | null, content: string): Promise<Paste | null> {
    try {
        const params = new URLSearchParams();
        if (title) params.append('title', title);
        params.append('expiration', String(7 * 24 * 60 * 60));

        const response = await fetch(`https://paste.moddingx.org/create?${params.toString()}`, {
            method: 'POST',
            body: Buffer.from(content, 'utf-8')
        });

        if (!response.ok) {
            console.error(`Error creating paste: ${response.statusText}`);
            return null;
        }

        const data: CreatePasteResponse = await response.json();
        return {
            url: data.url,
            delete: `https://paste.moddingx.org/delete/${encodeURIComponent(data.edit)}`
        };
    } catch (error) {
        console.error(`Unexpected error: ${error.message}`);
        return null;
    }
}

interface CreatePasteResponse {
    url: string,
    edit: string
}

export interface Paste {
    url: string,
    delete: string
}
