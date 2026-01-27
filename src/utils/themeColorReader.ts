import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Interface for the token colors we care about for JSON syntax highlighting
 */
export interface JsonTokenColors {
  key: string; // Property key color (variable, meta.object-literal.key)
  string: string; // String color
  number: string; // Number color
  boolean: string; // Boolean color (constant.language)
  null: string; // Null color (constant.language)
  type: string; // Type/class name color (for ObjectId, etc.)
  comment: string; // Comment color
  punctuation: string; // Punctuation color
}

// Default colors matching VS Code's "Dark+ (default dark)" theme
const DEFAULT_DARK_COLORS: JsonTokenColors = {
  key: '#9CDCFE', // variable, meta.object-literal.key
  string: '#CE9178',
  number: '#B5CEA8',
  boolean: '#569CD6', // constant.language
  null: '#569CD6', // constant.language
  type: '#4EC9B0', // entity.name.type, support.class
  comment: '#6A9955',
  punctuation: '#D4D4D4',
};

// Default colors for light themes
const DEFAULT_LIGHT_COLORS: JsonTokenColors = {
  key: '#001080',
  string: '#A31515',
  number: '#098658',
  boolean: '#0000FF',
  null: '#0000FF',
  type: '#267F99',
  comment: '#008000',
  punctuation: '#000000',
};

// Scopes we're looking for and their mapping to our color keys
// We use exact matching to avoid false positives like "string.regexp" matching "string"
const SCOPE_MAPPINGS: {
  scopes: string[];
  colorKey: keyof JsonTokenColors;
  excludePatterns?: string[];  // Patterns to exclude from matching
}[] = [
    {
      scopes: [
        'meta.object-literal.key',
        'support.type.property-name',
        'variable.other.property',
        'variable',
      ],
      colorKey: 'key',
      excludePatterns: ['variable.language', 'variable.other.enummember'],
    },
    {
      scopes: [
        'string',
        'string.quoted',
        'string.quoted.double',
        'string.quoted.single',
      ],
      colorKey: 'string',
      // Exclude special string types that have different colors
      excludePatterns: ['string.regexp', 'string.tag', 'string.value', 'string.template'],
    },
    {
      scopes: ['constant.numeric'],
      colorKey: 'number',
    },
    {
      scopes: ['constant.language'],
      colorKey: 'boolean',
      excludePatterns: ['constant.language.import', 'constant.language.symbol'],
    },
    {
      scopes: ['entity.name.type', 'support.class', 'support.type'],
      colorKey: 'type',
    },
    {
      scopes: ['comment', 'comment.line', 'comment.block'],
      colorKey: 'comment',
    },
    {
      // For punctuation, we want the general punctuation color but exclude definition markers
      // (like quotes around strings, comment markers, etc.)
      scopes: ['punctuation', 'punctuation.separator', 'punctuation.accessor', 'meta.brace'],
      colorKey: 'punctuation',
      excludePatterns: ['punctuation.definition', 'punctuation.section'],
    },
  ];

interface ThemeTokenColor {
  scope?: string | string[];
  settings?: {
    foreground?: string;
    fontStyle?: string;
  };
}

interface ThemeJson {
  name?: string;
  type?: string;
  colors?: Record<string, string>;
  tokenColors?: ThemeTokenColor[];
  include?: string;
}

/**
 * Find the theme JSON file for the given theme name
 */
function findThemeFile(themeName: string): string | undefined {
  // Search through all extensions
  for (const ext of vscode.extensions.all) {
    const contributes = ext.packageJSON?.contributes;
    if (!contributes?.themes) {
      continue;
    }

    for (const theme of contributes.themes) {
      if (theme.label === themeName || theme.id === themeName) {
        const themePath = path.join(ext.extensionPath, theme.path);
        if (fs.existsSync(themePath)) {
          return themePath;
        }
      }
    }
  }

  return undefined;
}

/**
 * Strip comments from JSONC content without breaking strings.
 * This handles the case where // or /* appear inside string values.
 */
function stripJsonComments(content: string): string {
  let result = '';
  let i = 0;
  let inString = false;
  let stringChar = '';
  console.log(content)
  while (i < content.length) {
    const char = content[i];
    const nextChar = content[i + 1];

    // Handle string boundaries
    if ((char === '"' || char === "'") && (i === 0 || content[i - 1] !== '\\')) {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
      result += char;
      i++;
      continue;
    }

    // Skip comments only when not inside a string
    if (!inString) {
      // Line comment
      if (char === '/' && nextChar === '/') {
        // Skip until end of line
        while (i < content.length && content[i] !== '\n') {
          i++;
        }
        continue;
      }
      // Block comment
      if (char === '/' && nextChar === '*') {
        i += 2;
        // Skip until */
        while (i < content.length - 1 && !(content[i] === '*' && content[i + 1] === '/')) {
          i++;
        }
        i += 2; // Skip */
        continue;
      }
    }

    result += char;
    i++;
  }

  return result;
}

