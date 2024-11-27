import template from './playgroundCloneDocumentTemplate';

export function playgroundWithNamespaceTemplate(
  databaseName?: string,
  collectionName?: string
): string {
  let adjustedTemplate = template;
  if (databaseName) {
    adjustedTemplate = adjustedTemplate.replaceAll(
      'CURRENT_DATABASE',
      databaseName
    );
  }
  if (collectionName) {
    adjustedTemplate = adjustedTemplate.replaceAll(
      'CURRENT_COLLECTION',
      collectionName
    );
  }
  return adjustedTemplate;
}
