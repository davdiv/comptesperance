import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireWrite } from '$lib/server/auth';
import { getEnv } from '$lib/server/env';
import { parseDecimalToCents } from '$lib/server/money';
import {
	getAccountWithTotals,
	getTransaction,
	listAccountsWithTotals,
	listProjectsWithTotals,
	listThirdPartiesWithCounts,
	listTransactionCandidates,
	type TransactionView
} from '$lib/server/queries';
import {
	deleteManualTransaction,
	linkTransfer,
	listProjects,
	readProject,
	linkDocument,
	listDocuments,
	uploadEvidence,
	unlinkTransfer,
	updateManualTransaction,
	updateProject,
	upsertAnnotation
} from '$lib/server/repository';
import type { TransactionAnnotation } from '$lib/types';

function annotationFromTransaction(
	transaction: TransactionView,
	overrides: Partial<TransactionAnnotation> = {}
): TransactionAnnotation {
	return {
		notes: transaction.notes || undefined,
		category: transaction.category || undefined,
		third_party_id: transaction.third_party_id,
		transfer_id: transaction.transfer_id,
		counterpart_account_id: transaction.counterpart_account_id,
		counterpart_transaction_id: transaction.counterpart_transaction_id,
		evidence: transaction.evidence,
		excluded: transaction.excluded,
		...overrides
	};
}

async function setEvidence(
	source: 'csv' | 'manual',
	accountId: string,
	transactionId: string,
	evidence: string[]
): Promise<void> {
	const transaction = await getTransaction(accountId, transactionId);
	if (!transaction) throw new Error('Transaction not found');
	if (source === 'csv') {
		await upsertAnnotation(
			accountId,
			transactionId,
			annotationFromTransaction(transaction, { evidence })
		);
	} else {
		await updateManualTransaction(accountId, transactionId, { evidence });
	}
}

function parseCounterpart(value: string): { account_id: string; transaction_id: string } | null {
	const index = value.indexOf(':');
	if (index <= 0) return null;
	return { account_id: value.slice(0, index), transaction_id: value.slice(index + 1) };
}

export const load: PageServerLoad = async ({ params }) => {
	const [transaction, account, accounts, candidates, projects, thirdParties] = await Promise.all([
		getTransaction(params.account_id, params.id),
		getAccountWithTotals(params.account_id),
		listAccountsWithTotals(),
		listTransactionCandidates(undefined, 1000),
		listProjectsWithTotals(),
		listThirdPartiesWithCounts()
	]);
	if (!transaction || !account) error(404, 'Transaction not found');
	const counterpart =
		transaction.counterpart_account_id && transaction.counterpart_transaction_id
			? await getTransaction(
					transaction.counterpart_account_id,
					transaction.counterpart_transaction_id
				)
			: null;
	const accountNames = new Map(accounts.map((item) => [item.account_id, item.name]));
	return {
		transaction,
		counterpart,
		counterpartAccountName: counterpart
			? (accountNames.get(counterpart.account_id) ?? counterpart.account_id)
			: null,
		account,
		accounts,
		projects,
		thirdParties,
		documents: (await listDocuments()).filter(
			(document) => !transaction.evidence.includes(document.path)
		),
		candidates: candidates
			.filter((item) => item.account_id !== transaction.account_id || item.id !== transaction.id)
			.map((item) => ({
				value: `${item.account_id}:${item.id}`,
				account_id: item.account_id,
				transaction_id: item.id,
				label: `${accountNames.get(item.account_id) ?? item.account_id} · ${item.date} · ${item.label} · ${(item.amount_cents / 100).toFixed(2)} ${item.currency}`
			}))
	};
};

