import PdfPrinter from 'pdfmake';
import { createRequire } from 'node:module';
import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { m } from '#lib/paraglide/messages.js';
import { getLocale } from '#lib/paraglide/runtime.js';
import { formatDate, formatMoney } from '#lib/format.ts';
import type { ProjectDetails } from '#lib/server/queries.ts';
import type { transactionFilterState } from '#lib/server/transaction-list.ts';
import type { DataConfig } from '#lib/types.ts';

export type PdfFilterState = Awaited<ReturnType<typeof transactionFilterState>>;
const require = createRequire(import.meta.url);
const money = (value: number): TableCell => ({
	text: formatMoney(value),
	alignment: 'right',
	noWrap: true
});

export function projectFilterSummary(state: PdfFilterState, config: DataConfig): string {
	const f = state.filters;
	const name = (items: { id: string; name: string }[], id: string) =>
		items.find((item) => item.id === id)?.name ?? id;
	const parts: string[] = [];
	const add = (label: string, value: string | undefined) => {
		if (value) parts.push(`${label}: ${value}`);
	};
	add(m.common_search(), f.search);
	add(
		m.import_account(),
		f.account_id &&
			(state.filterOptions.accounts.find((a) => a.account_id === f.account_id)?.name ??
				f.account_id)
	);
	add(
		m.common_third_party(),
		f.third_party_id && name(state.filterOptions.thirdParties, f.third_party_id)
	);
	add(m.date_from(), f.date_from && formatDate(f.date_from));
	add(m.date_to(), f.date_to && formatDate(f.date_to));
	add(m.common_category(), f.category_id && name(config.categories, f.category_id));
	add(m.payment_mode(), f.payment_mode_id && name(config.paymentModes, f.payment_mode_id));
	add(
		m.allocation_status(),
		f.allocation_status &&
			({
				allocated: m.allocation_allocated(),
				unallocated: m.allocation_unallocated(),
				partial: m.allocation_partial()
			}[f.allocation_status] ??
				f.allocation_status)
	);
	add(m.filters_record_type(), f.record_type);
	add(
		m.transaction_excluded(),
		f.excluded === '0'
			? m.filters_not_excluded()
			: f.excluded === '1'
				? m.filters_only_excluded()
				: undefined
	);
	if (f.include_transfers !== undefined)
		parts.push(f.include_transfers ? m.common_include_transfers() : m.common_hide_transfers());
	return parts.join(' · ');
}

