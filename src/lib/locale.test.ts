import { expect, it } from 'vitest';
import { extractLocaleFromRequest, strategy } from '#lib/paraglide/runtime.js';

it('uses browser language after an explicit choice and before the English fallback', () => {
	expect(strategy).toEqual(['cookie', 'preferredLanguage', 'baseLocale']);
	for (const [language, cookie, expected] of [
		['fr-CH,fr;q=0.9,en;q=0.8', '', 'fr'],
		['en-US,en;q=0.9,fr;q=0.8', '', 'en'],
		['de-DE,fr;q=0.8,en;q=0.5', '', 'fr'],
		['fr;q=0.2,en;q=0.9', '', 'en'],
		['fr;q=0,en;q=0.9', '', 'en'],
		['de-DE', '', 'en'],
		['', '', 'en'],
		['fr-FR', 'PARAGLIDE_LOCALE=en', 'en'],
		['en-GB', 'PARAGLIDE_LOCALE=fr', 'fr'],
		['fr-FR', 'PARAGLIDE_LOCALE=unsupported', 'fr']
	]) {
		expect(
			extractLocaleFromRequest(
				new Request('http://localhost/accounts', {
					headers: { 'accept-language': language, cookie }
				})
			)
		).toBe(expected);
	}
});
