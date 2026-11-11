<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	const {
		label,
		open = false,
		children
	}: { label: string; open?: boolean; children: Snippet } = $props();
</script>

<details class="group card mb-6 overflow-hidden" {open}>
	<summary
		class="flex cursor-pointer list-none items-center gap-2 px-5 py-3.5 text-sm font-medium text-stone-700 select-none hover:bg-stone-50 [&::-webkit-details-marker]:hidden"
	>
		<span class="grid size-6 place-items-center rounded-md bg-brand-50 text-brand-700">
			<Icon name="plus" class="size-3.5" />
		</span>
		{label}
		<Icon
			name="chevron"
			class="ml-auto size-4 text-stone-400 transition-transform group-open:rotate-90"
		/>
	</summary>
	<div class="max-w-6xl border-t border-stone-100 px-5 py-4">{@render children()}</div>
</details>
