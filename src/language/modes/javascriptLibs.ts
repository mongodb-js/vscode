import { join } from 'path';
import { readFileSync } from 'fs';

const contents: { [name: string]: string } = {};

export function loadLibrary(extensionPath: string, name: string) {
	const TYPESCRIPT_LIB_SOURCE = join(extensionPath, 'node_modules/typescript/lib');
  const JQUERY_PATH = join(extensionPath, 'lib/jquery.d.ts');

	let content = contents[name];
	if (typeof content !== 'string') {
		let libPath;
		if (name === 'jquery') {
			libPath = JQUERY_PATH;
		} else {
			libPath = join(TYPESCRIPT_LIB_SOURCE, name); // from source
		}
		try {
			content = readFileSync(libPath).toString();
		} catch (e) {
			console.log(`Unable to load library ${name} at ${libPath}`);
			content = '';
		}
		contents[name] = content;
	}
	return content;
}
