export type ErrorInfo = {
    name: string;
    info: {
        found: string | null;
        location: {
            start: { offset: number; line: number; column: number };
            end: { offset: number; line: number; column: number };
        };
        name: string;
    };
};

export function formatErrorMessage(error: ErrorInfo): string {
    const { name, info } = error;
    const loc = info.location.start;
    const found = info.found === null ? "nothing" : `"${info.found}"`;

    return `❌ ${info.name} at line ${loc.line}, column ${loc.column} (offset ${loc.offset})\n` +
           `Found: ${found}`;
}
