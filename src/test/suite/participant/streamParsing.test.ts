import { beforeEach } from 'mocha';
import { expect } from 'chai';

import { processStreamWithInsertionsOnIdentifier } from '../../../participant/streamParsing';
import { asyncIterableFromArray } from './asyncIterableFromArray';

const defaultCodeBlockIdentifier = {
  start: '```',
  end: '```',
};

suite('processStreamWithInsertionsOnIdentifier', () => {
  let fragmentsProcessed: string[] = [];
  let identifiersStreamed: string[] = [];

  const processStreamFragment = (fragment: string): void => {
    fragmentsProcessed.push(fragment);
  };

  const onIdentifierStreamed = (content: string): void => {
    identifiersStreamed.push(content);
  };

  beforeEach(function () {
    fragmentsProcessed = [];
    identifiersStreamed = [];
  });

  test('empty', async () => {
    await processStreamWithInsertionsOnIdentifier({
      processStreamFragment,
      onIdentifierStreamed,
      inputIterable: asyncIterableFromArray<string>([]),
      identifier: defaultCodeBlockIdentifier,
    });

    expect(fragmentsProcessed).to.be.empty;
    expect(identifiersStreamed).to.be.empty;
  });

  test('input with no code block', async () => {
    const inputText = 'This is some sample text without code blocks.';
    const inputFragments = inputText.match(/.{1,5}/g) || [];
    const inputIterable = asyncIterableFromArray<string>(inputFragments);

    await processStreamWithInsertionsOnIdentifier({
      processStreamFragment,
      onIdentifierStreamed,
      inputIterable,
      identifier: defaultCodeBlockIdentifier,
    });

    expect(fragmentsProcessed.join('')).to.equal(inputText);
    expect(identifiersStreamed).to.be.empty;
  });

  test('one code block with fragment sizes 2', async () => {
    const inputText = '```javascript\npineapple\n```\nMore text.';
    const inputFragments: string[] = [];
    let index = 0;
    const fragmentSize = 2;
    while (index < inputText.length) {
      const fragment = inputText.substr(index, fragmentSize);
      inputFragments.push(fragment);
      index += fragmentSize;
    }

    const inputIterable = asyncIterableFromArray<string>(inputFragments);

    await processStreamWithInsertionsOnIdentifier({
      processStreamFragment,
      onIdentifierStreamed,
      inputIterable,
      identifier: {
        start: '```javascript',
        end: '```',
      },
    });

    expect(fragmentsProcessed.join('')).to.equal(inputText);
    expect(identifiersStreamed).to.have.lengthOf(1);
    expect(identifiersStreamed[0]).to.equal('\npineapple\n');
  });

  test('multiple code blocks', async () => {
    const inputText =
      'Text before code.\n```\ncode1\n```\nText between code.\n```\ncode2\n```\nText after code.';
    const inputFragments = inputText.split('');

    const inputIterable = asyncIterableFromArray<string>(inputFragments);

    await processStreamWithInsertionsOnIdentifier({
      processStreamFragment,
      onIdentifierStreamed,
      inputIterable,
      identifier: defaultCodeBlockIdentifier,
    });

    expect(fragmentsProcessed.join('')).to.equal(inputText);
    expect(identifiersStreamed).to.deep.equal(['\ncode1\n', '\ncode2\n']);
  });

  test('unfinished code block', async () => {
    const inputText =
      'Text before code.\n```\ncode content without end identifier.';
    const inputFragments = inputText.split('');

    const inputIterable = asyncIterableFromArray<string>(inputFragments);

    await processStreamWithInsertionsOnIdentifier({
      processStreamFragment,
      onIdentifierStreamed,
      inputIterable,
      identifier: defaultCodeBlockIdentifier,
    });

    expect(fragmentsProcessed.join('')).to.equal(inputText);
    expect(identifiersStreamed).to.be.empty;
  });

  test('code block identifier is a fragment', async () => {
    const inputFragments = [
      'Text before code.\n',
      '```js',
      '\ncode content\n',
      '```',
      '```js',
      '\npineapple\n',
      '```',
      '\nText after code.',
    ];

    const inputIterable = asyncIterableFromArray<string>(inputFragments);

    const identifier = { start: '```js', end: '```' };

    await processStreamWithInsertionsOnIdentifier({
      processStreamFragment,
      onIdentifierStreamed,
      inputIterable,
      identifier,
    });

    expect(fragmentsProcessed.join('')).to.deep.equal(inputFragments.join(''));

    expect(identifiersStreamed).to.deep.equal([
      '\ncode content\n',
      '\npineapple\n',
    ]);
  });

  test('code block identifier split between fragments', async () => {
    const inputFragments = [
      'Text before code.\n`',
      '``j',
      's\ncode content\n`',
      '``',
      '\nText after code.',
    ];

    const inputIterable = asyncIterableFromArray<string>(inputFragments);

    const identifier = { start: '```js', end: '```' };

    await processStreamWithInsertionsOnIdentifier({
      processStreamFragment,
      onIdentifierStreamed,
      inputIterable,
      identifier,
    });

    expect(fragmentsProcessed.join('')).to.deep.equal(inputFragments.join(''));

    expect(identifiersStreamed).to.deep.equal(['\ncode content\n']);
  });

  test('fragments containing multiple code blocks', async () => {
    const inputFragments = [
      'Text before code.\n```',
      'js\ncode1\n```',
      '\nText',
      ' between code.\n``',
      '`js\ncode2\n``',
      '`\nText after code.',
    ];

    const inputIterable = asyncIterableFromArray<string>(inputFragments);
    const identifier = { start: '```js', end: '```' };

    await processStreamWithInsertionsOnIdentifier({
      processStreamFragment,
      onIdentifierStreamed,
      inputIterable,
      identifier,
    });

    expect(fragmentsProcessed.join('')).to.deep.equal(inputFragments.join(''));
    expect(identifiersStreamed).to.deep.equal(['\ncode1\n', '\ncode2\n']);
  });

  test('one fragment containing multiple code blocks', async () => {
    const inputFragments = [
      'Text before code.\n```js\ncode1\n```\nText between code.\n```js\ncode2\n```\nText after code.',
    ];

    const inputIterable = asyncIterableFromArray<string>(inputFragments);
    const identifier = { start: '```js', end: '```' };

    await processStreamWithInsertionsOnIdentifier({
      processStreamFragment,
      onIdentifierStreamed,
      inputIterable,
      identifier,
    });

    expect(fragmentsProcessed.join('')).to.deep.equal(inputFragments.join(''));
    expect(identifiersStreamed).to.deep.equal(['\ncode1\n', '\ncode2\n']);
  });
});
