import { m } from '$lib/paraglide/messages.js';
import type { AccountSource, AccountType } from './types';

export function accountTypeLabel(type: AccountType): string {
	switch (type) {
		case 'bank':
			return m.account_type_bank();
		case 'stripe':
			return m.account_type_stripe();
		case 'sumup':
			return m.account_type_sumup();
		case 'cash':
			return m.account_type_cash();
		case 'other':
			return m.account_type_other();
	}
}

export function accountSourceLabel(source: AccountSource): string {
	return source === 'csv' ? m.account_source_csv() : m.account_source_manual();
}
