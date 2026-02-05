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
  requestCancellationRequested,
  currentPageAdjusted,
} from './store/documentQuerySlice';
import { setupMessageHandler } from './store/messageHandler';
import { sendGetThemeColors } from './vscode-api';
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

const PreviewApp: React.FC = () => {
  const dispatch = useAppDispatch();

  const {
    displayedDocuments,
    currentPage,
    itemsPerPage,
    isLoading,
    totalCountInCollection,
    hasReceivedCount,
    totalPages,
    startItem,
    endItem,
    themeColors,
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

  return (
    <div className={containerStyles}>
      {/* Toolbar */}
      <div className={toolbarStyles}>
        {/* Left side - Insert Document */}
        <div className={toolbarGroupStyles}></div>
        {/* Right side - Actions */}
        <div className={toolbarGroupWideStyles}>
          <VscodeButton
            aria-label="Refresh"
            title="Refresh"
            onClick={() => dispatch(documentsRefreshRequested())}
            disabled={isLoading}
            icon="refresh"
            secondary
          >
            Refresh
          </VscodeButton>

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
              onClick={() => dispatch(previousPageRequested())}
              disabled={currentPage <= 1 || isLoading}
              iconOnly
              icon="chevron-left"
              secondary
            />
            <VscodeButton
              aria-label="Next page"
              title="Next page"
              onClick={() => dispatch(nextPageRequested())}
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
                onClick={() => dispatch(requestCancellationRequested())}
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
