import { annotationFromTransaction, editedClassification } from '#lib/server/annotations.ts';
import { suggestTransferGroups } from '#lib/server/transfer-matcher.ts';
import { linkBalancedSuggestions } from '#lib/server/transfer-suggestions.ts';
import { m } from '#lib/paraglide/messages.js';
import { editAllocation } from '#lib/server/allocation-editor.ts';
import { rankTransferCandidates } from '#lib/server/transfer-matcher.ts';
import { listTransferPool } from '#lib/server/queries.ts';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireWrite } from '#lib/server/auth.ts';
import { readUploadFiles } from '#lib/server/uploads.ts';
import { parseDecimalToCents } from '#lib/server/money.ts';
import {
	listTransferGroups,
	getAccountWithTotals,
	getTransaction,
	listAccountsWithTotals,
	listProjectsWithTotals,
	listThirdPartiesWithCounts
} from '#lib/server/queries.ts';
import {
	addTransferMember,
	deleteManualTransaction,
	linkTransfer,
	readProject,
	linkDocument,
	listDocuments,
	uploadEvidence,
	unlinkTransfer,
	updateManualTransaction,
	setTransactionAllocations,
	upsertAnnotation,
	resetAutomaticField
} from '#lib/server/repository.ts';
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
		listTransferPool(),
		listProjectsWithTotals(),
		listThirdPartiesWithCounts()
	]);
	if (!transaction || !account) error(404, 'Transaction not found');
	const groups = await listTransferGroups();
	const group = groups.find((item) => item.id === transaction.transfer_id) ?? null;
	const accountNames = new Map(accounts.map((item) => [item.account_id, item.name]));
	return {
		transaction,
		sumupLinks:
			transaction.record_type === 'vente'
				? {
						fee: await getTransaction(transaction.account_id, transaction.id + ':fee'),
						payout: transaction.attributes?.payout_transaction_id
							? await getTransaction(
									transaction.account_id,
									transaction.attributes?.payout_transaction_id
								)
							: null
					}
				: null,
		group,
		groupSuggestions: suggestTransferGroups(candidates).filter((item) =>
			item.members.some(
				(member) => member.account_id === transaction.account_id && member.id === transaction.id
			)
		),
		account,
		accounts,
		projects,
		thirdParties,
		documents: (await listDocuments()).filter(
			(document) => !transaction.evidence.includes(document.path)
		),
		suggestion: rankTransferCandidates(transaction, candidates)[0] ?? null,
		candidates: [...candidates]
			.filter((item) => group || item.account_id !== transaction.account_id)
			.sort(
				(a, b) =>
					Number((group?.total_cents ?? transaction.amount_cents) + b.amount_cents === 0) -
					Number((group?.total_cents ?? transaction.amount_cents) + a.amount_cents === 0)
			)
			.map((item) => ({
				value: `${item.account_id}:${item.id}`,
				account_id: item.account_id,
				transaction_id: item.id,
				label: `${accountNames.get(item.account_id) ?? item.account_id} · ${item.date} · ${item.label} · ${(item.amount_cents / 100).toFixed(2)} EUR`
			}))
	};
};

