import { beforeEach, expect, it, vi } from 'vitest';
import { actions as projectActions } from '../../routes/projects/[id]/+page.server';
import { actions as partyActions } from '../../routes/third-parties/[id]/+page.server';
import { actions as settingsActions } from '../../routes/settings/+page.server';
import { mutateConfig } from './config';
import { deleteProject, deleteThirdParty } from './repository';
import { m } from '#lib/paraglide/messages.js';

vi.mock('./repository', () => ({ deleteProject: vi.fn(), deleteThirdParty: vi.fn() }));
vi.mock('./config', () => ({ mutateConfig: vi.fn() }));
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

it('shows the rule-reference message when deleting a protected category or payment mode', async () => {
	vi.mocked(mutateConfig).mockRejectedValue(new Error('config_in_use'));
	for (const collection of ['categories', 'paymentModes']) {
		const form = new FormData();
		form.set('collection', collection);
		form.set('id', 'used-by-rule');
		form.set('intent', 'delete');
		const result = await settingsActions.save!({
			request: new Request('http://localhost/settings', { method: 'POST', body: form }),
			locals: { user: { canEdit: true, canWrite: true, editMode: true } }
		} as never);
		expect(result).toMatchObject({ status: 400, data: { error: m.import_reference_in_use() } });
		expect(mutateConfig).toHaveBeenLastCalledWith(
			collection,
			expect.objectContaining({ id: 'used-by-rule', remove: true })
		);
	}
});
