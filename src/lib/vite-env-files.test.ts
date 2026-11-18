import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { loadEnvFiles } from '../../vite-env-files.ts';

const loadedKey = 'COMPTES_VITE_ENV_FILES_TEST_LOADED';
const overrideKey = 'COMPTES_VITE_ENV_FILES_TEST_OVERRIDE';

afterEach(() => {
	delete process.env[loadedKey];
	vi.unstubAllEnvs();
});

function resolveEnv(config: { mode: string; envDir: string | false }) {
	const plugin = loadEnvFiles();
	const hook = plugin.configResolved;
	expect(hook).toBeTypeOf('function');
	(hook as (config: unknown) => void)(config);
}

it('loads .env values for dev servers without overriding existing variables', async () => {
	const dir = await mkdtemp(path.join(tmpdir(), 'comptesperance-env-'));
	try {
		await writeFile(path.join(dir, '.env'), `${loadedKey}=from-file\n${overrideKey}=from-file\n`);
		vi.stubEnv(overrideKey, 'from-shell');
		resolveEnv({ mode: 'development', envDir: dir });
		expect(process.env[loadedKey]).toBe('from-file');
		expect(process.env[overrideKey]).toBe('from-shell');
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

it('does not load .env files in test mode', async () => {
	const dir = await mkdtemp(path.join(tmpdir(), 'comptesperance-env-'));
	try {
		await writeFile(path.join(dir, '.env'), `${loadedKey}=from-file\n`);
		resolveEnv({ mode: 'test', envDir: dir });
		expect(process.env[loadedKey]).toBeUndefined();
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});
