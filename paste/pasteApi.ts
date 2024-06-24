import fetch from 'node-fetch'

export async function createPaste(title: string | null, content: string): Promise<Paste> {
    const titlePart = (title == null) ? '' : `?title=${encodeURIComponent(title)}`
    const response = await fetch(`https://paste.moddingx.org/create${titlePart}`, {
        method: 'POST',
        body: Buffer.from(content, 'utf-8')
    });
    const data = await response.json() as CreatePasteResponse;
    return {
        url: data.url,
        delete: `https://paste.moddingx.org/delete/${encodeURIComponent(data.edit)}`
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
