import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { transactionFilterState } from '#lib/server/transaction-list.ts';
import { getProjectDetails } from '#lib/server/queries.ts';
import { readConfig } from '#lib/server/config.ts';
import { buildProjectPdfDefinition, renderProjectPdf } from '#lib/server/project-pdf.ts';

export const GET: RequestHandler = async ({ params, url }) => {
	const state = await transactionFilterState(url, { project_id: params.id });
	const details = await getProjectDetails(params.id, {
		...state.filters,
		limit: undefined,
		offset: 0
	});
	if (!details) error(404, 'Project not found');
	const config = await readConfig();
	const pdf = await renderProjectPdf(buildProjectPdfDefinition(details, config, state));
	const slug =
		details.project.name
			.normalize('NFKD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '') || params.id.replace(/[^a-zA-Z0-9_-]/g, '_');
	return new Response(new Uint8Array(pdf), {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `attachment; filename="${slug}.pdf"`,
			'cache-control': 'private, no-store'
		}
	});
};
