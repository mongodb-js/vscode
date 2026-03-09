import React, { useEffect } from 'react';
import {
  VscodeButton,
  VscodeLabel,
  VscodeOption,
  VscodeProgressRing,
  VscodeSingleSelect,
} from '@vscode-elements/react-elements';
import { css, spacing } from '@mongodb-js/compass-components';
import {
  VSCODE_PANEL_BORDER,
  VSCODE_EDITOR_BACKGROUND,
  VSCODE_DESCRIPTION_FOREGROUND,
  VSCODE_ERROR_FOREGROUND,
  VSCODE_INPUT_VALIDATION_ERROR_BACKGROUND,
  VSCODE_INPUT_VALIDATION_ERROR_BORDER,
} from '../vscode-styles';
import { useAppSelector, useAppDispatch } from './store/hooks';
import {
  selectDocumentQuery,
  documentsRefreshRequested,
  initialDocumentsFetchRequested,
  previousPageRequested,
  nextPageRequested,
  itemsPerPageChanged,
  sortChanged,
  requestCancellationRequested,
  currentPageAdjusted,
  SORT_OPTIONS,
  isBasicQuery,
} from './store/documentQuerySlice';
import { setupMessageHandler } from './store/messageHandler';
import {
  sendGetThemeColors,
  sendInsertDocument,
  sendDeleteAllDocuments,
} from './vscode-api';
import MonacoViewer from './monaco-viewer';
import { BulkActionsSelect, type BulkAction } from './bulk-actions-select';

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

const BULK_ACTIONS: BulkAction[] = [
  {
    value: 'deleteAll',
    label: 'Delete All Documents',
    description: 'All documents present in this collection will be deleted.',
  },
];

const containerStyles = css({
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
});

const toolbarStyles = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `${spacing[200]}px ${spacing[300]}px`,
  borderBottom: `1px solid ${VSCODE_PANEL_BORDER}`,
  gap: spacing[300],
  flexWrap: 'wrap',
  position: 'sticky',
  top: 0,
  backgroundColor: VSCODE_EDITOR_BACKGROUND,
  zIndex: 10,
});

const toolbarGroupStyles = css({
  display: 'flex',
  alignItems: 'center',
  gap: spacing[200],
});

const toolbarGroupWideStyles = css({
  display: 'flex',
  alignItems: 'center',
  gap: spacing[300],
});

const paginationInfoStyles = css({
  fontSize: '13px',
  whiteSpace: 'nowrap',
  display: 'flex',
  gap: spacing[100],
  alignItems: 'center',
});

const paginationArrowsStyles = css({
  display: 'flex',
  alignItems: 'center',
  gap: spacing[200],
});

const fitContentSelectStyles = css({
  width: 'auto',
  minWidth: 'unset',
});

const sortSelectStyles = css({
  width: 'auto',
  minWidth: '140px',
});

const loadingOverlayStyles = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: spacing[1200],
  flexDirection: 'column',
  gap: spacing[300],
});

const contentStyles = css({
  padding: spacing[400],
  flex: 1,
});

const emptyStateStyles = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: spacing[1200],
  color: VSCODE_DESCRIPTION_FOREGROUND,
  gap: spacing[300],
});

const errorBannerStyles = css({
  display: 'flex',
  alignItems: 'center',
  gap: spacing[200],
  padding: `${spacing[200]}px ${spacing[300]}px`,
  backgroundColor: VSCODE_INPUT_VALIDATION_ERROR_BACKGROUND,
  borderLeft: `3px solid ${VSCODE_INPUT_VALIDATION_ERROR_BORDER}`,
  color: VSCODE_ERROR_FOREGROUND,
  fontSize: '13px',
  marginBottom: spacing[200],
});

const countErrorStyles = css({
  color: VSCODE_ERROR_FOREGROUND,
  fontSize: '13px',
  cursor: 'help',
});

const insertDocumentButtonStyles = css({
  '&::part(base)': {
    paddingLeft: spacing[200],
  },
});

const Pagination: React.FC<{
  startItem: number;
  endItem: number;
  totalCountForQuery: number | null;
  hasReceivedCount: boolean;
  getTotalCountError: string | null;
}> = ({
  startItem,
  endItem,
  totalCountForQuery,
  hasReceivedCount,
  getTotalCountError,
}) => {
  // If for some reason we couldn't determine the count, don't mention the total
  // at all. If the count is still loading or there's an error, then we'll
  // display a loading indicator or the error in place of the total.
  if (hasReceivedCount && !getTotalCountError && totalCountForQuery === null) {
    return (
      <span className={paginationInfoStyles}>
        {startItem}-{endItem}
      </span>
    );
  }

  return (
    <span className={paginationInfoStyles}>
      {startItem}-{endItem} of{' '}
      {!hasReceivedCount ? (
        <VscodeProgressRing
          style={{
            width: 14,
            height: 14,
            display: 'inline-block',
            verticalAlign: 'middle',
          }}
        />
      ) : getTotalCountError ? (
        <span className={countErrorStyles} title={getTotalCountError}>
          Error
        </span>
      ) : (
        totalCountForQuery
      )}
    </span>
  );
};

