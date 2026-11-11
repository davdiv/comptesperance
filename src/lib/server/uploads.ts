import { m } from '$lib/paraglide/messages.js';
import { getEnv } from './env';

function bodyTooLarge(cause: unknown): boolean {
	if (!cause || typeof cause !== 'object') return false;
	if ('status' in cause && cause.status === 413) return true;
	return 'cause' in cause && cause.cause !== cause && bodyTooLarge(cause.cause);
}

export async function readUploadFiles(
	request: Request,
	evidence = false
): Promise<{ files: File[] } | { error: string; status: 400 | 413 }> {
	let form: FormData;
	try {
		form = await request.formData();
	} catch (cause) {
		return bodyTooLarge(cause)
			? { status: 413, error: m.upload_body_too_large() }
			: { status: 400, error: m.upload_invalid() };
	}
	const files = form.getAll('file');
	if (!files.length || files.some((file) => typeof file === 'string' || !file.name))
		return { status: 400, error: m.upload_select_files() };
	const uploads = files as File[];
	if (uploads.some((file) => file.size > getEnv().maxEvidenceBytes))
		return { status: 400, error: m.upload_file_too_large() };
	if (evidence && uploads.some((file) => !/\.(pdf|png|jpe?g|webp)$/i.test(file.name)))
		return { status: 400, error: m.upload_unsupported_type() };
	return { files: uploads };
}
