import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function pathExists(filePath: string): Promise<boolean> {
	try {
		await stat(filePath);
		return true;
	} catch {
		return false;
	}
}

export async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
	try {
		return JSON.parse(await readFile(filePath, 'utf8')) as T;
	} catch {
		return fallback;
	}
}

export async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
	await mkdir(path.dirname(filePath), { recursive: true });
	const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
	await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
	await rename(tmp, filePath);
}

export async function readTextFile(filePath: string): Promise<string> {
	return readFile(filePath, 'utf8');
}

export async function readBinaryFile(filePath: string): Promise<Buffer> {
	return readFile(filePath);
}

export async function writeBinaryFile(filePath: string, data: Uint8Array): Promise<void> {
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, data);
}

export async function writeTextFile(filePath: string, data: string): Promise<void> {
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, data, 'utf8');
}

export async function removeFile(filePath: string): Promise<void> {
	try {
		await unlink(filePath);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
	}
}

export async function listDirectoryNames(dirPath: string): Promise<string[]> {
	try {
		const entries = await readdir(dirPath, { withFileTypes: true });
		return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
	} catch {
		return [];
	}
}

export async function listFilesRecursive(
	dirPath: string,
	predicate: (fileName: string) => boolean = () => true
): Promise<string[]> {
	const results: string[] = [];
	async function walk(current: string): Promise<void> {
		let entries;
		try {
			entries = await readdir(current, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			const fullPath = path.join(current, entry.name);
			if (entry.isDirectory()) {
				await walk(fullPath);
			} else if (entry.isFile() && predicate(entry.name)) {
				results.push(path.relative(dirPath, fullPath));
			}
		}
	}
	await walk(dirPath);
	return results.sort();
}

export function safeJoin(rootPath: string, ...parts: string[]): string {
	const resolvedRoot = path.resolve(rootPath);
	const resolved = path.resolve(resolvedRoot, ...parts);
	if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
		throw new Error('Invalid path');
	}
	return resolved;
}