export const actions: Actions = {
	save: async ({ request, locals, params }) => {
		requireWrite(locals.user);
		const [transaction, account] = await Promise.all([
			getTransaction(params.account_id, params.id),
			getAccountWithTotals(params.account_id)
		]);
		if (!transaction || !account) error(404, 'Transaction not found');
		const form = await request.formData();
		const countsInTotal = form.get('counts_in_total') === 'on';
		try {
			if (account.source === 'manual') {
				const amount = parseDecimalToCents(String(form.get('amount') ?? ''));
				await updateManualTransaction(account.account_id, transaction.id, {
					date: String(form.get('date') ?? transaction.date),
					value_date: String(form.get('value_date') ?? '').trim() || undefined,
					amount_cents: amount ?? transaction.amount_cents,
					label: String(form.get('label') ?? transaction.label),
					description: String(form.get('description') ?? '').trim() || undefined,
					category: String(form.get('category') ?? '').trim() || undefined,
					notes: String(form.get('notes') ?? '').trim() || undefined,
					third_party_id: String(form.get('third_party_id') ?? '') || null,
					counts_in_total: countsInTotal,
					excluded: !countsInTotal
				});
			} else {
				await upsertAnnotation(
					account.account_id,
					transaction.id,
					annotationFromTransaction(transaction, {
						notes: String(form.get('notes') ?? '').trim() || undefined,
						category: String(form.get('category') ?? '').trim() || undefined,
						third_party_id: String(form.get('third_party_id') ?? '') || null,
						excluded: !countsInTotal
					})
				);
			}
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Save failed' });
		}
		return { ok: true };
	},
	delete: async ({ locals, params }) => {
		requireWrite(locals.user);
		const account = await getAccountWithTotals(params.account_id);
		if (!account) error(404, 'Account not found');
		if (account.source !== 'manual') return fail(400, { error: 'CSV transactions are read-only' });
		await deleteManualTransaction(account.account_id, params.id);
		redirect(303, `/accounts/${account.account_id}`);
	},
	link_transfer: async ({ request, locals, params }) => {
		requireWrite(locals.user);
		const transaction = await getTransaction(params.account_id, params.id);
		if (!transaction) error(404, 'Transaction not found');
		if (transaction.transfer_id) return fail(400, { error: 'Transaction is already linked' });
		const form = await request.formData();
		const counterpart = parseCounterpart(String(form.get('counterpart') ?? ''));
		if (!counterpart) return fail(400, { error: 'Select a counterpart transaction' });
		try {
			await linkTransfer(
				{ account_id: transaction.account_id, transaction_id: transaction.id },
				counterpart
			);
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Link failed' });
		}
		return { ok: true };
	},
	unlink_transfer: async ({ locals, params }) => {
		requireWrite(locals.user);
		const transaction = await getTransaction(params.account_id, params.id);
		if (!transaction) error(404, 'Transaction not found');
		if (!transaction.transfer_id) return fail(400, { error: 'Transaction is not linked' });
		await unlinkTransfer({ account_id: transaction.account_id, transaction_id: transaction.id });
		return { ok: true };
	},
	upload_evidence: async ({ request, locals, params }) => {
		requireWrite(locals.user);
		const [transaction, account] = await Promise.all([
			getTransaction(params.account_id, params.id),
			getAccountWithTotals(params.account_id)
		]);
		if (!transaction || !account) error(404, 'Transaction not found');
		const form = await request.formData();
		const files = form.getAll('file');
		if (!files.length || files.some((file) => typeof file === 'string' || !file.name)) {
			return fail(400, { error: 'Select at least one file' });
		}
		const uploads = files as File[];
		const env = getEnv();
		for (const file of uploads) {
			if (file.size > env.maxEvidenceBytes) return fail(400, { error: 'File is too large' });
			if (!/\.(pdf|png|jpe?g|webp)$/i.test(file.name))
				return fail(400, { error: 'Unsupported file type' });
		}
		try {
			await uploadEvidence(
				{ account_id: transaction.account_id, transaction_id: transaction.id },
				await Promise.all(
					uploads.map(async (file) => ({
						name: file.name,
						data: new Uint8Array(await file.arrayBuffer())
					}))
				)
			);
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Upload failed' });
		}
		return { ok: true };
	},
	link_evidence: async ({ request, locals, params }) => {
		requireWrite(locals.user);
		const transaction = await getTransaction(params.account_id, params.id);
		if (!transaction) error(404, 'Transaction not found');
		const form = await request.formData();
		try {
			await linkDocument(
				{ account_id: transaction.account_id, transaction_id: transaction.id },
				String(form.get('path') ?? '')
			);
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Link failed' });
		}
		return { ok: true };
	},
	delete_evidence: async ({ request, locals, params }) => {
		requireWrite(locals.user);
		const [transaction, account] = await Promise.all([
			getTransaction(params.account_id, params.id),
			getAccountWithTotals(params.account_id)
		]);
		if (!transaction || !account) error(404, 'Transaction not found');
		const form = await request.formData();
		const documentPath = String(form.get('path') ?? '');
		if (!transaction.evidence.includes(documentPath))
			return fail(400, { error: 'Unknown evidence' });
		await setEvidence(
			account.source,
			account.account_id,
			transaction.id,
			transaction.evidence.filter((item) => item !== documentPath)
		);
		return { ok: true };
	},
	add_project_allocation: async ({ request, locals, params }) => {
		requireWrite(locals.user);
		const transaction = await getTransaction(params.account_id, params.id);
		if (!transaction) error(404, 'Transaction not found');
		const form = await request.formData();
		const projectId = String(form.get('project_id') ?? '');
		const amount = parseDecimalToCents(String(form.get('amount') ?? ''));
		if (!projectId || !amount) return fail(400, { error: 'Project and amount are required' });
		if (
			transaction.amount_cents === 0 ||
			Math.sign(amount) !== Math.sign(transaction.amount_cents)
		) {
			return fail(400, { error: 'Allocation must have the transaction sign' });
		}
		if (Math.abs(amount) > Math.abs(transaction.amount_cents)) {
			return fail(400, { error: 'Allocation exceeds transaction amount' });
		}
		const project = await readProject(projectId);
		if (!project) return fail(400, { error: 'Project not found' });
		const allocatedElsewhere = (await listProjects())
			.filter((item) => item.id !== projectId)
			.flatMap((item) => item.allocations)
			.filter(
				(allocation) =>
					allocation.account_id === transaction.account_id &&
					allocation.transaction_id === transaction.id
			)
			.reduce((sum, allocation) => sum + allocation.amount_cents, 0);
		if (Math.abs(allocatedElsewhere + amount) > Math.abs(transaction.amount_cents)) {
			return fail(400, { error: 'Allocations exceed transaction amount' });
		}
		const allocations = project.allocations.filter(
			(allocation) =>
				!(
					allocation.account_id === transaction.account_id &&
					allocation.transaction_id === transaction.id
				)
		);
		allocations.push({
			account_id: transaction.account_id,
			transaction_id: transaction.id,
			amount_cents: amount,
			note: String(form.get('note') ?? '').trim() || undefined
		});
		await updateProject(projectId, { allocations });
		return { ok: true };
	}
};
