export function formatFile(name: string, content: string): string {
    if (!name.toLowerCase().endsWith('.json')) {
        return content;
    }

    try {
        return JSON.stringify(JSON.parse(content), undefined, 2);
    } catch (err) {
        return content;
    }
}
