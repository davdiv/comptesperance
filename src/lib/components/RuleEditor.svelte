<script lang="ts">
	import type { ImportRuleDraft } from '#lib/types.ts';
	import type { RuleOptions, RulePreview } from '#lib/rule-display.ts';
	import { ruleFieldLabel, ruleValue } from '#lib/rule-display.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { formatDate } from '#lib/format.ts';
	import Amount from './Amount.svelte';
	const {
		draft,
		options,
		preview
	}: { draft: ImportRuleDraft; options: RuleOptions; preview?: RulePreview } = $props();
	const c = $derived(draft.conditions);
	const targets = $derived([
		{ field: 'third_party_id' as const, entries: options.thirdParties },
		{
			field: 'category_id' as const,
			entries: options.categories.filter(
				(item) => !item.archived || item.id === draft.set.category_id
			)
		},
		{
			field: 'payment_mode_id' as const,
			entries: options.paymentModes.filter(
				(item) => !item.archived || item.id === draft.set.payment_mode_id
			)
		},
		{ field: 'project_id' as const, entries: options.projects }
	]);
</script>

<section class="card max-w-5xl p-5" id="editor">
	<h2 class="card-title mb-4">{draft.id ? m.rules_edit() : m.rules_create()}</h2>
	<form method="POST" action="?/save" id="rule-editor" class="space-y-5">
		<input type="hidden" name="id" value={draft.id ?? ''} />
		<div class="flex flex-wrap items-end gap-4">
			<label class="field flex-1"
				><span class="field-label">{m.settings_name()}</span><input
					name="name"
					value={draft.name}
					required
					class="control"
				/></label
			>
			<label class="flex items-center gap-2 py-2 text-sm"
				><input
					class="checkbox"
					type="checkbox"
					name="enabled"
					checked={draft.enabled !== false}
				/>{m.rules_enabled()}</label
			>
		</div>
		<fieldset class="space-y-3">
			<legend class="mb-2 font-semibold">{m.rules_conditions()}</legend>
			<p class="text-xs text-stone-500">{m.rules_conditions_help()}</p>
			<div class="grid gap-3 sm:grid-cols-2">
				<label class="field"
					><span class="field-label">{m.rules_text()}</span><input
						class="control"
						name="condition_text"
						value={c.text ?? ''}
					/></label
				>
				<label class="field"
					><span class="field-label">{m.rules_pattern()}</span><input
						class="control"
						name="condition_pattern"
						value={c.pattern ?? ''}
					/></label
				>
				<label class="field"
					><span class="field-label">{m.project_allocation_account()}</span><select
						class="control"
						name="condition_account_id"
						><option value="">{m.common_all()}</option
						>{#if c.account_id && !options.accounts.some((account) => account.id === c.account_id)}<option
								value={c.account_id}
								selected>{m.config_unknown()} ({c.account_id})</option
							>{/if}{#each options.accounts.filter((account) => account.source === 'csv' || account.id === c.account_id) as account (account.id)}<option
								value={account.id}
								selected={c.account_id === account.id}>{account.name}</option
							>{/each}</select
					></label
				>
				<label class="field"
					><span class="field-label">{m.rules_direction()}</span><select
						class="control"
						name="condition_direction"
						><option value="">{m.common_all()}</option><option
							value="in"
							selected={c.direction === 'in'}>{m.account_incoming()}</option
						><option value="out" selected={c.direction === 'out'}>{m.account_outgoing()}</option
						></select
					></label
				>
				<label class="field"
					><span class="field-label">{m.rules_min_amount()}</span><input
						class="control"
						inputmode="decimal"
						name="min_amount"
						value={c.min_cents === undefined ? '' : (c.min_cents / 100).toFixed(2)}
					/></label
				>
				<label class="field"
					><span class="field-label">{m.rules_max_amount()}</span><input
						class="control"
						inputmode="decimal"
						name="max_amount"
						value={c.max_cents === undefined ? '' : (c.max_cents / 100).toFixed(2)}
					/></label
				>
				<label class="field"
					><span class="field-label">{m.import_format()}</span><select
						class="control"
						name="condition_format"
						><option value="">{m.common_all()}</option><option
							value="ccp"
							selected={c.format === 'ccp'}>CCP</option
						><option value="sumup" selected={c.format === 'sumup'}>SumUp</option></select
					></label
				>
				<label class="field"
					><span class="field-label">{m.rules_record_type()}</span><input
						class="control"
						name="condition_record_type"
						value={c.record_type ?? ''}
					/></label
				>
			</div>
		</fieldset>
		<fieldset class="space-y-3">
			<legend class="mb-2 font-semibold">{m.rules_outputs()}</legend>
			<p class="text-xs text-stone-500">{m.rules_outputs_help()}</p>
			<div class="grid gap-3 sm:grid-cols-2">
				{#each targets as target (target.field)}<label class="field"
						><span class="field-label">{ruleFieldLabel(target.field)}</span><select
							class="control"
							name={'set_' + target.field}
							><option value="">{m.rules_dont_set()}</option
							>{#if draft.set[target.field] && !target.entries.some((item) => item.id === draft.set[target.field])}<option
									value={draft.set[target.field]}
									selected>{m.config_unknown()} ({draft.set[target.field]})</option
								>{/if}{#each target.entries as item (item.id)}<option
									value={item.id}
									selected={draft.set[target.field] === item.id}
									>{item.name}{'archived' in item && item.archived
										? ' · ' + m.config_archived()
										: ''}</option
								>{/each}</select
						></label
					>{/each}
				<label class="field"
					><span class="field-label">{m.transaction_excluded()}</span><select
						class="control"
						name="set_excluded"
						><option value="">{m.rules_dont_set()}</option><option
							value="true"
							selected={draft.set.excluded === true}>{m.rules_yes()}</option
						><option value="false" selected={draft.set.excluded === false}>{m.rules_no()}</option
						></select
					></label
				>
			</div>
		</fieldset>
		<div class="flex flex-wrap gap-3">
			<button type="submit" class="btn">{m.common_save()}</button><button
				type="submit"
				class="btn btn-secondary"
				formaction="?/preview#preview">{m.rules_preview()}</button
			><a class="btn btn-secondary" href="/settings/rules">{m.common_cancel()}</a>
		</div>
	</form>
</section>
{#if preview}
	<section class="card mt-6 max-w-5xl p-5" id="preview">
		<h2 class="card-title">{m.rules_matches({ count: preview.count })}</h2>
		<p class="mt-1 text-xs text-stone-500">{m.rules_preview_help()}</p>
		{#if draft.enabled === false}<p class="mt-2 text-sm text-stone-500">
				{m.rules_disabled_help()}
			</p>{/if}
		{#if !preview.count}<p class="mt-4 text-sm text-stone-500">{m.rules_no_matches()}</p>{/if}
		<ul class="mt-4 divide-y divide-stone-200">
			{#each preview.rows as row (row.account_id + '/' + row.id)}
				<li class="py-3 text-sm">
					<div class="flex flex-wrap justify-between gap-2">
						<a class="link font-medium" href={`/transactions/${row.account_id}/${row.id}`}
							>{row.label}</a
						><Amount cents={row.amount_cents} />
					</div>
					<p class="text-xs text-stone-500">{formatDate(row.date)} · {row.account_name}</p>
					<ul class="mt-2 space-y-1 text-xs">
						{#each row.changes as change (change.field)}<li>
								<span class="font-medium">{ruleFieldLabel(change.field)}:</span>
								{#if change.explicit}<span class="text-stone-500"
										>{m.rules_explicit_unchanged()}</span
									>{:else if change.before === change.after}<span class="text-stone-500"
										>{m.rules_unchanged()} ({ruleValue(change.field, change.after, options)})</span
									>{:else}{ruleValue(change.field, change.before, options)} →
									<strong>{ruleValue(change.field, change.after, options)}</strong>{/if}
							</li>{/each}
					</ul>
				</li>
			{/each}
		</ul>
	</section>
{/if}
