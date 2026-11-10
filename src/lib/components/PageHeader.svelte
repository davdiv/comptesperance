<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	const {
		title,
		subtitle,
		back,
		meta,
		actions
	}: {
		title: string;
		subtitle?: string | null;
		back?: { href: string; label: string };
		meta?: Snippet;
		actions?: Snippet;
	} = $props();
</script>

<header class="mb-6">
	{#if back}
		<a
			href={back.href}
			class="mb-3 inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-900"
		>
			<Icon name="back" class="size-3.5" />{back.label}
		</a>
	{/if}
	<div class="flex flex-wrap items-end justify-between gap-4">
		<div class="min-w-0">
			<h1 class="text-2xl font-semibold text-balance">{title}</h1>
			{#if subtitle}<p class="mt-1 text-sm text-stone-500">{subtitle}</p>{/if}
			{#if meta}<div class="mt-2 flex flex-wrap items-center gap-2">{@render meta()}</div>{/if}
		</div>
		{#if actions}<div class="flex flex-wrap items-center gap-2">{@render actions()}</div>{/if}
	</div>
</header>
