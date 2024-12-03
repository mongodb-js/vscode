import { createTemplate } from './templateHelpers';

export const playgroundFromDatabaseTreeItemTemplate = createTemplate(
  (currentDatabase) => `// MongoDB Playground
// Use Ctrl+Space inside a snippet or a string literal to trigger completions.

// The current database to use.
use(${currentDatabase});

`
);
