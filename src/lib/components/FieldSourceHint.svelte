<script lang="ts">
	import type { FieldSource } from '#lib/types.ts';
	import { m } from '#lib/paraglide/messages.js';
	const {
		source,
		field,
		label,
		canWrite
	}: { source: FieldSource; field: string; label: string; canWrite: boolean } = $props();
</script>

<div class="flex flex-wrap items-center gap-2 text-xs text-stone-500">
	<span>{label}:</span>
	{#if source.source === 'rule'}
		<a class="underline" href={`/settings/rules#${source.rule_id}`}
			>{m.import_source_rule({ name: source.rule_name ?? '' })}</a
		>
	{:else if source.source === 'explicit'}{m.import_source_explicit()}
	{:else if source.source === 'alias'}{m.import_source_alias()}
	{:else if source.source === 'guess'}{m.import_source_guess()}
	{:else}{m.import_source_none()}{/if}
	{#if canWrite && source.source === 'explicit'}
		<form method="POST" action="?/reset_automatic">
			<input type="hidden" name="field" value={field} />
			<button class="underline" type="submit">{m.import_reset()}</button>
		</form>
	{/if}
</div>
