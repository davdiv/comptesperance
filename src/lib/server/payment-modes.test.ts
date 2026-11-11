import { expect, it } from 'vitest';
import { guessPaymentMode } from './payment-modes';
const modes = ['virement', 'especes', 'cheque', 'prelevement', 'carte'].map((id) => ({
	id,
	name: id
}));
it.each([
	['VIREMENT INSTANTANE RECU', 'virement'],
	['VIR SEPA', 'virement'],
	['VERSEMENT ESPECES', 'especes'],
	['RETRAIT DAB', 'especes'],
	['CHÈQUE 12345', 'cheque'],
	['REMISE CHEQUE', 'cheque'],
	['PRÉLÈVEMENT SEPA', 'prelevement'],
	['CB SHOP', 'carte'],
	['CARTE SHOP', 'carte'],
	['ACHAT CB SHOP', 'carte']
])('guesses %s from a CCP label or description', (text, expected) => {
	expect(guessPaymentMode({ label: text, record_type: 'ccp' }, modes)).toBe(expected);
	expect(guessPaymentMode({ label: 'Other', description: text, record_type: 'ccp' }, modes)).toBe(
		expected
	);
});
it('guesses SumUp sales and payouts without relying on descriptions', () => {
	expect(guessPaymentMode({ label: '', record_type: 'vente' }, modes)).toBe('carte');
	expect(guessPaymentMode({ label: '', record_type: 'virement' }, modes)).toBe('virement');
});
it('does not guess missing, archived or unknown modes or match embedded prefixes', () => {
	expect(guessPaymentMode({ label: 'VIREMENT', record_type: 'ccp' }, [])).toBe('');
	expect(
		guessPaymentMode({ label: 'VIREMENT', record_type: 'ccp' }, [
			{ id: 'virement', name: 'Wire', archived: true }
		])
	).toBe('');
	expect(guessPaymentMode({ label: 'Other VIREMENT', record_type: 'ccp' }, modes)).toBe('');
	expect(guessPaymentMode({ label: '', record_type: 'unknown' }, modes)).toBe('');
});
