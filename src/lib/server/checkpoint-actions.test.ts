import { beforeEach, expect, it, vi } from 'vitest';
import { actions } from '../../routes/accounts/[account_id]/+page.server';
import { setStatementCheckpointIgnored } from './repository';

vi.mock('./repository', () => ({ setStatementCheckpointIgnored: vi.fn() }));
beforeEach(() => vi.resetAllMocks());

function event(ignored: string, canEdit = true, editMode = true) {
	const form = new FormData();
	form.set('checkpoint_id', 'statement:sample.csv');
	form.set('ignored', ignored);
	return {
		request: new Request('http://localhost/accounts/ccp', { method: 'POST', body: form }),
		params: { account_id: 'ccp' },
		locals: { user: { canEdit, editMode, canWrite: canEdit && editMode } }
	} as never;
}

it('requires write permission and edit mode for both ignore and restore', async () => {
	for (const ignored of ['true', 'false']) {
		for (const [canEdit, editMode] of [
			[false, false],
			[false, true],
			[true, false]
		]) {
			await expect(
				actions.set_checkpoint_ignored!(event(ignored, canEdit, editMode))
			).rejects.toMatchObject({ status: 403 });
		}
	}
	expect(setStatementCheckpointIgnored).not.toHaveBeenCalled();
});

it('ignores and restores statements for an active writer', async () => {
	for (const ignored of ['true', 'false']) {
		expect(await actions.set_checkpoint_ignored!(event(ignored))).toEqual({ ok: true });
		expect(setStatementCheckpointIgnored).toHaveBeenLastCalledWith(
			'ccp',
			'statement:sample.csv',
			ignored === 'true'
		);
	}
});

it('rejects malformed state and missing checkpoints', async () => {
	for (const value of ['', 'yes', '1']) {
		expect(await actions.set_checkpoint_ignored!(event(value))).toMatchObject({ status: 400 });
	}
	expect(setStatementCheckpointIgnored).not.toHaveBeenCalled();
	vi.mocked(setStatementCheckpointIgnored).mockRejectedValue(new Error('Checkpoint not found'));
	expect(await actions.set_checkpoint_ignored!(event('true'))).toMatchObject({ status: 400 });
});
