import { createHash } from 'node:crypto';

export function fingerprint(fields: string[]): string {
	return createHash('sha256').update(JSON.stringify(fields)).digest('hex');
}