export function buildProjectPdfDefinition(
	details: ProjectDetails,
	config: DataConfig,
	state: PdfFilterState,
	generatedAt = new Date()
): TDocumentDefinitions {
	const headings = [
		m.common_date(),
		m.project_allocation_account(),
		m.common_label(),
		m.common_third_party(),
		m.common_category(),
		m.payment_mode(),
		m.common_notes(),
		m.common_amount(),
		m.project_allocation_amount()
	];
	const rows: TableCell[][] = details.allocations.map((a) => {
		const t = a.transaction;
		return [
			formatDate(t?.date),
			a.account_name ?? a.account_id,
			{
				stack: [
					{ text: t?.label ?? '—' },
					...(t?.description
						? [
								{
									text: t.description,
									fontSize: 7,
									color: '#57534e',
									margin: [0, 3, 0, 0] as [number, number, number, number]
								}
							]
						: [])
				]
			},
			t?.third_party_name ?? t?.third_party_id ?? '—',
			t?.category_name ?? t?.category_id ?? '—',
			t?.payment_mode_name ?? t?.payment_mode_id ?? '—',
			a.note ?? '',
			money(t?.amount_cents ?? 0),
			money(a.amount_cents)
		];
	});
	const summary = projectFilterSummary(state, config);
	const showTransfers = details.by_account.some((a) => a.transfer_cents !== 0);
	const displayedTransfers = details.allocations.reduce(
		(sum, a) => sum + (a.transaction?.transfer_id ? a.amount_cents : 0),
		0
	);
	const content: Content[] = [
		{ text: config.app.name, fontSize: 11, color: '#57534e' },
		{ text: details.project.name, fontSize: 23, bold: true, margin: [0, 5, 0, 6] },
		...(details.project.description
			? [{ text: details.project.description, margin: [0, 0, 0, 6] } as Content]
			: []),
		{
			text: m.pdf_generated({
				date: new Intl.DateTimeFormat(getLocale() === 'fr' ? 'fr-FR' : 'en-GB', {
					year: 'numeric',
					month: 'short',
					day: 'numeric',
					hour: '2-digit',
					minute: '2-digit',
					timeZoneName: 'short'
				}).format(generatedAt)
			}),
			color: '#57534e'
		},
		...(summary
			? [{ text: `${m.filters_title()}: ${summary}`, margin: [0, 5, 0, 0] } as Content]
			: []),
		{
			text: `${m.project_total()}: ${formatMoney(details.total_cents)}`,
			fontSize: 15,
			bold: true,
			margin: [0, 16, 0, 10]
		},
		{
			text: `${m.account_incoming()}: ${formatMoney(details.incoming_cents)}   ·   ${m.account_outgoing()}: ${formatMoney(details.outgoing_cents)}${details.transfer_cents ? `   ·   ${m.common_transfers()}: ${formatMoney(details.transfer_cents)}` : ''}`,
			fontSize: 11
		},
		{ text: m.project_by_account(), style: 'section' },
		{
			table: {
				headerRows: 1,
				widths: showTransfers ? ['*', 100, 100, 100, 100] : ['*', 120, 120, 120],
				body: [
					[
						m.project_allocation_account(),
						{ text: m.account_incoming(), alignment: 'right' },
						{ text: m.account_outgoing(), alignment: 'right' },
						...(showTransfers ? [{ text: m.common_transfers(), alignment: 'right' as const }] : []),
						{ text: m.common_amount(), alignment: 'right' }
					],
					...details.by_account.map((a) => [
						a.account_name ?? a.account_id,
						money(a.incoming_cents),
						money(a.outgoing_cents),
						...(showTransfers ? [money(a.transfer_cents)] : []),
						money(a.amount_cents)
					])
				]
			},
			layout: 'lightHorizontalLines'
		},
		{ text: m.project_allocations(), style: 'section' },
		...(rows.length
			? [
					{
						table: {
							headerRows: 1,
							dontBreakRows: true,
							widths: [54, 64, '*', 64, 62, 62, 66, 73, 73],
							body: [
								headings.map((text) => ({
									text,
									bold: true,
									color: '#ffffff',
									fillColor: '#44403c'
								})),
								...rows,
								[
									{ text: m.pdf_visible_total(), colSpan: 7, bold: true },
									'',
									'',
									'',
									'',
									'',
									'',
									money(
										details.allocations.reduce(
											(sum, a) => sum + (a.transaction?.amount_cents ?? 0),
											0
										)
									),
									money(details.allocations.reduce((sum, a) => sum + a.amount_cents, 0))
								]
							]
						},
						layout: {
							fillColor: (row: number) => (row > 0 && row % 2 === 0 ? '#f5f5f4' : null),
							hLineWidth: () => 0.3,
							vLineWidth: () => 0,
							hLineColor: () => '#d6d3d1',
							paddingTop: () => 5,
							paddingBottom: () => 5
						}
					} as Content,
					{
						text: `${m.pdf_visible_total()} — ${m.account_incoming()}: ${formatMoney(details.allocations.reduce((sum, a) => sum + (a.transaction?.transfer_id ? 0 : Math.max(a.amount_cents, 0)), 0))}   ·   ${m.account_outgoing()}: ${formatMoney(details.allocations.reduce((sum, a) => sum + (a.transaction?.transfer_id ? 0 : Math.min(a.amount_cents, 0)), 0))}${displayedTransfers ? `   ·   ${m.common_transfers()}: ${formatMoney(displayedTransfers)}` : ''}`,
						margin: [0, 8, 0, 0]
					} as Content
				]
			: [{ text: m.project_no_allocations() }]),
		...(details.hidden_transfer_count
			? [
					{
						text: m.pdf_hidden_transfers({ count: details.hidden_transfer_count }),
						margin: [0, 8, 0, 0],
						color: '#57534e'
					} as Content
				]
			: [])
	];
	return {
		pageSize: 'A4',
		pageOrientation: 'landscape',
		pageMargins: [28, 28, 28, 36],
		defaultStyle: { font: 'DejaVuSans', fontSize: 8 },
		styles: { section: { fontSize: 12, bold: true, margin: [0, 15, 0, 7] } },
		content,
		footer: (page, pages) => ({
			text: m.pdf_page({ page, pages }),
			alignment: 'right',
			margin: [28, 10, 28, 0],
			fontSize: 8,
			color: '#57534e'
		})
	};
}

export async function renderProjectPdf(definition: TDocumentDefinitions): Promise<Buffer> {
	const printer = new PdfPrinter({
		DejaVuSans: {
			normal: require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans.ttf'),
			bold: require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf'),
			italics: require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans.ttf'),
			bolditalics: require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf')
		}
	});
	return new Promise((resolve, reject) => {
		const doc = printer.createPdfKitDocument(definition);
		const chunks: Buffer[] = [];
		doc.on('data', (chunk: Buffer) => chunks.push(chunk));
		doc.on('end', () => resolve(Buffer.concat(chunks)));
		doc.on('error', reject);
		doc.end();
	});
}
