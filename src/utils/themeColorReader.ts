import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import JSON5 from 'json5';
import { createLogger } from '../logging';

const log = createLogger('theme color reader');

export interface TokenColors {
  key: string;
  string: string;
  number: string;
  boolean: string;
  null: string;
  type: string;
  comment: string;
  punctuation: string;
}

const DEFAULT_DARK_COLORS: TokenColors = {
  key: '#9CDCFE',
  string: '#CE9178',
  number: '#B5CEA8',
  boolean: '#569CD6',
  null: '#569CD6',
  type: '#4EC9B0',
  comment: '#6A9955',
  punctuation: '#D4D4D4',
};

const DEFAULT_LIGHT_COLORS: TokenColors = {
  key: '#001080',
  string: '#A31515',
  number: '#098658',
  boolean: '#0000FF',
  null: '#0000FF',
  type: '#267F99',
  comment: '#008000',
  punctuation: '#000000',
};

const SCOPE_MAPPINGS: Record<string, keyof TokenColors> = Object.assign(
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

function extractTokenOverrides(theme: ThemeJson): Partial<TokenColors> {
  const overrides: Partial<TokenColors> = {};

  for (const token of theme.tokenColors ?? []) {
    const foreground = token.settings?.foreground;
    if (!foreground) continue;

    const scopes = Array.isArray(token.scope)
      ? token.scope
      : token.scope
        ? [token.scope]
        : [];

    for (const scope of scopes) {
      for (const [pattern, colorKey] of Object.entries(SCOPE_MAPPINGS)) {
        if (scope === pattern || scope.startsWith(pattern + '.')) {
          overrides[colorKey] = foreground;
          break;
        }
      }
    }
  }

  return overrides;
}

function parseThemeFile(
  themePath: string,
  defaults: TokenColors,
): TokenColors {
  try {
    const content = fs.readFileSync(themePath, 'utf8');
    const theme: ThemeJson = JSON5.parse(content);

    const parentColors = theme.include
      ? (() => {
          const parentPath = path.join(path.dirname(themePath), theme.include);
          return fs.existsSync(parentPath)
            ? parseThemeFile(parentPath, defaults)
            : defaults;
        })()
      : defaults;

    return { ...parentColors, ...extractTokenOverrides(theme) };
  } catch (error) {
    log.error('Failed to read theme file', themePath, error);
    return { ...defaults };
  }
}

export function getThemeTokenColors(): TokenColors {
  const themeName = vscode.workspace
    .getConfiguration('workbench')
    .get<string>('colorTheme');
  const themeKind = vscode.window.activeColorTheme.kind;
  const isLight =
    themeKind === vscode.ColorThemeKind.Light ||
    themeKind === vscode.ColorThemeKind.HighContrastLight;

  const colors: TokenColors = isLight
    ? { ...DEFAULT_LIGHT_COLORS }
    : { ...DEFAULT_DARK_COLORS };

  if (!themeName) {
    log.error('Failed to read theme name from workbench settings');
    return colors;
  }

  const themePath = findThemeFile(themeName);
  if (!themePath) {
    log.error('Failed to find theme file for theme', themeName);
    return colors;
  }

  return parseThemeFile(themePath, colors);
}
