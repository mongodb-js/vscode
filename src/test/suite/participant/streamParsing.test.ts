import { beforeEach } from 'mocha';
import { expect } from 'chai';

import { processStreamWithIdentifiers } from '../../../participant/streamParsing';
import { asyncIterableFromArray } from './asyncIterableFromArray';

const defaultCodeBlockIdentifier = {
  start: '```',
  end: '```',
};

suite('processStreamWithIdentifiers', function () {
  let fragmentsProcessed: string[] = [];
  let identifiersStreamed: string[] = [];

  const processStreamFragment = (fragment: string): void => {
    fragmentsProcessed.push(fragment);
  };

  const onStreamIdentifier = (content: string): void => {
    identifiersStreamed.push(content);
  };

  beforeEach(function () {
    fragmentsProcessed = [];
    identifiersStreamed = [];
  });

  test('empty', async function () {
    await processStreamWithIdentifiers({
      processStreamFragment,
      onStreamIdentifier,
      inputIterable: asyncIterableFromArray<string>([]),
      identifier: defaultCodeBlockIdentifier,
    });

    expect(fragmentsProcessed).to.be.empty;
    expect(identifiersStreamed).to.be.empty;
  });

  test('input with no code block', async function () {
    const inputText = 'This is some sample text without code blocks.';
    const inputFragments = inputText.match(/.{1,5}/g) || [];
    const inputIterable = asyncIterableFromArray<string>(inputFragments);

    await processStreamWithIdentifiers({
      processStreamFragment,
      onStreamIdentifier,
      inputIterable,
      identifier: defaultCodeBlockIdentifier,
    });

    expect(fragmentsProcessed.join('')).to.equal(inputText);
    expect(identifiersStreamed).to.be.empty;
  });

  test('one code block with fragment sizes 2', async function () {
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

    await processStreamWithIdentifiers({
      processStreamFragment,
      onStreamIdentifier,
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

  test('multiple code blocks', async function () {
    const inputText =
      'Text before code.\n```\ncode1\n```\nText between code.\n```\ncode2\n```\nText after code.';
    const inputFragments = inputText.split('');

    const inputIterable = asyncIterableFromArray<string>(inputFragments);

    await processStreamWithIdentifiers({
      processStreamFragment,
      onStreamIdentifier,
      inputIterable,
      identifier: defaultCodeBlockIdentifier,
    });

    expect(fragmentsProcessed.join('')).to.equal(inputText);
    expect(identifiersStreamed).to.deep.equal(['\ncode1\n', '\ncode2\n']);
  });

  test('unfinished code block', async function () {
    const inputText =
      'Text before code.\n```\ncode content without end identifier.';
    const inputFragments = inputText.split('');

    const inputIterable = asyncIterableFromArray<string>(inputFragments);

    await processStreamWithIdentifiers({
      processStreamFragment,
      onStreamIdentifier,
      inputIterable,
      identifier: defaultCodeBlockIdentifier,
    });

    expect(fragmentsProcessed.join('')).to.equal(inputText);
    expect(identifiersStreamed).to.be.empty;
  });

  test('code block identifier is a fragment', async function () {
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

    await processStreamWithIdentifiers({
      processStreamFragment,
      onStreamIdentifier,
      inputIterable,
      identifier,
    });

    expect(fragmentsProcessed.join('')).to.deep.equal(inputFragments.join(''));

    expect(identifiersStreamed).to.deep.equal([
      '\ncode content\n',
      '\npineapple\n',
    ]);
  });

  test('code block identifier split between fragments', async function () {
    const inputFragments = [
      'Text before code.\n`',
      '``j',
      's\ncode content\n`',
      '``',
      '\nText after code.',
    ];

    const inputIterable = asyncIterableFromArray<string>(inputFragments);

    const identifier = { start: '```js', end: '```' };

    await processStreamWithIdentifiers({
      processStreamFragment,
      onStreamIdentifier,
      inputIterable,
      identifier,
    });

    expect(fragmentsProcessed.join('')).to.deep.equal(inputFragments.join(''));

    expect(identifiersStreamed).to.deep.equal(['\ncode content\n']);
  });

  test('fragments containing multiple code blocks', async function () {
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

    await processStreamWithIdentifiers({
      processStreamFragment,
      onStreamIdentifier,
      inputIterable,
      identifier,
    });

    expect(fragmentsProcessed.join('')).to.deep.equal(inputFragments.join(''));
    expect(identifiersStreamed).to.deep.equal(['\ncode1\n', '\ncode2\n']);
  });

  test('one fragment containing multiple code blocks', async function () {
    const inputFragments = [
      'Text before code.\n```js\ncode1\n```\nText between code.\n```js\ncode2\n```\nText after code.',
    ];

    const inputIterable = asyncIterableFromArray<string>(inputFragments);
    const identifier = { start: '```js', end: '```' };

    await processStreamWithIdentifiers({
      processStreamFragment,
      onStreamIdentifier,
      inputIterable,
      identifier,
    });

    expect(fragmentsProcessed.join('')).to.deep.equal(inputFragments.join(''));
    expect(identifiersStreamed).to.deep.equal(['\ncode1\n', '\ncode2\n']);
  });

  test('one fragment containing multiple code blocks emits event in correct order', async function () {
    // In case we have one fragment containing multiple code blocks, we want to make sure that
    // fragment notifications and identifier notifications arrive in the right order so that we're
    // adding code actions after the correct subfragment.
    // For example:
    // 'Text before code.\n```js\ncode1\n```\nText between code.\n```js\ncode2\n```\nText after code.'
    //
    // should emit:
    //
    // processStreamFragment: 'Text before code.\n```js\ncode1\n```'
    // onStreamIdentifier: '\ncode1\n'
    // processStreamFragment: '\nText between code.\n```js\ncode2\n```'
    // onStreamIdentifier: '\ncode2\n'
    // processStreamFragment: '\nText after code.'
    //
    // in that order to ensure we add each code action immediately after the code block
    // rather than add both at the end.

    const inputFragments = [
      'Text before code.\n```js\ncode1\n```\nText between code.\n```js\ncode2\n```\nText after code.',
    ];

    const inputIterable = asyncIterableFromArray<string>(inputFragments);
    const identifier = { start: '```js', end: '```' };

    const fragmentsEmitted: {
      source: 'processStreamFragment' | 'onStreamIdentifier';
      content: string;
    }[] = [];

    const getFragmentHandler = (
      source: 'processStreamFragment' | 'onStreamIdentifier',
    ): ((fragment: string) => void) => {
      return (fragment: string): void => {
        // It's an implementation detail, but the way the code is structured today, we're splitting the emitted fragments
        // whenever we find either a start or end identifier. This is irrelevant as long as we're emitting the entirety of
        // the text until the end of the code block in `processStreamFragment` and then the code block itself in `onStreamIdentifier`.
        // With the code below, we're combining all subfragments with the same source to make the test verify the desired
        // behavior rather than the actual implementation.
        const lastFragment = fragmentsEmitted[fragmentsEmitted.length - 1];
        if (lastFragment?.source === source) {
          lastFragment.content += fragment;
        } else {
          fragmentsEmitted.push({ source, content: fragment });
        }
      };
    };

    await processStreamWithIdentifiers({
      processStreamFragment: getFragmentHandler('processStreamFragment'),
      onStreamIdentifier: getFragmentHandler('onStreamIdentifier'),
      inputIterable,
      identifier,
    });

    expect(fragmentsEmitted).to.have.length(5);
    expect(fragmentsEmitted[0].source).to.equal('processStreamFragment');
    expect(fragmentsEmitted[0].content).to.equal(
      'Text before code.\n```js\ncode1\n```',
    );

    expect(fragmentsEmitted[1].source).to.equal('onStreamIdentifier');
    expect(fragmentsEmitted[1].content).to.equal('\ncode1\n');

    expect(fragmentsEmitted[2].source).to.equal('processStreamFragment');
    expect(fragmentsEmitted[2].content).to.equal(
      '\nText between code.\n```js\ncode2\n```',
    );

    expect(fragmentsEmitted[3].source).to.equal('onStreamIdentifier');
    expect(fragmentsEmitted[3].content).to.equal('\ncode2\n');

    expect(fragmentsEmitted[4].source).to.equal('processStreamFragment');
    expect(fragmentsEmitted[4].content).to.equal('\nText after code.');
  });
});
