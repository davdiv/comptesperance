// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { SessionUser } from '#lib/server/auth.ts';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: SessionUser;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
