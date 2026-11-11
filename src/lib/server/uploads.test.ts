import { afterEach, expect, it, vi } from 'vitest';
import { readUploadFiles } from './uploads';
import { m } from '#lib/paraglide/messages.js';
afterEach(() => vi.unstubAllEnvs());

function request(files: File[]) {
	const form = new FormData();
	for (const file of files) form.append('file', file);
	return new Request('http://localhost/documents', { method: 'POST', body: form });
}
it('reads multiple files within the per-file limit, including an exact-boundary file', async () => {
	vi.stubEnv('MAX_EVIDENCE_BYTES', '4');
	const result = await readUploadFiles(
		request([new File(['1234'], 'one.pdf'), new File(['12'], 'two.pdf')]),
		true
	);
	expect('files' in result && result.files.map((file) => file.name)).toEqual([
		'one.pdf',
		'two.pdf'
	]);
});
it('rejects the entire batch if any file exceeds the configured limit', async () => {
	vi.stubEnv('MAX_EVIDENCE_BYTES', '4');
	expect(
		await readUploadFiles(request([new File(['1'], 'one.pdf'), new File(['12345'], 'two.pdf')]))
	).toEqual({ status: 400, error: m.upload_file_too_large() });
});
it('provides friendly errors for empty selections and unsupported evidence types', async () => {
	expect(await readUploadFiles(request([]))).toEqual({
		status: 400,
		error: m.upload_select_files()
	});
	for (const name of ['bad.exe', 'badxpdf'])
		expect(await readUploadFiles(request([new File(['data'], name)]), true)).toEqual({
			status: 400,
			error: m.upload_unsupported_type()
		});
});
it('translates direct and wrapped adapter request-body errors to an inline 413', async () => {
	for (const cause of [
		{ status: 413 },
		new Error('Multipart failure', { cause: { status: 413 } })
	]) {
		const result = await readUploadFiles({
			formData: vi.fn().mockRejectedValue(cause)
		} as unknown as Request);
		expect(result).toEqual({ status: 413, error: m.upload_body_too_large() });
	}
});
it('does not expose raw multipart parser errors', async () => {
	expect(
		await readUploadFiles({
			formData: vi.fn().mockRejectedValue(new Error('Private parser error'))
		} as unknown as Request)
	).toEqual({ status: 400, error: m.upload_invalid() });
});
