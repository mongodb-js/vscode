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
const SCOPE_MAPPINGS: { scopes: string[]; colorKey: keyof JsonTokenColors }[] =
  [
    {
      scopes: [
        'meta.object-literal.key',
        'support.type.property-name',
        'variable.other.property',
        'variable',
      ],
      colorKey: 'key',
    },
    {
      scopes: [
        'string',
        'string.quoted',
        'string.quoted.double',
        'string.quoted.single',
      ],
      colorKey: 'string',
    },
    {
      scopes: ['constant.numeric', 'constant.numeric.json'],
      colorKey: 'number',
    },
    {
      scopes: ['constant.language', 'constant.language.json'],
      colorKey: 'boolean',
    }, // covers true, false, null
    {
      scopes: ['entity.name.type', 'support.class', 'support.type'],
      colorKey: 'type',
    },
    {
      scopes: ['comment', 'comment.line', 'comment.block'],
      colorKey: 'comment',
    },
    { scopes: ['punctuation', 'meta.brace'], colorKey: 'punctuation' },
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
 * Parse a theme JSON file and extract token colors
 */
function parseThemeFile(
  themePath: string,
  colors: JsonTokenColors
): JsonTokenColors {
  try {
    const themeContent = fs.readFileSync(themePath, 'utf8');
    // Handle JSON with comments (JSONC) by removing comments
    const cleanedContent = themeContent
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\/\/.*$/gm, ''); // Remove line comments

    const theme: ThemeJson = JSON.parse(cleanedContent);

    // If this theme includes another theme, we should load that first
    if (theme.include) {
      const parentPath = path.join(path.dirname(themePath), theme.include);
      if (fs.existsSync(parentPath)) {
        parseThemeFile(parentPath, colors);
      }
    }

    // Extract colors from tokenColors
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
            if (mapping.scopes.some((s) => scope.includes(s))) {
              colors[mapping.colorKey] = token.settings.foreground;
              break;
            }
          }
        }
      }
    }

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

  // Start with default colors based on theme kind
  const colors: JsonTokenColors = isLight
    ? { ...DEFAULT_LIGHT_COLORS }
    : { ...DEFAULT_DARK_COLORS };

  if (!themeName) {
    return colors;
  }

  // Find the theme file
  const themePath = findThemeFile(themeName);
  if (!themePath) {
    console.log(`Could not find theme file for: ${themeName}`);
    return colors;
  }

  // Parse the theme file and extract colors
  return parseThemeFile(themePath, colors);
}
