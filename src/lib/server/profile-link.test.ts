import { afterEach, expect, it, vi } from 'vitest';
import { load } from '../../routes/+layout.server';

vi.mock('./repository', () => ({ ensureDataRepo: vi.fn().mockResolvedValue('/data') }));
vi.mock('./config', () => ({ readConfig: vi.fn().mockResolvedValue({}) }));
afterEach(() => vi.unstubAllEnvs());

it('exposes the configured Authelia settings link for readers and writers independently of edit mode', async () => {
	vi.stubEnv('AUTH_DISABLED', 'false');
	vi.stubEnv('AUTH_PROFILE_URL', ' https://auth.example.org/settings/security ');
	for (const canWrite of [false, true]) {
		const data = await load({
			locals: { user: { canWrite } },
			url: new URL('https://example.org')
		} as never);
		expect(data).toMatchObject({
			profileUrl: 'https://auth.example.org/settings/security',
			user: { canWrite }
		});
	}
});

it('hides the profile link without a configured URL or when authentication is disabled', async () => {
	for (const [disabled, url] of [
		['false', ''],
		['true', 'https://auth.example.org/settings/security']
	]) {
		vi.stubEnv('AUTH_DISABLED', disabled);
		vi.stubEnv('AUTH_PROFILE_URL', url);
		expect(
			await load({ locals: { user: {} }, url: new URL('https://example.org') } as never)
		).toMatchObject({ profileUrl: null });
	}
});
