export function documentDisplayName(value: string): string {
	const name = value.split(/[\\/]/).pop() ?? value;
	return name.replace(/^\d+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, '');
}
