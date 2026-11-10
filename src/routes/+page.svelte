<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { formatMoney } from '$lib/format';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();
	const totalBalance = $derived(
		data.accounts.reduce((sum, account) => sum + account.current_balance_cents, 0)
	);
	const totalAllocations = $derived(
		data.projects.reduce((sum, project) => sum + project.allocation_count, 0)
	);
	const totalTransactions = $derived(
		data.thirdParties.reduce((sum, thirdParty) => sum + thirdParty.transaction_count, 0)
	);
</script>

<div class="space-y-6">
	<section
		class="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 p-6 text-white shadow-lg sm:p-8"
	>
		<div class="absolute -top-20 -right-16 h-56 w-56 rounded-full bg-blue-500/20 blur-3xl"></div>
		<div class="relative">
			<p class="text-xs font-semibold tracking-[0.18em] text-blue-200 uppercase">
				{m.dashboard_title()}
			</p>
			<h1 class="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
				{formatMoney(totalBalance)}
			</h1>
			<p class="mt-2 max-w-2xl text-sm text-slate-300">{m.dashboard_subtitle()}</p>
		</div>
	</section>

	<section class="grid gap-4 md:grid-cols-3">
		<a href="/accounts" class="card group p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
			<div class="flex items-start justify-between gap-4">
				<div>
					<p class="text-sm font-medium text-slate-600">{m.nav_accounts()}</p>
					<p class="mt-3 text-3xl font-semibold text-slate-950 tabular-nums">
						{data.accounts.length}
					</p>
				</div>
				<span class="mt-1 h-10 w-1.5 rounded-full bg-blue-600"></span>
			</div>
			<p class="mt-5 text-sm font-medium text-blue-700 group-hover:underline">{m.view_all()}</p>
		</a>

		<a href="/projects" class="card group p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
			<div class="flex items-start justify-between gap-4">
				<div>
					<p class="text-sm font-medium text-slate-600">{m.nav_projects()}</p>
					<p class="mt-3 text-3xl font-semibold text-slate-950 tabular-nums">
						{data.projects.length}
					</p>
					<p class="mt-1 text-xs text-slate-500">{totalAllocations} allocations</p>
				</div>
				<span class="mt-1 h-10 w-1.5 rounded-full bg-emerald-500"></span>
			</div>
			<p class="mt-5 text-sm font-medium text-blue-700 group-hover:underline">{m.view_all()}</p>
		</a>

		<a
			href="/third-parties"
			class="card group p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
		>
			<div class="flex items-start justify-between gap-4">
				<div>
					<p class="text-sm font-medium text-slate-600">{m.nav_third_parties()}</p>
					<p class="mt-3 text-3xl font-semibold text-slate-950 tabular-nums">
						{data.thirdParties.length}
					</p>
					<p class="mt-1 text-xs text-slate-500">{totalTransactions} transactions</p>
				</div>
				<span class="mt-1 h-10 w-1.5 rounded-full bg-amber-500"></span>
			</div>
			<p class="mt-5 text-sm font-medium text-blue-700 group-hover:underline">{m.view_all()}</p>
		</a>
	</section>
</div>
