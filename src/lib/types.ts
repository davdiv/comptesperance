export type AccountSource = 'csv' | 'manual';

export interface Account {
	id: string;
	name: string;
	source: AccountSource;
	notes?: string;
	created_at: string;
	updated_at: string;
}

export interface ManualTransaction {
	id: string;
	date: string;
	value_date?: string;
	amount_cents: number;
	label: string;
	description?: string;
	record_type?: string;
	status?: string;
	third_party_id?: string | null;
	category_id?: string;
	notes?: string;
	transfer_id?: string | null;
	evidence?: string[];
	payment_mode_id?: string;
	allocations?: ProjectAllocation[];
	excluded?: boolean;
	created_at?: string;
	updated_at?: string;
}

export interface TransactionAnnotation {
	notes?: string;
	category_id?: string;
	third_party_id?: string | null;
	transfer_id?: string | null;
	evidence?: string[];
	payment_mode_id?: string;
	allocations?: ProjectAllocation[];
	excluded?: boolean;
}

export interface ManualCheckpoint {
	id: string;
	date: string;
	balance_cents: number;
	note?: string;
}

export interface BalanceCheckpoint extends ManualCheckpoint {
	source: 'statement' | 'manual';
	statement_file?: string;
	ignored?: boolean;
}

export interface AccountFile {
	account: Account;
	checkpoints?: ManualCheckpoint[];
	ignored_statement_checkpoints?: string[];
	transactions?: ManualTransaction[];
	annotations?: Record<string, TransactionAnnotation>;
}

export interface ProjectAllocation {
	project_id: string;
	amount_cents: number;
	note?: string;
}

export interface Project {
	id: string;
	name: string;
	description?: string;
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
	label: string;
	description?: string;
	record_type: string;
	status?: string;
	attributes?: Record<string, string>;
	excluded: boolean;
}

export interface CachedTransaction extends ParsedTransaction {
	account_id: string;
	source: AccountSource;
	source_files: string[];
	third_party_id: string | null;
	notes: string;
	category_id: string;
	payment_mode_id: string;
	allocations: ProjectAllocation[];
	transfer_id: string | null;
	evidence: string[];
	excluded: boolean;
}

export interface AccountTotals {
	account_id: string;
	incoming_cents: number;
	outgoing_cents: number;
	transaction_count: number;
	current_balance_cents: number;
}

export interface AppConfig {
	name: string;
}
export interface PaymentMode {
	id: string;
	name: string;
	archived?: boolean;
}
export interface Category extends PaymentMode {
	kind: 'income' | 'expense';
}
export interface DataConfig {
	app: AppConfig;
	categories: Category[];
	paymentModes: PaymentMode[];
}
