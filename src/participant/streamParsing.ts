function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * This function, provided a stream of text fragments, will stream the
 * content to the provided stream and call the onIdentifierStreamed function
 * when an identifier is streamed. This is useful for inserting code actions
 * into a chat response, whenever a code block has been written.
 */
export async function processStreamWithInsertionsOnIdentifier({
  processStreamFragment,
  onIdentifierStreamed,
  inputIterable,
  identifier,
}: {
  processStreamFragment: (fragment: string) => void;
  onIdentifierStreamed: (content: string) => void;
  inputIterable: AsyncIterable<string>;
  identifier: {
    start: string;
    end: string;
  };
}): Promise<void> {
  const escapedIdentifierStart = escapeRegex(identifier.start);
  const escapedIdentifierEnd = escapeRegex(identifier.end);
  const regex = new RegExp(
    `${escapedIdentifierStart}([\\s\\S]*?)${escapedIdentifierEnd}`,
    'g'
  );

  let contentSinceLastIdentifier = '';
  for await (const fragment of inputIterable) {
    contentSinceLastIdentifier += fragment;

    let lastIndex = 0;
    let match;
    while ((match = regex.exec(contentSinceLastIdentifier)) !== null) {
      const endIndex = regex.lastIndex;

      // Stream content up to the end of the identifier.
      const contentToStream = contentSinceLastIdentifier.slice(
        lastIndex,
        endIndex
      );
      processStreamFragment(contentToStream);

      const identifierContent = match[1];
      onIdentifierStreamed(identifierContent);

      lastIndex = endIndex;
    }

    if (lastIndex > 0) {
      // Remove all of the processed content.
      contentSinceLastIdentifier = contentSinceLastIdentifier.slice(lastIndex);
      // Reset the regex.
      regex.lastIndex = 0;
    } else {
      // Clear as much of the content as we can safely.
      const maxUnprocessedLength = identifier.start.length - 1;
      if (contentSinceLastIdentifier.length > maxUnprocessedLength) {
        const identifierIndex = contentSinceLastIdentifier.indexOf(
          identifier.start
        );
        if (identifierIndex > -1) {
          // We have an identifier, so clear up until the identifier.
          const contentToStream = contentSinceLastIdentifier.slice(
            0,
            identifierIndex
          );
          processStreamFragment(contentToStream);
          contentSinceLastIdentifier =
            contentSinceLastIdentifier.slice(identifierIndex);
        } else {
          // No identifier, so clear up until the last maxUnprocessedLength.
          const processUpTo =
            contentSinceLastIdentifier.length - maxUnprocessedLength;
          const contentToStream = contentSinceLastIdentifier.slice(
            0,
            processUpTo
          );
          processStreamFragment(contentToStream);
          contentSinceLastIdentifier =
            contentSinceLastIdentifier.slice(processUpTo);
        }
      }
    }
  }

  // Finish up anything not streamed yet.
  if (contentSinceLastIdentifier.length > 0) {
    processStreamFragment(contentSinceLastIdentifier);
  }
}
