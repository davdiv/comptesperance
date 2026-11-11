import { render } from 'svelte/server';
import { expect, it } from 'vitest';
import ReferenceFields from './ReferenceFields.svelte';
import Settings from '../../routes/settings/+page.svelte';
import type { DataConfig } from '$lib/types';

const config: DataConfig = {
	app: { name: 'Custom name' },
	categories: [
		{ id: 'income', name: 'Income category', kind: 'income' },
		{ id: 'expense', name: 'Expense category', kind: 'expense' },
		{ id: 'old-category', name: 'Old category', kind: 'income', archived: true }
	],
	paymentModes: [
		{ id: 'cash', name: 'Cash' },
		{ id: 'old-mode', name: 'Old mode', archived: true }
	]
};

it('groups categories and hides archived options, including in filters', () => {
	const html = render(ReferenceFields, { props: { ...config, filter: true } }).body;
	expect(html).toContain('Income category');
	expect(html).toContain('Expense category');
	expect(html.match(/<optgroup /g)).toHaveLength(2);
	expect(html).not.toContain('old-category');
	expect(html).not.toContain('old-mode');
});

it('retains archived selections and warns about unknown references', () => {
	const archived = render(ReferenceFields, {
		props: { ...config, categoryId: 'old-category', paymentModeId: 'old-mode' }
	}).body;
	expect(archived).toMatch(/value="old-category" selected/);
	expect(archived).toMatch(/value="old-mode" selected/);
	const unknown = render(ReferenceFields, {
		props: { ...config, categoryId: 'missing-category', paymentModeId: 'missing-mode' }
	}).body;
	expect(unknown).toContain('text-amber-700');
	expect(unknown).toContain('missing-category');
	expect(unknown).toContain('missing-mode');
});

it('renders empty configuration with unassigned options', () => {
	const html = render(ReferenceFields, { props: { categories: [], paymentModes: [] } }).body;
	expect(html.match(/<option value=""/g)).toHaveLength(2);
	expect(html).not.toContain('text-amber-700');
});

it('shows settings but no forms or editable controls to read-only users', () => {
	const html = render(Settings, {
		props: {
			data: { config, user: { name: 'Reader', canWrite: false, groups: [] } },
			form: null
		} as never
	}).body;
	expect(html).toContain('Custom name');
	expect(html).toContain('Income category');
	expect(html).toContain('Old mode');
	expect(html).not.toMatch(/<(form|input|select)\b/);
});
