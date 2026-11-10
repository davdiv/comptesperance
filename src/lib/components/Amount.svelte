<script lang="ts">
	import { formatMoney } from '$lib/format';

	const {
		cents,
		currency = 'EUR',
		signed = true,
		class: className = ''
	}: { cents: number; currency?: string; signed?: boolean; class?: string } = $props();

	const text = $derived(
		signed && cents > 0 ? `+${formatMoney(cents, currency)}` : formatMoney(cents, currency)
	);
</script>

<span class="money {signed && cents > 0 ? 'positive' : signed ? 'negative' : ''} {className}"
	>{text}</span
>
