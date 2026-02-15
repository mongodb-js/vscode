import React, { useCallback, useEffect } from 'react';
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
} from './store/documentQuerySlice';
import { setupMessageHandler } from './store/messageHandler';
import {
  sendGetThemeColors,
  sendInsertDocument,
  sendDeleteAllDocuments,
} from './vscode-api';
import MonacoViewer from './monaco-viewer';

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

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
  gap: spacing[200],
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
  textAlign: 'center',
  padding: spacing[500],
  color: VSCODE_DESCRIPTION_FOREGROUND,
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

const bulkActionsSelectStyles = css({
  width: 'fit-content',
  minWidth: 'unset',
});

const PreviewApp: React.FC = () => {
  const dispatch = useAppDispatch();

  const {
    displayedDocuments,
    currentPage,
    itemsPerPage,
    sort,
    isLoading,
    totalCountInCollection,
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
  } = useAppSelector(selectDocumentQuery);

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

  // Ref to inject shadow DOM styles that customize the bulk actions dropdown
  const bulkActionsSelectRef = useCallback((node: HTMLElement | null) => {
    if (!node) {
      return;
    }
    const sr = node.shadowRoot;
    if (sr && !sr.querySelector('#bulk-actions-custom-styles')) {
      const style = document.createElement('style');
      style.id = 'bulk-actions-custom-styles';
      style.textContent = [
        // Make the select face subtle (transparent bg) so it doesn't match the button
        '.select-face { background-color: transparent !important; }',
        '.select-face:hover { background-color: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31)) !important; }',
        // Hide the placeholder "Bulk Actions" option from the dropdown list
        '.options li.option:first-child { display: none; }',
        // Widen the dropdown to fit description text
        '.dropdown { min-width: 320px !important; }',
        // Hide the default hover-only description area
        '.description { display: none !important; }',
        // Let the scrollable container size to its content instead of a fixed height
        '.scrollable { height: auto !important; max-height: 220px !important; }',
        // Make the action option tall enough to show the subtitle
        '.options li.option[data-index="1"] {',
        '  height: auto !important;',
        '  white-space: normal !important;',
        '  overflow: visible !important;',
        '  padding: 4px 8px !important;',
        '  line-height: 20px !important;',
        '}',
        // Override active state to only show on hover (prevent persistent highlight)
        '.option.active { background-color: transparent !important; color: var(--vscode-foreground, #cccccc) !important; outline: none !important; }',
        '.option.active:hover { background-color: var(--vscode-list-hoverBackground, #2a2d2e) !important; color: var(--vscode-list-hoverForeground, #ffffff) !important; }',
        // Add description as an always-visible subtitle via ::after
        '.options li.option[data-index="1"]::after {',
        '  content: "All documents present in this collection will be deleted.";',
        '  display: block;',
        '  font-size: 12px;',
        '  opacity: 0.7;',
        '  white-space: normal;',
        '  line-height: 1.4;',
        '  margin-top: 2px;',
        '}',
      ].join('\n');
      sr.appendChild(style);
    }
  }, []);

  const handleBulkActionChange = (event: Event): void => {
    const target = event.target as HTMLSelectElement;
    const value = target.value;
    if (value === 'deleteAll') {
      sendDeleteAllDocuments();
    }
    // Reset back to the placeholder so the select always shows "Bulk Actions"
    target.value = '__placeholder__';
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
    <div className={containerStyles}>
      {/* Toolbar */}
      <div className={toolbarStyles}>
        {/* Left side - Insert Document */}
        <div className={toolbarGroupStyles}>
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
          <VscodeSingleSelect
            className={bulkActionsSelectStyles}
            aria-label="Bulk Actions"
            value="__placeholder__"
            onChange={handleBulkActionChange}
            disabled={isLoading}
            ref={bulkActionsSelectRef}
          >
            <VscodeOption value="__placeholder__">Bulk Actions</VscodeOption>
            <VscodeOption value="deleteAll">Delete All Documents</VscodeOption>
          </VscodeSingleSelect>
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
            ) : totalCountInCollection === null ? (
              <span title="We don't run a count for time series and views">
                N/A
              </span>
            ) : (
              totalCountInCollection
            )}
          </span>

          {/* Page navigation arrows */}
          <div className={paginationArrowsStyles}>
            <VscodeButton
              aria-label="Previous page"
              title="Previous page"
              onClick={(): void => {
                dispatch(previousPageRequested());
              }}
              disabled={currentPage <= 1 || isLoading}
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
              disabled={currentPage >= totalPages || isLoading}
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
              <div className={emptyStateStyles}>No documents to display</div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PreviewApp;
