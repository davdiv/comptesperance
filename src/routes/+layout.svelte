<script lang="ts">
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages.js';
	import { getLocale, setLocale } from '$lib/paraglide/runtime';
	import type { LayoutProps } from './$types';

	const { data, children }: LayoutProps = $props();
	const locale = $derived(getLocale());
	const pathname = $derived(page.url.pathname);
	const links = $derived([
		{ href: '/', label: m.nav_dashboard() },
		{ href: '/accounts', label: m.nav_accounts() },
		{ href: '/projects', label: m.nav_projects() },
		{ href: '/third-parties', label: m.nav_third_parties() },
		{ href: '/transactions', label: m.nav_transactions() },
		{ href: '/documents', label: m.nav_documents() },
		{ href: '/import', label: m.nav_import() }
	]);

	function isActive(href: string): boolean {
		return href === '/' ? pathname === '/' : pathname.startsWith(href);
	}
</script>

<div class="min-h-screen bg-slate-100 text-slate-900">
	<header class="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur">
		<div class="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
			<a href="/" class="flex items-center gap-2 font-semibold text-slate-950">
				<span class="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-white shadow-sm">
					<svg
						viewBox="0 0 24 24"
						class="h-5 w-5"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M4 19V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14" />
						<path d="M8 7h8M8 11h8M8 15h5" />
					</svg>
				</span>
				<span>{m.app_title()}</span>
			</a>
			<nav
				class="order-3 flex w-full gap-1 overflow-x-auto px-1 pb-1 lg:order-none lg:w-auto lg:flex-1 lg:px-0 lg:pb-0"
			>
				{#each links as link}
					<a class="nav-link {isActive(link.href) ? 'nav-link-active' : ''}" href={link.href}
						>{link.label}</a
					>
				{/each}
			</nav>
			<div class="ml-auto flex items-center gap-3 text-sm">
				<span class="hidden text-slate-600 md:inline">{data.user.name}</span>
				<span class="badge {data.user.canWrite ? 'badge-green' : 'badge-slate'}">
					{data.user.canWrite ? m.common_read_write() : m.common_read_only()}
				</span>
				<select
					class="control w-auto px-2 py-1 text-xs"
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
	<main class="mx-auto max-w-7xl px-4 py-8">
		{@render children()}
	</main>
</div>
