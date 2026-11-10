<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon, { type IconName } from './Icon.svelte';

	const {
		tone = 'info',
		children
	}: { tone?: 'info' | 'error' | 'success' | 'warning'; children: Snippet } = $props();
	const icon: IconName = $derived(
		tone === 'success' ? 'check' : tone === 'info' ? 'info' : 'alert'
	);
</script>

<div class="alert-{tone} mb-6" role={tone === 'error' ? 'alert' : 'status'}>
	<Icon name={icon} class="mt-0.5 size-4" />
	<div class="min-w-0">{@render children()}</div>
</div>