const PreviewApp: React.FC = () => {
  const dispatch = useAppDispatch();

  const documentQuery = useAppSelector(selectDocumentQuery);

  const isDocumentsView = isBasicQuery(documentQuery);
  const viewType = isDocumentsView ? 'documents' : 'cursor';

  const {
    displayedDocuments,
    currentPage,
    itemsPerPage,
    sort,
    isLoading,
    totalCountForQuery,
    hasReceivedCount,
    totalPages,
    startItem,
    endItem,
    themeColors,
    themeKind,
    errors: {
      getDocuments: getDocumentsError,
      getTotalCount: getTotalCountError,
    },
  } = documentQuery;

  useEffect(() => {
    dispatch(currentPageAdjusted());
  }, [dispatch, totalPages, currentPage]);

  useEffect(() => {
    const cleanup = setupMessageHandler(dispatch);
    sendGetThemeColors();
    dispatch(initialDocumentsFetchRequested());
    return cleanup;
  }, [dispatch]);

  const handleItemsPerPageChange = (event: Event): void => {
    const target = event.target as HTMLSelectElement;
    const newItemsPerPage = parseInt(target.value, 10);
    dispatch(itemsPerPageChanged(newItemsPerPage));
  };

  const handleBulkAction = (actionValue: string): void => {
    switch (actionValue) {
      case 'deleteAll':
        sendDeleteAllDocuments();
        break;
      default:
        break;
    }
  };

  const handleSortChange = (event: Event): void => {
    const target = event.target as HTMLSelectElement;
    const selectedOption = SORT_OPTIONS.find(
      (opt) => opt.value === target.value,
    );
    if (selectedOption) {
      dispatch(sortChanged(selectedOption));
    }
  };

  return (
    <div
      className={containerStyles}
      data-vscode-context='{"preventDefaultContextMenuItems": true}'
    >
      {/* Toolbar */}
      <div className={toolbarStyles}>
        {/* Left side - Insert Document */}
        <div className={toolbarGroupStyles}>
          {
            <VscodeButton
              className={insertDocumentButtonStyles}
              aria-label="Insert Document"
              title="Insert Document"
              onClick={(): void => {
                sendInsertDocument();
              }}
              disabled={isLoading}
              icon="add"
              secondary
            >
              Insert Document
            </VscodeButton>
          }
          {isDocumentsView && (
            <BulkActionsSelect
              actions={BULK_ACTIONS}
              onAction={handleBulkAction}
              disabled={isLoading}
            />
          )}
        </div>
        {/* Right side - Actions */}
        <div className={toolbarGroupWideStyles}>
          <VscodeButton
            aria-label="Refresh"
            title="Refresh"
            onClick={(): void => {
              dispatch(documentsRefreshRequested());
            }}
            disabled={isLoading}
            icon="refresh"
            secondary
          >
            Refresh
          </VscodeButton>

          {/* Sort */}
          {viewType === 'documents' && (
            <>
              <span>Sort</span>
              <VscodeSingleSelect
                className={sortSelectStyles}
                aria-label="Sort"
                value={sort?.value ?? 'default'}
                onChange={handleSortChange}
              >
                {SORT_OPTIONS.map((option) => (
                  <VscodeOption key={option.value} value={option.value}>
                    {option.label}
                  </VscodeOption>
                ))}
              </VscodeSingleSelect>
            </>
          )}

          {/* Items per page */}
          <VscodeSingleSelect
            className={fitContentSelectStyles}
            aria-label="Items per page"
            value={itemsPerPage.toString()}
            onChange={handleItemsPerPageChange}
          >
            {ITEMS_PER_PAGE_OPTIONS.map((option) => (
              <VscodeOption key={option} value={option.toString()}>
                {option}
              </VscodeOption>
            ))}
          </VscodeSingleSelect>

          {/* Pagination info */}
          <Pagination
            startItem={startItem}
            endItem={endItem}
            totalCountForQuery={totalCountForQuery}
            hasReceivedCount={hasReceivedCount}
            getTotalCountError={getTotalCountError}
          />

          {/* Page navigation arrows */}
          <div className={paginationArrowsStyles}>
            <VscodeButton
              aria-label="Previous page"
              title="Previous page"
              onClick={(): void => {
                dispatch(previousPageRequested());
              }}
              disabled={(totalPages !== null && currentPage <= 1) || isLoading}
              iconOnly
              icon="chevron-left"
              secondary
            />
            <VscodeButton
              aria-label="Next page"
              title="Next page"
              onClick={(): void => {
                dispatch(nextPageRequested());
              }}
              disabled={
                (totalPages !== null && currentPage >= totalPages) || isLoading
              }
              iconOnly
              icon="chevron-right"
              secondary
            />
          </div>
        </div>
      </div>

      {/* Documents content */}
      <div className={contentStyles}>
        {/* Error banner for getDocuments errors */}
        {getDocumentsError && (
          <div className={errorBannerStyles}>
            <span>Error fetching documents: {getDocumentsError}</span>
          </div>
        )}

        {isLoading ? (
          <div className={loadingOverlayStyles}>
            <VscodeProgressRing />
            <VscodeLabel>Running query</VscodeLabel>
            {/* Stop button - only shown when loading */}
            {isLoading && (
              <VscodeButton
                aria-label="Stop"
                title="Stop current request"
                onClick={(): void => {
                  dispatch(requestCancellationRequested());
                }}
                icon="stop-circle"
                secondary
              >
                Stop
              </VscodeButton>
            )}
          </div>
        ) : (
          <>
            {displayedDocuments.map((doc, index) => (
              <MonacoViewer
                key={`${currentPage}-${index}`}
                document={doc}
                themeColors={themeColors ?? undefined}
                themeKind={themeKind}
              />
            ))}
            {displayedDocuments.length === 0 && !getDocumentsError && (
              <div className={emptyStateStyles}>
                <span>No documents to display</span>
                <VscodeButton
                  aria-label="Insert Document"
                  title="Insert Document"
                  onClick={(): void => {
                    sendInsertDocument();
                  }}
                  secondary
                >
                  Insert Document
                </VscodeButton>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PreviewApp;
