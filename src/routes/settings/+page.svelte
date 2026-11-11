<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import type { PageProps } from './$types';
	const { data, form }: PageProps = $props();
	const groups = $derived([
		{
			key: 'income',
			label: m.category_income(),
			collection: 'categories',
			entries: data.config.categories.filter((c) => c.kind === 'income')
		},
		{
			key: 'expense',
			label: m.category_expense(),
			collection: 'categories',
			entries: data.config.categories.filter((c) => c.kind === 'expense')
		},
		{
			key: 'paymentModes',
			label: m.payment_modes(),
			collection: 'paymentModes',
			entries: data.config.paymentModes
		}
	]);
</script>

<PageHeader title={m.nav_settings()} subtitle={m.settings_subtitle()} />
{#if form?.error}<Alert tone="error">{form.error}</Alert>{/if}
{#if form?.ok}<Alert tone="success">{m.settings_saved()}</Alert>{/if}
<section class="card mb-6 p-5">
	<h2 class="card-title mb-4">{m.settings_app_name()}</h2>
	{#if data.user.canWrite}
		<form method="POST" action="?/app" class="flex flex-wrap items-end gap-3">
			<label class="field flex-1"
				><span class="field-label">{m.settings_app_name()}</span><input
					class="control"
					name="name"
					required
					value={data.config.app.name}
				/></label
			>
			<button class="btn">{m.common_save()}</button>
		</form>
	{:else}<p>{data.config.app.name}</p>{/if}
</section>
{#each groups as group (group.key)}
	<section class="card mb-6">
		<div class="card-header"><h2 class="card-title">{group.label}</h2></div>
		{#if group.entries.length}
			<div class="overflow-x-auto">
				<table class="table">
					<thead
						><tr
							><th>{m.settings_name()}</th>{#if group.collection === 'categories'}<th
									>{m.category_kind()}</th
								>{/if}<th>{m.config_archived()}</th>{#if data.user.canWrite}<th
									>{m.common_actions()}</th
								>{/if}</tr
						></thead
					>
					<tbody>
						{#each group.entries as item (item.id)}
							{@const formId = 'config-' + group.key + '-' + item.id}
							<tr>
								<td
									>{#if data.user.canWrite}
										<form id={formId} method="POST" action="?/save">
											<input type="hidden" name="id" value={item.id} /><input
												type="hidden"
												name="collection"
												value={group.collection}
											/>
											<input
												name="name"
												value={item.name}
												required
												class="control"
												aria-label={m.settings_name()}
											/>
										</form>
									{:else}{item.name}{/if}</td
								>
								{#if group.collection === 'categories'}<td
										>{#if data.user.canWrite}
											<select
												form={formId}
												name="kind"
												class="control"
												aria-label={m.category_kind()}
											>
												<option value="income" selected={group.key === 'income'}
													>{m.category_income()}</option
												>
												<option value="expense" selected={group.key === 'expense'}
													>{m.category_expense()}</option
												>
											</select>
										{:else}{group.label}{/if}</td
									>{/if}
								<td
									>{#if data.user.canWrite}<input
											form={formId}
											type="checkbox"
											name="archived"
											checked={!!item.archived}
											class="checkbox"
											aria-label={m.config_archived()}
										/>{:else}{item.archived ? m.config_archived() : '—'}{/if}</td
								>
								{#if data.user.canWrite}<td
										><div class="flex gap-2">
											<button form={formId} class="btn-secondary">{m.common_save()}</button><button
												form={formId}
												name="intent"
												value="delete"
												class="btn-danger"
												onclick={(event) => {
													if (!confirm(m.common_confirm_delete())) event.preventDefault();
												}}>{m.common_delete()}</button
											>
										</div></td
									>{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}<EmptyState message={m.empty_state()} />{/if}
		{#if data.user.canWrite}
			<form
				method="POST"
				action="?/save"
				class="flex flex-wrap items-end gap-3 border-t border-stone-100 p-5"
			>
				<input type="hidden" name="collection" value={group.collection} />
				{#if group.collection === 'categories'}<input
						type="hidden"
						name="kind"
						value={group.key}
					/>{/if}
				<label class="field flex-1"
					><span class="field-label">{m.settings_name()}</span><input
						name="name"
						required
						class="control"
					/></label
				>
				<button class="btn">{m.common_create()}</button>
			</form>
		{/if}
	</section>
{/each}
