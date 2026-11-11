import { describe, expect, it, vi } from 'vitest';
import * as runtime from '#lib/paraglide/runtime.js';
import {
	buildProjectPdfDefinition,
	projectFilterSummary,
	renderProjectPdf,
	type PdfFilterState
} from './project-pdf';
import type { ProjectDetails } from './queries';
import type { DataConfig } from '#lib/types.ts';

const config: DataConfig = { app: { name: 'Test app' }, categories: [], paymentModes: [] };
const state = {
	filters: {},
	filterOptions: { accounts: [], thirdParties: [], projects: [] }
} as unknown as PdfFilterState;
const details: ProjectDetails = {
	project: {
		id: 'p',
		name: 'Été solidaire',
		description: 'Description',
		created_at: '',
		updated_at: ''
	},
	total_cents: 123456,
	transaction_count: 1,
	hidden_transfer_count: 0,
	by_account: [{ account_id: 'a', account_name: 'Cash', amount_cents: 123456, count: 1 }],
	allocations: [
		{
			project_id: 'p',
			account_id: 'a',
			account_name: 'Cash',
			transaction_id: 't',
			amount_cents: 123456,
			note: 'Allocation note',
			transaction: {
				date: '2026-10-03',
				label: 'Cake sale',
				description: 'Homemade cakes',
				amount_cents: 200000,
				third_party_name: 'Alice',
				category_name: 'Sales',
				payment_mode_name: 'Card'
			} as ProjectDetails['allocations'][number]['transaction']
		}
	]
};

describe('project PDF', () => {
	it('includes resolved rows, summary, totals, repeated headings and valid PDF bytes', async () => {
		const definition = buildProjectPdfDefinition(
			details,
			config,
			state,
			new Date('2026-10-03T12:00:00Z')
		);
		const text = JSON.stringify(definition);
		for (const value of [
			'Test app',
			'Été solidaire',
			'Cash',
			'Cake sale',
			'Homemade cakes',
			'Alice',
			'Sales',
			'Card',
			'Allocation note',
			'€',
			'headerRows'
		])
			expect(text).toContain(value);
		expect(text).not.toMatch(/[\u202f\u00a0]/);
		expect(text).toContain('€1,234.56');
		expect((await renderProjectPdf(definition)).subarray(0, 4).toString()).toBe('%PDF');
	});
	it('normalizes French currency spaces for standard fonts', () => {
		const locale = vi.spyOn(runtime, 'getLocale').mockReturnValue('fr');
		try {
			const text = JSON.stringify(buildProjectPdfDefinition(details, config, state));
			expect(text).toContain('1 234,56 €');
			expect(text).not.toMatch(/[\u202f\u00a0]/);
		} finally {
			locale.mockRestore();
		}
	});
	it('handles empty allocations and missing transaction references', async () => {
		const empty = buildProjectPdfDefinition(
			{ ...details, allocations: [], by_account: [], total_cents: 0 },
			config,
			state
		);
		expect((await renderProjectPdf(empty)).subarray(0, 4).toString()).toBe('%PDF');
		expect(
			JSON.stringify(
				buildProjectPdfDefinition(
					{ ...details, allocations: [{ ...details.allocations[0], transaction: null }] },
					config,
					state
				)
			)
		).toContain('—');
	});
	it('summarizes filters without pagination or fixed project and resolves account names', () => {
		expect(projectFilterSummary(state, config)).toBe('');
		const filtered = {
			...state,
			filters: {
				account_id: 'a',
				search: 'cakes',
				limit: 1,
				offset: 2,
				project_id: 'p',
				include_transfers: false
			},
			filterOptions: { ...state.filterOptions, accounts: [{ account_id: 'a', name: 'Cash' }] }
		} as PdfFilterState;
		const summary = projectFilterSummary(filtered, config);
		expect(summary).toContain('Cash');
		expect(summary).toContain('cakes');
		expect(summary).not.toContain('limit');
	});
	it('rejects invalid document definitions', async () => {
		await expect(
			renderProjectPdf({ content: [{ text: 'broken', font: 'Missing' }] })
		).rejects.toThrow();
	});
});
