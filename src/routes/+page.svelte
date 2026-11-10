<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { formatMoney } from '$lib/format';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();
	const totalBalance = $derived(
		data.accounts.reduce((sum, account) => sum + account.current_balance_cents, 0)
	);
</script>

<div class="space-y-6">
	<section class="rounded-xl border border-slate-200 bg-white p-5">
		<h1 class="text-2xl font-semibold">{m.dashboard_title()}</h1>
		<p class="mt-1 text-slate-600">{m.dashboard_subtitle()}</p>
		<div class="mt-4 text-3xl font-semibold">{formatMoney(totalBalance)}</div>
	</section>

	<section class="grid gap-4 md:grid-cols-3">
		<div class="rounded-xl border border-slate-200 bg-white p-4">
			<h2 class="font-semibold">{m.nav_accounts()}</h2>
			<p class="mt-2 text-2xl">{data.accounts.length}</p>
			<a class="text-sm text-blue-700 hover:underline" href="/accounts">{m.view_all()}</a>
		</div>
		<div class="rounded-xl border border-slate-200 bg-white p-4">
			<h2 class="font-semibold">{m.nav_projects()}</h2>
			<p class="mt-2 text-2xl">{data.projects.length}</p>
			<a class="text-sm text-blue-700 hover:underline" href="/projects">{m.view_all()}</a>
		</div>
		<div class="rounded-xl border border-slate-200 bg-white p-4">
			<h2 class="font-semibold">{m.nav_third_parties()}</h2>
			<p class="mt-2 text-2xl">{data.thirdParties.length}</p>
			<a class="text-sm text-blue-700 hover:underline" href="/third-parties">{m.view_all()}</a>
		</div>
	</section>
</div>