export const actions: Actions = {
	reset_automatic: async ({ request, locals, params }) => {
		requireWrite(locals.user);
		const form = await request.formData();
		try {
			await resetAutomaticField(params.account_id, params.id, String(form.get('field') ?? ''));
		} catch {
			return fail(400, { error: m.config_invalid() });
		}
		return { ok: true };
	},
	apply_suggested_project: async ({ locals, params }) => {
		requireWrite(locals.user);
		const transaction = await getTransaction(params.account_id, params.id);
		if (!transaction?.suggested_project_id) return fail(400, { error: m.allocation_invalid() });
		await setTransactionAllocations({ account_id: params.account_id, transaction_id: params.id }, [
			{ project_id: transaction.suggested_project_id, amount_cents: transaction.amount_cents }
		]);
		return { ok: true };
	},
	link_group_suggestion: linkBalancedSuggestions,
	edit_allocation: async ({ request, locals, params }) => {
		requireWrite(locals.user);
		const form = await request.formData();
		return editAllocation(params.account_id, params.id, String(form.get('project_id') ?? ''), form);
	},
	save: async ({ request, locals, params }) => {
		requireWrite(locals.user);
		const [transaction, account] = await Promise.all([
			getTransaction(params.account_id, params.id),
			getAccountWithTotals(params.account_id)
		]);
		if (!transaction || !account) error(404, 'Transaction not found');
		const form = await request.formData();
		const excluded = form.get('excluded') === 'on';
		try {
			if (account.source === 'manual') {
				const amount = parseDecimalToCents(String(form.get('amount') ?? ''));
				await updateManualTransaction(account.account_id, transaction.id, {
					date: String(form.get('date') ?? transaction.date),
					amount_cents: amount ?? transaction.amount_cents,
					label: String(form.get('label') ?? transaction.label),
					description: String(form.get('description') ?? '').trim() || undefined,
					category_id: String(form.get('category_id') ?? '').trim() || undefined,
					payment_mode_id: String(form.get('payment_mode_id') ?? '').trim() || undefined,
					notes: String(form.get('notes') ?? '').trim() || undefined,
					third_party_id: String(form.get('third_party_id') ?? '') || null,
					excluded
				});
			} else {
				await upsertAnnotation(
					account.account_id,
					transaction.id,
					annotationFromTransaction(transaction, {
						notes: String(form.get('notes') ?? '').trim() || undefined,
						...editedClassification(transaction, form),
						third_party_id:
							transaction.sources.third_party_id.source !== 'explicit' &&
							(String(form.get('third_party_id') ?? '') || null) === transaction.third_party_id
								? undefined
								: String(form.get('third_party_id') ?? '') || null,
						excluded:
							transaction.sources.excluded.source !== 'explicit' &&
							excluded === transaction.excluded
								? undefined
								: excluded
					})
				);
			}
		} catch (e) {
			return fail(400, {
				error:
					e instanceof Error && e.message.startsWith('allocation_')
						? m.allocation_invalid()
						: e instanceof Error
							? e.message
							: 'Save failed'
			});
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

		const form = await request.formData();
		const counterpart = parseCounterpart(String(form.get('counterpart') ?? ''));
		if (!counterpart) return fail(400, { error: m.transfer_invalid() });
		const other = await getTransaction(counterpart.account_id, counterpart.transaction_id);
		if (!other || other.transfer_id || other.excluded)
			return fail(400, { error: m.transfer_suggestion_invalid() });
		try {
			if (transaction.transfer_id) await addTransferMember(transaction.transfer_id, counterpart);
			else
				await linkTransfer(
					{ account_id: transaction.account_id, transaction_id: transaction.id },
					counterpart
				);
		} catch {
			return fail(400, { error: m.transfer_invalid() });
		}
		return { ok: true };
	},
	unlink_transfer: async ({ request, locals, params }) => {
		requireWrite(locals.user);
		const transaction = await getTransaction(params.account_id, params.id);
		if (!transaction) error(404, 'Transaction not found');
		if (!transaction.transfer_id) return fail(400, { error: 'Transaction is not linked' });
		const form = await request.formData();
		const member = parseCounterpart(String(form.get('member') ?? '')) ?? {
			account_id: transaction.account_id,
			transaction_id: transaction.id
		};
		const group = (await listTransferGroups()).find((item) => item.id === transaction.transfer_id);
		if (
			!group?.members.some(
				(item) => item.account_id === member.account_id && item.id === member.transaction_id
			)
		)
			return fail(400, { error: m.transfer_suggestion_invalid() });
		await unlinkTransfer(member);
		return { ok: true };
	},
	upload_evidence: async ({ request, locals, params }) => {
		requireWrite(locals.user);
		const [transaction, account] = await Promise.all([
			getTransaction(params.account_id, params.id),
			getAccountWithTotals(params.account_id)
		]);
		if (!transaction || !account) error(404, 'Transaction not found');
		const result = await readUploadFiles(request, true);
		if ('error' in result) return fail(result.status, { error: result.error });
		const uploads = result.files;
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
			return fail(400, { error: m.allocation_invalid() });
		}
		if (Math.abs(amount) > Math.abs(transaction.amount_cents)) {
			return fail(400, { error: m.allocation_invalid() });
		}
		const project = await readProject(projectId);
		if (!project) return fail(400, { error: 'Project not found' });

		const allocations = transaction.allocations.filter(
			(allocation) => allocation.project_id !== projectId
		);
		allocations.push({
			project_id: projectId,
			amount_cents: amount,
			note: String(form.get('note') ?? '').trim() || undefined
		});
		try {
			await setTransactionAllocations(
				{ account_id: transaction.account_id, transaction_id: transaction.id },
				allocations
			);
		} catch {
			return fail(400, { error: m.allocation_invalid() });
		}
		return { ok: true };
	}
};
