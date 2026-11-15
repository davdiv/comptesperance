import { listAccountsWithTotals, listIssues, listTransferGroups } from './queries';

export interface WarningRow {
	id: string;
	kind: 'transfer_balance' | 'transfer_allocations' | 'checkpoint' | 'import';
	subject: string | null;
	href: string;
	detail?: string;
	date?: string;
	difference_cents?: number;
}

export async function listWarnings(): Promise<WarningRow[]> {
	const [accounts, groups, issues] = await Promise.all([
		listAccountsWithTotals(),
		listTransferGroups(),
		listIssues()
	]);
	const names = Object.fromEntries(accounts.map((account) => [account.account_id, account.name]));
	const warnings: WarningRow[] = [];
	for (const group of groups) {
		const subject = [
			...new Set(group.members.map((item) => names[item.account_id] ?? item.account_id))
		].join(' ↔ ');
		const href = `/transfers?search=${encodeURIComponent(group.id)}#transfer-${encodeURIComponent(group.id)}`;
		if (!group.balanced)
			warnings.push({
				id: `transfer:${group.id}`,
				kind: 'transfer_balance',
				subject,
				href,
				difference_cents: group.total_cents
			});
		for (const project of group.project_totals.filter((item) => item.amount_cents !== 0))
			warnings.push({
				id: `allocation:${group.id}:${project.project_id}`,
				kind: 'transfer_allocations',
				subject,
				href,
				detail: project.name,
				difference_cents: project.amount_cents
			});
	}
	for (const account of accounts)
		for (const checkpoint of account.checkpoints)
			if (!checkpoint.ignored && checkpoint.difference_cents !== 0)
				warnings.push({
					id: `checkpoint:${account.account_id}:${checkpoint.id}`,
					kind: 'checkpoint',
					subject: account.name,
					href: `/accounts/${account.account_id}?checkpoint=${encodeURIComponent(checkpoint.id)}#checkpoints`,
					date: checkpoint.date,
					detail: checkpoint.statement_file ?? checkpoint.note,
					difference_cents: checkpoint.difference_cents
				});
	for (const issue of issues)
		warnings.push({
			id: `import:${issue.id}`,
			kind: 'import',
			subject: issue.account_id ? (names[issue.account_id] ?? issue.account_id) : null,
			href: issue.account_id ? `/accounts/${issue.account_id}#account-issues` : '/import',
			detail: [issue.source_file, issue.message].filter(Boolean).join(' · ')
		});
	return warnings;
}
