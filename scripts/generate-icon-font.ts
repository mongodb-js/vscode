import webfont from 'webfont';
import fs from 'fs/promises';
import { GlyphData } from 'webfont/dist/src/types';
import prettier from 'prettier';

/** Icons to include in the generated icon font */
const INCLUDED_ICONS = [
  'light/connection-active',
  'light/connection-inactive',
  'playground',
  'plus-circle',
];

/**
 * Generates an icon font from the included icons and outputs package.json
 * configuration field for those icons as specified in
 * https://code.visualstudio.com/api/references/icons-in-labels
 */
async function main(): Promise<void> {
  const font = await webfont({
    files: INCLUDED_ICONS.map((icon) => {
      // Legacy support for icons inside light and dark folders.
      if (icon.startsWith('light/')) {
        return `./images/${icon}.svg`;
      }
      return `./images/icons/${icon}.svg`;
    }),
    fontName: 'MongoDB Icons',
    formats: ['woff'],
    normalize: true,
    centerHorizontally: true,
  });

  if (!font.woff) {
    throw new Error('Error occurred generating template');
  }

  await fs.writeFile('./fonts/mongodb-icons.woff', font.woff);

  const iconsConfig = {};
  font.glyphsData?.forEach((glyph) => {
    if (!glyph.metadata?.name) {
      throw new Error('There is a glyph without a name');
    }
    iconsConfig[`mdb-${glyph.metadata.name}`] = {
      description: 'MongoDB Icon',
      default: {
        fontPath: './fonts/mongodb-icons.woff',
        fontCharacter: getUnicodeHex(glyph),
      },
    };
  });

  // Prints out the VSCode configuration package.json
  const currentConfiguration = JSON.parse(
    await fs.readFile('./package.json', 'utf8')
  );

  currentConfiguration.contributes.icons = iconsConfig;

  const prettierConfig = await prettier.resolveConfig('./.prettierrc.json');
  await fs.writeFile(
    './package.json',
    prettier.format(JSON.stringify(currentConfiguration), {
      ...prettierConfig,
      parser: 'json-stringify',
    })
  );
}

function getUnicodeHex(glyph: GlyphData): string {
  if (glyph.metadata?.unicode == undefined) {
    throw new Error('No unicode defined');
  }
  const hex = glyph.metadata?.unicode[0].codePointAt(0)!.toString(16);

  return `\\${hex}`;
}

main();
