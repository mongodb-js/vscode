import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface JsonTokenColors {
  key: string;
  string: string;
  number: string;
  boolean: string;
  null: string;
  type: string;
  comment: string;
  punctuation: string;
}

const DEFAULT_DARK_COLORS: JsonTokenColors = {
  key: '#9CDCFE',
  string: '#CE9178',
  number: '#B5CEA8',
  boolean: '#569CD6',
  null: '#569CD6',
  type: '#4EC9B0',
  comment: '#6A9955',
  punctuation: '#D4D4D4',
};

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

const SCOPE_MAPPINGS: Record<string, keyof JsonTokenColors> = Object.assign(
  Object.create(null),
  {
    'meta.object-literal.key': 'key',
    'support.type.property-name': 'key',
    string: 'string',
    'string.quoted': 'string',
    'constant.numeric': 'number',
    'constant.language.boolean': 'boolean',
    'constant.language.null': 'null',
    'constant.language': 'boolean',
    'entity.name.type': 'type',
    'support.class': 'type',
    comment: 'comment',
    'punctuation.separator.dictionary': 'punctuation',
    'punctuation.separator.mapping.key-value': 'punctuation',
    'punctuation.definition.dictionary': 'punctuation',
    'punctuation.definition.array': 'punctuation',
    punctuation: 'punctuation',
  },
);

interface ThemeJson {
  tokenColors?: Array<{
    scope?: string | string[];
    settings?: { foreground?: string };
  }>;
  include?: string;
}

function findThemeFile(themeName: string): string | undefined {
  for (const ext of vscode.extensions.all) {
    const themes = ext.packageJSON?.contributes?.themes;
    if (!themes) continue;

    for (const theme of themes) {
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

function parseThemeFile(
  themePath: string,
  colors: JsonTokenColors,
): JsonTokenColors {
  try {
    const content = fs.readFileSync(themePath, 'utf8');
    // Strip single-line and block comments for JSONC support
    const stripped = content
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    const theme: ThemeJson = JSON.parse(stripped);

    if (theme.include) {
      const parentPath = path.join(path.dirname(themePath), theme.include);
      if (fs.existsSync(parentPath)) {
        parseThemeFile(parentPath, colors);
      }
    }

    // Extract colors from tokenColors
    for (const token of theme.tokenColors ?? []) {
      const foreground = token.settings?.foreground;
      if (!foreground) continue;

      const scopes = Array.isArray(token.scope)
        ? token.scope
        : token.scope
          ? [token.scope]
          : [];

      for (const scope of scopes) {
        // Find matching color key for this scope
        for (const [pattern, colorKey] of Object.entries(SCOPE_MAPPINGS)) {
          if (scope === pattern || scope.startsWith(pattern + '.')) {
            colors[colorKey] = foreground;
            break;
          }
        }
      }
    }

    return colors;
  } catch {
    return colors;
  }
}

export function getThemeTokenColors(): JsonTokenColors {
  const themeName = vscode.workspace
    .getConfiguration('workbench')
    .get<string>('colorTheme');
  const themeKind = vscode.window.activeColorTheme.kind;
  const isLight =
    themeKind === vscode.ColorThemeKind.Light ||
    themeKind === vscode.ColorThemeKind.HighContrastLight;

  const colors: JsonTokenColors = isLight
    ? { ...DEFAULT_LIGHT_COLORS }
    : { ...DEFAULT_DARK_COLORS };

  if (!themeName) {
    return colors;
  }

  const themePath = findThemeFile(themeName);
  if (!themePath) {
    return colors;
  }

  return parseThemeFile(themePath, colors);
}
