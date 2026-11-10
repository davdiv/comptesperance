export type AccountType = 'bank' | 'sumup' | 'stripe' | 'cash' | 'other';
export type AccountSource = 'csv' | 'manual';

export interface Account {
	id: string;
	name: string;
	type: AccountType;
	currency: string;
	opening_balance_cents: number;
	source: AccountSource;
	created_at: string;
	updated_at: string;
}

export interface ManualTransaction {
	id: string;
	date: string;
	value_date?: string;
	amount_cents: number;
	currency: string;
	label: string;
	description?: string;
	record_type?: string;
	status?: string;
	third_party_id?: string | null;
	category?: string;
	notes?: string;
	transfer_id?: string | null;
	counterpart_account_id?: string | null;
	counterpart_transaction_id?: string | null;
	evidence?: string[];
	counts_in_total?: boolean;
	excluded?: boolean;
	created_at?: string;
	updated_at?: string;
}

export interface TransactionAnnotation {
	notes?: string;
	category?: string;
	third_party_id?: string | null;
	transfer_id?: string | null;
	counterpart_account_id?: string | null;
	counterpart_transaction_id?: string | null;
	evidence?: string[];
	excluded?: boolean;
}

export interface AccountFile {
	account: Account;
	transactions?: ManualTransaction[];
	annotations?: Record<string, TransactionAnnotation>;
}

export interface ProjectAllocation {
	account_id: string;
	transaction_id: string;
	amount_cents: number;
	note?: string;
}

export interface Project {
	id: string;
	name: string;
	description?: string;
	allocations: ProjectAllocation[];
	created_at: string;
	updated_at: string;
}

export interface ThirdParty {
	id: string;
	name: string;
	aliases: string[];
	created_at: string;
	updated_at: string;
}

export interface ParsedTransaction {
	id: string;
	raw: string[];
	date: string;
	value_date?: string;
	amount_cents: number;
	currency: string;
	label: string;
	description?: string;
	record_type: string;
	status?: string;
	attributes?: Record<string, string>;
	counts_in_total: boolean;
}

export interface CachedTransaction extends ParsedTransaction {
	account_id: string;
	source: AccountSource;
	source_files: string[];
	third_party_id: string | null;
	notes: string;
	category: string;
	transfer_id: string | null;
	counterpart_account_id: string | null;
	counterpart_transaction_id: string | null;
	evidence: string[];
	excluded: boolean;
}

export interface AccountTotals {
	account_id: string;
	opening_balance_cents: number;
	incoming_cents: number;
	outgoing_cents: number;
	transaction_count: number;
	current_balance_cents: number;
}
