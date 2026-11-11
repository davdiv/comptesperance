import { beforeEach, expect, it, vi } from 'vitest';
import { GET } from '../../routes/projects/[id]/export.pdf/+server';
import { getProjectDetails } from './queries';
import { transactionFilterState } from './transaction-list';
import { readConfig } from './config';
import { renderProjectPdf } from './project-pdf';

vi.mock('./queries', () => ({ getProjectDetails: vi.fn() }));
vi.mock('./transaction-list', () => ({ transactionFilterState: vi.fn() }));
vi.mock('./config', () => ({ readConfig: vi.fn() }));
vi.mock('./project-pdf', () => ({ buildProjectPdfDefinition: vi.fn(), renderProjectPdf: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
it('exports for read-only users with matching filters and without pagination', async () => {
	const url = new URL('http://localhost/projects/p/export.pdf?search=cake&limit=1&offset=2');
	vi.mocked(transactionFilterState).mockResolvedValue({
		filters: { search: 'cake', project_id: 'p', limit: 1, offset: 2 }
	} as never);
	vi.mocked(getProjectDetails).mockResolvedValue({
		project: { name: 'Été / solidaire', id: 'p' }
	} as never);
	vi.mocked(readConfig).mockResolvedValue({} as never);
	vi.mocked(renderProjectPdf).mockResolvedValue(Buffer.from('%PDF'));
	const response = await GET({
		params: { id: 'p' },
		url,
		locals: { user: { canWrite: false } }
	} as never);
	expect(transactionFilterState).toHaveBeenCalledWith(url, { project_id: 'p' });
	expect(getProjectDetails).toHaveBeenCalledWith('p', {
		search: 'cake',
		project_id: 'p',
		limit: undefined,
		offset: 0
	});
	expect(response.headers.get('content-type')).toBe('application/pdf');
	expect(response.headers.get('content-disposition')).toBe(
		'attachment; filename="ete-solidaire.pdf"'
	);
	expect(await response.text()).toBe('%PDF');
});
it('returns 404 when the project does not exist', async () => {
	vi.mocked(transactionFilterState).mockResolvedValue({ filters: {} } as never);
	vi.mocked(getProjectDetails).mockResolvedValue(null);
	await expect(
		GET({
			params: { id: 'missing' },
			url: new URL('http://localhost/projects/missing/export.pdf')
		} as never)
	).rejects.toMatchObject({ status: 404 });
	expect(renderProjectPdf).not.toHaveBeenCalled();
});
