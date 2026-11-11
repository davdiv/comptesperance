<script lang="ts">
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages.js';
</script>

<section class="card mx-auto max-w-2xl space-y-4 p-6" role="alert">
	<h1 class="text-xl font-semibold">
		{page.status === 413 ? m.upload_body_too_large_title() : m.error_title()}
	</h1>
	<p class="text-stone-600">
		{page.status === 413 ? m.upload_body_too_large() : page.error?.message}
	</p>
	<a class="btn-secondary" href="/">{m.nav_dashboard()}</a>
</section>
