import { render } from 'svelte/server';
import { expect, it, vi } from 'vitest';
import { m } from '#lib/paraglide/messages.js';
import ErrorPage from '../../routes/+error.svelte';
vi.mock('$app/state', () => ({
	page: { status: 413, error: { message: 'Raw internal upload limit error' } }
}));
it('shows friendly request-body guidance rather than the internal adapter error', () => {
	const html = render(ErrorPage).body;
	expect(html).toContain(m.upload_body_too_large());
	expect(html).not.toContain('Raw internal upload limit error');
});
