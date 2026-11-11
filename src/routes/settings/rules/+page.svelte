<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { ruleConditionsSummary, ruleSetSummary } from '#lib/rule-display.ts';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Alert from '#lib/components/Alert.svelte';
	import RuleEditor from '#lib/components/RuleEditor.svelte';
	import type { PageProps } from './$types';
	const { data, form }: PageProps = $props();
	const draft = $derived(form?.draft ?? data.editor);
</script>

<PageHeader
	title={m.rules_title()}
	subtitle={m.rules_subtitle()}
	back={{ href: '/settings', label: m.nav_settings() }}
>
	{#snippet actions()}{#if data.user.canWrite && !draft}<a
				class="btn"
				href="/settings/rules?new=1#editor">{m.rules_create()}</a
			>{/if}{/snippet}
</PageHeader>
{#if form?.error}<Alert tone="error">{form.error}</Alert>{/if}
{#if draft && data.user.canWrite}
	<RuleEditor {draft} options={data.options} preview={form?.preview} />
{:else}
	<p class="mb-4 text-sm text-stone-500">{m.rules_order_help()} {m.rules_count_help()}</p>
	{#if !data.rules.length}<div class="card p-6 text-sm text-stone-500">{m.rules_empty()}</div>{/if}
	<ol class="space-y-4">
		{#each data.rules as rule, index (rule.id)}
			<li id={rule.id} class="card scroll-mt-6 p-5">
				<div class="flex flex-wrap items-start justify-between gap-4">
					<div class="min-w-0 flex-1 space-y-2">
						<h2 class="flex flex-wrap items-center gap-2 font-semibold">
							<span class="text-sm font-normal text-stone-400">{index + 1}.</span>{rule.name}<span
								class="badge badge-neutral"
								>{rule.enabled === false ? m.rules_disabled() : m.rules_enabled()}</span
							>
						</h2>
						<p class="text-sm text-stone-600">
							<span class="font-medium">{m.rules_conditions()}:</span>
							{ruleConditionsSummary(rule, data.options)}
						</p>
						<p class="text-sm text-stone-600">
							<span class="font-medium">{m.rules_outputs()}:</span>
							{ruleSetSummary(rule, data.options)}
						</p>
						<p class="text-xs text-stone-500">{m.rules_matches({ count: rule.matchCount })}</p>
					</div>
					{#if data.user.canWrite}<div class="flex flex-wrap gap-2">
							<form method="POST" action="?/toggle">
								<input type="hidden" name="id" value={rule.id} /><button
									class="btn btn-secondary"
									aria-label={(rule.enabled === false ? m.rules_enable() : m.rules_disable()) +
										': ' +
										rule.name}
									>{rule.enabled === false ? m.rules_enable() : m.rules_disable()}</button
								>
							</form>
							<a
								class="btn btn-secondary"
								href={`/settings/rules?edit=${encodeURIComponent(rule.id)}#editor`}
								>{m.common_edit()}</a
							>
							{#each ['up', 'down'] as direction (direction)}<form method="POST" action="?/move">
									<input type="hidden" name="id" value={rule.id} /><input
										type="hidden"
										name="direction"
										value={direction}
									/><button
										class="btn btn-secondary"
										disabled={direction === 'up' ? index === 0 : index === data.rules.length - 1}
										>{direction === 'up' ? m.rules_move_up() : m.rules_move_down()}</button
									>
								</form>{/each}
							<form
								method="POST"
								action="?/delete"
								onsubmit={(event) => {
									if (!confirm(m.common_confirm_delete())) event.preventDefault();
								}}
							>
								<input type="hidden" name="id" value={rule.id} /><button class="btn-danger"
									>{m.common_delete()}</button
								>
							</form>
						</div>{/if}
				</div>
			</li>
		{/each}
	</ol>
{/if}