/**
 * Parse a theme JSON file and extract token colors
 */
function parseThemeFile(
  themePath: string,
  colors: JsonTokenColors
): JsonTokenColors {
  try {
    const themeContent = fs.readFileSync(themePath, 'utf8');
    // Handle JSON with comments (JSONC) by stripping comments properly
    const cleanedContent = stripJsonComments(themeContent);

    const theme: ThemeJson = JSON.parse(cleanedContent);

    // If this theme includes another theme, we should load that first
    if (theme.include) {
      const parentPath = path.join(path.dirname(themePath), theme.include);
      if (fs.existsSync(parentPath)) {
        parseThemeFile(parentPath, colors);
      }
    }

    // Extract colors from tokenColors
    // Track which scopes matched to help with debugging
    const matchedScopes: Record<string, string> = {};

    if (theme.tokenColors) {
      for (const token of theme.tokenColors) {
        if (!token.settings?.foreground) {
          continue;
        }

        const scopes = Array.isArray(token.scope)
          ? token.scope
          : token.scope
            ? [token.scope]
            : [];

        for (const mapping of SCOPE_MAPPINGS) {
          for (const scope of scopes) {
            // Check if the theme scope matches one of our target scopes
            // Using startsWith for proper prefix matching
            const isMatch = mapping.scopes.some((s) => scope === s || scope.startsWith(s + '.'));

            // Check if this scope should be excluded (e.g., string.regexp for string color)
            const isExcluded = mapping.excludePatterns?.some(
              (pattern) => scope === pattern || scope.startsWith(pattern + '.')
            );

            if (isMatch && !isExcluded) {
              console.log(`[ThemeReader] Matched "${scope}" → ${mapping.colorKey} = ${token.settings.foreground}`);
              colors[mapping.colorKey] = token.settings.foreground;
              matchedScopes[mapping.colorKey] = scope;
              break;
            }
          }
        }
      }
    }

    console.log('[ThemeReader] Matched scopes:', JSON.stringify(matchedScopes));

    return colors;
  } catch (error) {
    console.error('Error parsing theme file:', error);
    return colors;
  }
}

/**
 * Get the current theme's token colors for JSON syntax highlighting.
 * This reads the actual theme file to extract TextMate token colors.
 */
export function getThemeTokenColors(): JsonTokenColors {
  // Get the current theme name from settings
  const themeName = vscode.workspace
    .getConfiguration('workbench')
    .get<string>('colorTheme');

  // Determine if we're in a light or dark theme for defaults
  const themeKind = vscode.window.activeColorTheme.kind;
  const isLight =
    themeKind === vscode.ColorThemeKind.Light ||
    themeKind === vscode.ColorThemeKind.HighContrastLight;

  // Punctuation should use the editor foreground color (same as regular text)
  // VS Code doesn't expose the actual hex value via API, so we use defaults
  // The default foreground colors are: dark = #D4D4D4, light = #000000
  const defaultForeground = isLight ? '#000000' : '#D4D4D4';

  // Start with default colors based on theme kind
  const colors: JsonTokenColors = isLight
    ? { ...DEFAULT_LIGHT_COLORS }
    : { ...DEFAULT_DARK_COLORS };

  // Ensure punctuation uses the editor foreground color (same as regular text)
  colors.punctuation = defaultForeground;

  console.log(`[ThemeReader] Theme: ${themeName}, isLight: ${isLight}`);
  console.log(`[ThemeReader] Default colors:`, JSON.stringify(colors));

  if (!themeName) {
    return colors;
  }

  // Find the theme file
  const themePath = findThemeFile(themeName);
  if (!themePath) {
    console.log(`[ThemeReader] Could not find theme file for: ${themeName}`);
    return colors;
  }

  console.log(`[ThemeReader] Found theme file: ${themePath}`);

  // Parse the theme file and extract colors
  const result = parseThemeFile(themePath, colors);

  // If no specific punctuation color was found, use editor foreground
  // (Most themes don't define punctuation, they let it inherit the default text color)
  if (result.punctuation === colors.punctuation) {
    // No change from default, use the editor foreground
    result.punctuation = defaultForeground;
    console.log(`[ThemeReader] Using editor foreground for punctuation: ${defaultForeground}`);
  }

  console.log(`[ThemeReader] Final colors:`, JSON.stringify(result));
  return result;
}
