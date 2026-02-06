import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import {
  extractTokenOverrides,
  parseThemeFile,
  MAX_INCLUDE_DEPTH,
  type ThemeJson,
  type TokenColors,
} from '../../../utils/themeColorReader';

/** Helper: create a temp directory for theme file tests. */
function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'theme-test-'));
}

/** Helper: write a theme JSON file and return its path. */
function writeThemeFile(dir: string, name: string, theme: ThemeJson): string {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, JSON.stringify(theme), 'utf8');
  return filePath;
}

suite('themeColorReader', function () {
  suite('extractTokenOverrides', function () {
    test('should extract exact scope match', function () {
      const theme: ThemeJson = {
        tokenColors: [
          { scope: 'comment', settings: { foreground: '#6A9955' } },
        ],
      };
      const result = extractTokenOverrides(theme);
      expect(result.comment).to.equal('#6A9955');
    });

    test('should match parent scope to child pattern', function () {
      // Theme scope "string" should match pattern "string.quoted"
      const theme: ThemeJson = {
        tokenColors: [{ scope: 'string', settings: { foreground: '#CE9178' } }],
      };
      const result = extractTokenOverrides(theme);
      expect(result.string).to.equal('#CE9178');
    });

    test('should NOT match child scope to parent pattern (string.regexp bug)', function () {
      // Theme scope "string.regexp" should NOT overwrite the "string" color
      const theme: ThemeJson = {
        tokenColors: [
          { scope: 'string', settings: { foreground: '#CE9178' } },
          { scope: 'string.regexp', settings: { foreground: '#D16969' } },
        ],
      };
      const result = extractTokenOverrides(theme);
      expect(result.string).to.equal('#CE9178');
    });

    test('should handle scope as an array', function () {
      const theme: ThemeJson = {
        tokenColors: [
          {
            scope: ['comment', 'punctuation'],
            settings: { foreground: '#888888' },
          },
        ],
      };
      const result = extractTokenOverrides(theme);
      expect(result.comment).to.equal('#888888');
      expect(result.punctuation).to.equal('#888888');
    });

    test('should skip tokens without foreground', function () {
      const theme: ThemeJson = {
        tokenColors: [
          { scope: 'comment', settings: {} },
          { scope: 'string', settings: { foreground: '#CE9178' } },
        ],
      };
      const result = extractTokenOverrides(theme);
      expect(result.comment).to.be.undefined;
      expect(result.string).to.equal('#CE9178');
    });

    test('should return empty object for empty tokenColors', function () {
      const result = extractTokenOverrides({ tokenColors: [] });
      expect(result).to.deep.equal({});
    });

    test('should return empty object when tokenColors is undefined', function () {
      const result = extractTokenOverrides({});
      expect(result).to.deep.equal({});
    });

    test('should handle token with no scope', function () {
      const theme: ThemeJson = {
        tokenColors: [{ settings: { foreground: '#ffffff' } }],
      };
      const result = extractTokenOverrides(theme);
      expect(result).to.deep.equal({});
    });

    test('should let later exact match overwrite earlier one', function () {
      const theme: ThemeJson = {
        tokenColors: [
          { scope: 'comment', settings: { foreground: '#111111' } },
          { scope: 'comment', settings: { foreground: '#222222' } },
        ],
      };
      const result = extractTokenOverrides(theme);
      expect(result.comment).to.equal('#222222');
    });

    test('should extract all supported token color types', function () {
      const theme: ThemeJson = {
        tokenColors: [
          {
            scope: 'support.type.property-name',
            settings: { foreground: '#9CDCFE' },
          },
          { scope: 'string', settings: { foreground: '#CE9178' } },
          { scope: 'constant.numeric', settings: { foreground: '#B5CEA8' } },
          {
            scope: 'constant.language.boolean',
            settings: { foreground: '#569CD6' },
          },
          {
            scope: 'constant.language.null',
            settings: { foreground: '#569CD6' },
          },
          { scope: 'entity.name.type', settings: { foreground: '#4EC9B0' } },
          { scope: 'comment', settings: { foreground: '#6A9955' } },
          { scope: 'punctuation', settings: { foreground: '#D4D4D4' } },
        ],
      };
      const result = extractTokenOverrides(theme);
      expect(result.key).to.equal('#9CDCFE');
      expect(result.string).to.equal('#CE9178');
      expect(result.number).to.equal('#B5CEA8');
      expect(result.boolean).to.equal('#569CD6');
      expect(result.null).to.equal('#569CD6');
      expect(result.type).to.equal('#4EC9B0');
      expect(result.comment).to.equal('#6A9955');
      expect(result.punctuation).to.equal('#D4D4D4');
    });

    test('should match parent scope "constant.language" to first matching pattern', function () {
      const theme: ThemeJson = {
        tokenColors: [
          { scope: 'constant.language', settings: { foreground: '#569CD6' } },
        ],
      };
      const result = extractTokenOverrides(theme);
      // "constant.language" matches the first matching SCOPE_MAPPINGS entry
      // (constant.language.boolean) and then breaks — only boolean is set.
      expect(result.boolean).to.equal('#569CD6');
    });
  });

  suite('parseThemeFile', function () {
    let tempDir: string;

    setup(function () {
      tempDir = createTempDir();
    });

    teardown(function () {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('should parse a simple theme file', function () {
      const themePath = writeThemeFile(tempDir, 'theme.json', {
        tokenColors: [
          { scope: 'comment', settings: { foreground: '#6A9955' } },
          { scope: 'string', settings: { foreground: '#CE9178' } },
        ],
      });
      const result = parseThemeFile(themePath, {});
      expect(result.comment).to.equal('#6A9955');
      expect(result.string).to.equal('#CE9178');
    });

    test('should resolve include chain (child inherits parent)', function () {
      writeThemeFile(tempDir, 'parent.json', {
        tokenColors: [
          { scope: 'comment', settings: { foreground: '#AAAAAA' } },
          { scope: 'string', settings: { foreground: '#BBBBBB' } },
        ],
      });
      const childPath = writeThemeFile(tempDir, 'child.json', {
        include: './parent.json',
        tokenColors: [
          { scope: 'comment', settings: { foreground: '#CCCCCC' } },
        ],
      });
      const result = parseThemeFile(childPath, {});
      // Child overrides comment
      expect(result.comment).to.equal('#CCCCCC');
      // String inherited from parent
      expect(result.string).to.equal('#BBBBBB');
    });

    test('should resolve multi-level include chain', function () {
      writeThemeFile(tempDir, 'grandparent.json', {
        tokenColors: [
          { scope: 'comment', settings: { foreground: '#111111' } },
          { scope: 'string', settings: { foreground: '#222222' } },
          { scope: 'constant.numeric', settings: { foreground: '#333333' } },
        ],
      });
      writeThemeFile(tempDir, 'parent.json', {
        include: './grandparent.json',
        tokenColors: [{ scope: 'string', settings: { foreground: '#444444' } }],
      });
      const childPath = writeThemeFile(tempDir, 'child.json', {
        include: './parent.json',
        tokenColors: [
          { scope: 'comment', settings: { foreground: '#555555' } },
        ],
      });
      const result = parseThemeFile(childPath, {});
      expect(result.comment).to.equal('#555555'); // child
      expect(result.string).to.equal('#444444'); // parent
      expect(result.number).to.equal('#333333'); // grandparent
    });

    test('should handle circular includes without crashing', function () {
      writeThemeFile(tempDir, 'a.json', {
        include: './b.json',
        tokenColors: [
          { scope: 'comment', settings: { foreground: '#AAAAAA' } },
        ],
      });
      writeThemeFile(tempDir, 'b.json', {
        include: './a.json',
        tokenColors: [{ scope: 'string', settings: { foreground: '#BBBBBB' } }],
      });
      const aPath = path.join(tempDir, 'a.json');
      // Should not throw or hang
      const result = parseThemeFile(aPath, {});
      expect(result.comment).to.equal('#AAAAAA');
    });

    test('should handle self-referencing include without crashing', function () {
      const themePath = writeThemeFile(tempDir, 'self.json', {
        include: './self.json',
        tokenColors: [
          { scope: 'comment', settings: { foreground: '#AAAAAA' } },
        ],
      });
      const result = parseThemeFile(themePath, {});
      expect(result.comment).to.equal('#AAAAAA');
    });

    test('should handle missing include file gracefully', function () {
      const themePath = writeThemeFile(tempDir, 'theme.json', {
        include: './nonexistent.json',
        tokenColors: [
          { scope: 'comment', settings: { foreground: '#AAAAAA' } },
        ],
      });
      const result = parseThemeFile(themePath, {});
      expect(result.comment).to.equal('#AAAAAA');
    });

    test('should stop at MAX_INCLUDE_DEPTH', function () {
      // Create a chain deeper than MAX_INCLUDE_DEPTH
      const depth = MAX_INCLUDE_DEPTH + 2;
      for (let i = 0; i < depth; i++) {
        const include = i < depth - 1 ? `./${i + 1}.json` : undefined;
        writeThemeFile(tempDir, `${i}.json`, {
          ...(include ? { include } : {}),
          tokenColors: [
            {
              scope: 'comment',
              settings: { foreground: `#${String(i).padStart(6, '0')}` },
            },
          ],
        });
      }
      const rootPath = path.join(tempDir, '0.json');
      // Should not throw — just stops resolving at max depth
      const result = parseThemeFile(rootPath, {});
      expect(result).to.be.an('object');
    });

    test('should use defaults when theme file is invalid JSON', function () {
      const filePath = path.join(tempDir, 'bad.json');
      fs.writeFileSync(filePath, 'not valid json!!!', 'utf8');
      const defaults: TokenColors = { comment: '#FALLBACK' };
      const result = parseThemeFile(filePath, defaults);
      expect(result.comment).to.equal('#FALLBACK');
    });

    test('should use defaults when theme file does not exist', function () {
      const fakePath = path.join(tempDir, 'does-not-exist.json');
      const defaults: TokenColors = { string: '#DEFAULT' };
      const result = parseThemeFile(fakePath, defaults);
      expect(result.string).to.equal('#DEFAULT');
    });

    test('should merge defaults with extracted colors', function () {
      const themePath = writeThemeFile(tempDir, 'theme.json', {
        tokenColors: [
          { scope: 'comment', settings: { foreground: '#AAAAAA' } },
        ],
      });
      const defaults: TokenColors = { string: '#DEFAULT_STRING' };
      const result = parseThemeFile(themePath, defaults);
      expect(result.comment).to.equal('#AAAAAA');
      expect(result.string).to.equal('#DEFAULT_STRING');
    });
  });
});
