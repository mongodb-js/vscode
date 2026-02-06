import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import JSON5 from 'json5';
import { createLogger } from '../logging';

const log = createLogger('theme color reader');

export interface TokenColors {
  key?: string;
  string?: string;
  number?: string;
  boolean?: string;
  null?: string;
  type?: string;
  comment?: string;
  punctuation?: string;
}

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

export interface ThemeJson {
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

/** @internal Exported for testing. */
export function extractTokenOverrides(theme: ThemeJson): Partial<TokenColors> {
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
        if (scope === pattern || pattern.startsWith(scope + '.')) {
          overrides[colorKey] = foreground;
          break;
        }
      }
    }
  }

  return overrides;
}

export const MAX_INCLUDE_DEPTH = 10;

/** @internal Exported for testing. */
export function parseThemeFile(
  themePath: string,
  defaults: TokenColors,
): TokenColors {
  return parseThemeFileRecursive(themePath, defaults, new Set(), 0);
}

function parseThemeFileRecursive(
  themePath: string,
  defaults: TokenColors,
  visited: Set<string>,
  depth: number,
): TokenColors {
  const normalizedPath = path.resolve(themePath);

  if (visited.has(normalizedPath)) {
    log.error('Circular include detected in theme files', normalizedPath);
    return { ...defaults };
  }

  if (depth >= MAX_INCLUDE_DEPTH) {
    log.error(
      'Maximum include depth exceeded when resolving theme',
      normalizedPath,
    );
    return { ...defaults };
  }

  visited.add(normalizedPath);

  try {
    const content = fs.readFileSync(themePath, 'utf8');
    const theme: ThemeJson = JSON5.parse(content);

    const parentColors = theme.include
      ? (() => {
          const parentPath = path.join(path.dirname(themePath), theme.include);
          if (!fs.existsSync(parentPath)) {
            log.error(
              'Included theme file not found',
              parentPath,
              'referenced from',
              themePath,
            );
            return defaults;
          }
          return parseThemeFileRecursive(
            parentPath,
            defaults,
            visited,
            depth + 1,
          );
        })()
      : defaults;

    return { ...parentColors, ...extractTokenOverrides(theme) };
  } catch (error) {
    log.error('Failed to read theme file', themePath, error);
    return { ...defaults };
  }
}

export type MonacoBaseTheme = 'vs' | 'vs-dark' | 'hc-black' | 'hc-light';

export function getMonacoBaseTheme(): MonacoBaseTheme {
  const kind = vscode.window.activeColorTheme.kind;
  switch (kind) {
    case vscode.ColorThemeKind.Light:
      return 'vs';
    case vscode.ColorThemeKind.HighContrastLight:
      return 'hc-light';
    case vscode.ColorThemeKind.HighContrast:
      return 'hc-black';
    case vscode.ColorThemeKind.Dark:
    default:
      return 'vs-dark';
  }
}

export function getThemeTokenColors(): TokenColors {
  const themeName = vscode.workspace
    .getConfiguration('workbench')
    .get<string>('colorTheme');
  const colors: TokenColors = {}

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
