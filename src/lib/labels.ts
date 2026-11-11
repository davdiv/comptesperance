import { m } from '$lib/paraglide/messages.js';
import type { AccountSource } from './types';

export function accountSourceLabel(source: AccountSource): string {
	return source === 'csv' ? m.account_source_csv() : m.account_source_manual();
}

export function checkpointSourceLabel(source: 'statement' | 'manual'): string {
	return source === 'statement' ? m.checkpoint_statement() : m.checkpoint_manual();
}
