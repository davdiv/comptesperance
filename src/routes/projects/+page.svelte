<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { formatMoney } from '$lib/format';
	import type { PageProps } from './$types';

	const { data, form }: PageProps = $props();
</script>

<div class="space-y-6">
	<div>
		<h1 class="page-title">{m.projects_title()}</h1>
		<p class="text-slate-600">{m.projects_subtitle()}</p>
	</div>
	{#if data.user.canWrite}
		<form method="POST" class="card grid gap-3 p-4 md:grid-cols-4">
			<input name="name" required placeholder={m.project_name()} class="control md:col-span-2" />
			<input
				name="description"
				placeholder={m.project_description()}
				class="control md:col-span-2"
			/>
			<button class="btn md:col-span-4 md:w-fit">{m.project_new()}</button>
		</form>
	{/if}
	{#if form?.error}<p class="alert-error">{form.error}</p>{/if}
	<div class="table-wrap">
		<table class="table">
			<thead class="bg-slate-50 text-left text-slate-500">
				<tr>
					<th class="px-4 py-3">{m.project_name()}</th>
					<th class="px-4 py-3">{m.project_description()}</th>
					<th class="px-4 py-3 text-right">{m.project_total()}</th>
					<th class="px-4 py-3 text-right">{m.project_allocations()}</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each data.projects as project}
					<tr class="hover:bg-slate-50">
						<td class="px-4 py-3"
							><a class="link font-medium" href="/projects/{project.id}">{project.name}</a></td
						>
						<td class="px-4 py-3 text-slate-600">{project.description ?? '—'}</td>
						<td class="px-4 py-3 text-right font-semibold">{formatMoney(project.total_cents)}</td>
						<td class="px-4 py-3 text-right">{project.allocation_count}</td>
					</tr>
				{:else}
					<tr
						><td colspan="4" class="px-4 py-8 text-center text-slate-500">{m.empty_state()}</td></tr
					>
				{/each}
			</tbody>
		</table>
	</div>
</div>
