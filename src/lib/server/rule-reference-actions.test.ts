import { beforeEach, expect, it, vi } from 'vitest';
import { actions as projectActions } from '../../routes/projects/[id]/+page.server';
import { actions as partyActions } from '../../routes/third-parties/[id]/+page.server';
import { deleteProject, deleteThirdParty } from './repository';
import { m } from '#lib/paraglide/messages.js';

vi.mock('./repository', () => ({ deleteProject: vi.fn(), deleteThirdParty: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
it('shows a friendly error when deleting a referenced project or third party', async () => {
	vi.mocked(deleteProject).mockRejectedValue(new Error('config_in_use'));
	vi.mocked(deleteThirdParty).mockRejectedValue(new Error('config_in_use'));
	for (const actions of [projectActions, partyActions]) {
		const result = await actions.delete!({
			params: { id: 'used' },
			locals: { user: { canEdit: true, canWrite: true, editMode: true } }
		} as never);
		expect(result).toMatchObject({ status: 400, data: { error: m.import_reference_in_use() } });
	}
});
