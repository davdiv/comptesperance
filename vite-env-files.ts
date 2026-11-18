import { loadEnv, type Plugin } from 'vite';

export function loadEnvFiles(): Plugin {
	return {
		name: 'comptesperance-load-env-files',
		apply: 'serve',
		configResolved(config) {
			if (config.mode === 'test' || config.isProduction || config.envDir === false) return;
			for (const [key, value] of Object.entries(loadEnv(config.mode, config.envDir, ''))) {
				if (process.env[key] === undefined) process.env[key] = value;
			}
		}
	};
}
