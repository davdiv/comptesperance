import path from 'node:path';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ensureDataRepo } from '$lib/server/repository';
import { readBinaryFile, safeJoin } from '$lib/server/store';

const CONTENT_TYPES: Record<string, string> = {
	'.pdf': 'application/pdf',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.webp': 'image/webp'
};

export const GET: RequestHandler = async ({ url }) => {
	const documentPath = url.searchParams.get('path') ?? '';
	const normalizedPath = path.posix.normalize(documentPath);
	if (normalizedPath !== documentPath || !normalizedPath.startsWith('documents/')) {
		error(400, 'Invalid document path');
	}
	const root = await ensureDataRepo();
	const filePath = safeJoin(root, normalizedPath);
	try {
		const data = await readBinaryFile(filePath);
		const extension = path.extname(filePath).toLowerCase();
		return new Response(new Uint8Array(data), {
			headers: {
				'content-type': CONTENT_TYPES[extension] ?? 'application/octet-stream',
				'content-disposition': `inline; filename="${path.basename(filePath)}"`
			}
		});
	} catch {
		error(404, 'Document not found');
	}
};
