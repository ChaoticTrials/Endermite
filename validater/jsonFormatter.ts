export interface ValidationResult {
    valid: boolean;
    error?: {
        message: string;
        position?: number;
        context?: {
            line: number;
            column: number;
            lineContent: string;
            prevLinesContent: string[];
            nextLinesContent: string[];
        };
    };
}

export function validateFile(name: string, content: string): ValidationResult {
    let processedContent = content;

    if (name.toLowerCase().endsWith('.json5')) {
        // Remove single-line comments (// ...)
        processedContent = processedContent.replace(/\/\/.*$/gm, '');
        // Remove multi-line comments (/* ... */)
        processedContent = processedContent.replace(/\/\*[\s\S]*?\*\//g, '');
    }

    try {
        JSON.parse(processedContent);
        return { valid: true };
    } catch (err: any) {
        // Extract position information from the error message
        const positionMatch = err.message.match(/position (\d+)/);
        const position = positionMatch ? parseInt(positionMatch[1], 10) : undefined;

        let context;
        if (position !== undefined) {
            context = getErrorContext(processedContent, position);
        }

        return {
            valid: false,
            error: {
                message: err.message,
                position,
                context
            }
        };
    }
}

function getErrorContext(content: string, position: number) {
    const lines = content.split('\n');
    let currentPos = 0;
    let lineNumber = 0;

    // Find which line contains the error position
    for (let i = 0; i < lines.length; i++) {
        const lineLength = lines[i].length + 1; // +1 for the newline character
        if (currentPos + lineLength > position) {
            lineNumber = i;
            break;
        }
        currentPos += lineLength;
    }

    const column = position - currentPos;

    return {
        line: lineNumber + 1, // Converting to 1-based line numbers for human readability
        column: column + 1,   // Converting to 1-based column numbers
        lineContent: lines[lineNumber],
        prevLinesContent: [
            lineNumber > 1 ? lines[lineNumber - 2] : undefined,
            lineNumber > 0 ? lines[lineNumber - 1] : undefined
        ].filter(line => line !== undefined),
        nextLinesContent: [
            lineNumber < lines.length - 1 ? lines[lineNumber + 1] : undefined,
            lineNumber < lines.length - 2 ? lines[lineNumber + 2] : undefined
        ].filter(line => line !== undefined)
    };
}
