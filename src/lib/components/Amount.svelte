<script lang="ts">
	import { formatMoney } from '#lib/format.ts';

	const {
		cents,
		signed = true,
		class: className = ''
	}: { cents: number; signed?: boolean; class?: string } = $props();

	const text = $derived(signed && cents > 0 ? `+${formatMoney(cents)}` : formatMoney(cents));
</script>

<span class="money {signed && cents > 0 ? 'positive' : signed ? 'negative' : ''} {className}"
	>{text}</span
>
