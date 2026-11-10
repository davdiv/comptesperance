<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { getLocale, setLocale } from '$lib/paraglide/runtime';
	import type { LayoutProps } from './$types';

	const { data, children }: LayoutProps = $props();
	const locale = $derived(getLocale());
	const links = $derived([
		{ href: '/', label: m.nav_dashboard() },
		{ href: '/accounts', label: m.nav_accounts() },
		{ href: '/projects', label: m.nav_projects() },
		{ href: '/third-parties', label: m.nav_third_parties() },
		{ href: '/transactions', label: m.nav_transactions() },
		{ href: '/documents', label: m.nav_documents() },
		{ href: '/import', label: m.nav_import() }
	]);
</script>

<div class="min-h-screen bg-slate-50 text-slate-900">
	<header class="border-b border-slate-200 bg-white">
		<div class="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-4">
			<a href="/" class="text-lg font-semibold">{m.app_title()}</a>
			<nav class="flex flex-wrap gap-3 text-sm">
				{#each links as link}
					<a class="text-slate-600 hover:text-slate-950" href={link.href}>{link.label}</a>
				{/each}
			</nav>
			<div class="ml-auto flex items-center gap-3 text-sm">
				<span class="text-slate-500">{data.user.name}</span>
				<span
					class="rounded-full px-2 py-1 text-xs {data.user.canWrite
						? 'bg-emerald-100 text-emerald-800'
						: 'bg-slate-200 text-slate-700'}"
				>
					{data.user.canWrite ? m.common_read_write() : m.common_read_only()}
				</span>
				<select
					class="rounded border border-slate-300 px-2 py-1"
					value={locale}
					onchange={(event) => setLocale(event.currentTarget.value as 'en' | 'fr')}
					aria-label={m.locale_label()}
				>
					<option value="en">English</option>
					<option value="fr">Français</option>
				</select>
			</div>
		</div>
	</header>
	<main class="mx-auto max-w-7xl px-4 py-6">
		{@render children()}
	</main>
</div>
