<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages.js';
	import { getLocale, setLocale } from '$lib/paraglide/runtime';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';
	import type { LayoutProps } from './$types';

	const { data, children }: LayoutProps = $props();
	const locale = $derived(getLocale());
	const pathname = $derived(page.url.pathname);
	let menuOpen = $state(false);

	const sections: { href: string; label: () => string; icon: IconName }[][] = [
		[{ href: '/', label: m.nav_dashboard, icon: 'dashboard' }],
		[
			{ href: '/accounts', label: m.nav_accounts, icon: 'accounts' },
			{ href: '/transactions', label: m.nav_transactions, icon: 'transactions' },
			{ href: '/transfers', label: m.nav_transfers, icon: 'transactions' },
			{ href: '/projects', label: m.nav_projects, icon: 'projects' },
			{ href: '/third-parties', label: m.nav_third_parties, icon: 'people' }
		],
		[
			{ href: '/documents', label: m.nav_documents, icon: 'documents' },
			{ href: '/import', label: m.nav_import, icon: 'upload' },
			{ href: '/settings', label: m.nav_settings, icon: 'settings' }
		]
	];

	function isActive(href: string): boolean {
		if (href === '/') return pathname === '/';
		if (href === '/accounts' && pathname.startsWith('/transactions/')) return true;
		if (href === '/transactions') return pathname === '/transactions';
		return pathname.startsWith(href);
	}

	$effect(() => {
		void pathname;
		menuOpen = false;
	});
</script>

<svelte:head
	><title
		>{sections
			.flat()
			.find((link) => isActive(link.href))
			?.label() ?? ''} · {data.config.app.name}</title
	></svelte:head
>

<div class="min-h-screen lg:bg-[linear-gradient(to_right,white_15rem,transparent_15rem)] lg:pl-60">
	<aside
		class="fixed inset-y-0 left-0 z-40 flex h-screen w-60 flex-col border-r border-stone-200 bg-white transition-transform lg:translate-x-0 {menuOpen
			? 'translate-x-0 shadow-xl'
			: '-translate-x-full'}"
	>
		<a href="/" class="flex h-16 items-center gap-2.5 px-5">
			<span
				class="grid size-8 place-items-center rounded-lg bg-brand-700 text-sm font-bold text-white"
				>{data.config.app.name.charAt(0).toUpperCase()}</span
			>
			<span class="text-[15px] leading-tight font-semibold text-stone-900"
				>{data.config.app.name}</span
			>
		</a>
		<nav class="flex-1 space-y-5 overflow-y-auto px-3 py-2">
			{#each sections as section, i (i)}
				<ul class="space-y-0.5">
					{#each section as link (link.href)}
						{@const active = isActive(link.href)}
						<li>
							<a
								href={link.href}
								aria-current={active ? 'page' : undefined}
								class="flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors {active
									? 'bg-brand-50 text-brand-800'
									: 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'}"
							>
								<Icon
									name={link.icon}
									class="size-[18px] {active ? 'text-brand-600' : 'text-stone-400'}"
								/>
								{link.label()}
							</a>
						</li>
					{/each}
				</ul>
			{/each}
		</nav>
		<div class="space-y-3 border-t border-stone-200 p-4">
			<div class="flex items-center gap-3">
				<span
					class="grid size-8 place-items-center rounded-full bg-stone-200 text-xs font-semibold text-stone-700 uppercase"
					>{data.user.name.slice(0, 2)}</span
				>
				<div class="min-w-0 text-sm">
					<div class="truncate font-medium text-stone-900">{data.user.name}</div>
					<div class="flex items-center gap-1 text-xs text-stone-500">
						{#if !data.user.canWrite}<Icon name="lock" class="size-3" />{/if}
						{data.user.canWrite ? m.common_read_write() : m.common_read_only()}
					</div>
				</div>
			</div>
			<div class="flex rounded-lg bg-stone-100 p-0.5 text-xs font-medium" role="group">
				{#each [['fr', 'Français'], ['en', 'English']] as const as [code, label] (code)}
					<button
						type="button"
						class="flex-1 rounded-md px-2 py-1 transition-colors {locale === code
							? 'bg-white text-stone-900 shadow-sm'
							: 'text-stone-500 hover:text-stone-800'}"
						aria-pressed={locale === code}
						onclick={() => setLocale(code)}>{label}</button
					>
				{/each}
			</div>
		</div>
	</aside>

	{#if menuOpen}
		<button
			type="button"
			class="fixed inset-0 z-30 bg-stone-900/30 lg:hidden"
			aria-label="Close menu"
			onclick={() => (menuOpen = false)}
		></button>
	{/if}

	<div class="min-h-screen min-w-0 lg:border-l lg:border-stone-200">
		<div
			class="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-stone-200 bg-white/90 px-4 backdrop-blur lg:hidden"
		>
			<button
				type="button"
				class="btn-ghost px-2"
				aria-label="Menu"
				onclick={() => (menuOpen = true)}><Icon name="menu" class="size-5" /></button
			>
			<span class="font-semibold text-stone-900">{data.config.app.name}</span>
		</div>
		<main class="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
			{@render children()}
		</main>
	</div>
</div>
