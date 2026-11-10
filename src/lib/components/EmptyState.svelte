<script lang="ts">
	import Icon, { type IconName } from './Icon.svelte';

	const { message, icon = 'info' }: { message: string; icon?: IconName } = $props();
</script>

<div class="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
	<span class="grid size-10 place-items-center rounded-full bg-stone-100 text-stone-400">
		<Icon name={icon} class="size-5" />
	</span>
	<p class="text-sm text-stone-500">{message}</p>
</div>
