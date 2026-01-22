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
} from '../vscode-styles';
import { useAppSelector } from './store/hooks';
import {
  selectDisplayedDocuments,
  selectCurrentPage,
  selectItemsPerPage,
  selectIsLoading,
  selectTotalCountInCollection,
  selectHasReceivedCount,
  selectTotalPages,
  selectStartItem,
  selectEndItem,
} from './store/documentQuerySlice';
import { setupMessageHandler } from './store/messageHandler';
import {
  refreshDocuments,
  fetchInitialDocuments,
  goToPreviousPage,
  goToNextPage,
  changeItemsPerPage,
  cancelRequest,
  adjustCurrentPage,
} from './store/actions';

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

const PreviewApp: React.FC = () => {
  const displayedDocuments = useAppSelector(selectDisplayedDocuments);
  const currentPage = useAppSelector(selectCurrentPage);
  const itemsPerPage = useAppSelector(selectItemsPerPage);
  const isLoading = useAppSelector(selectIsLoading);
  const totalCountInCollection = useAppSelector(selectTotalCountInCollection);
  const hasReceivedCount = useAppSelector(selectHasReceivedCount);
  const totalPages = useAppSelector(selectTotalPages);
  const startItem = useAppSelector(selectStartItem);
  const endItem = useAppSelector(selectEndItem);

  useEffect(() => {
    adjustCurrentPage();
  }, [totalPages, currentPage]);

  useEffect(() => {
    const cleanup = setupMessageHandler();
    fetchInitialDocuments();
    return cleanup;
  }, []);

  const handleItemsPerPageChange = (event: Event): void => {
    const target = event.target as HTMLSelectElement;
    const newItemsPerPage = parseInt(target.value, 10);
    changeItemsPerPage(newItemsPerPage);
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
            onClick={refreshDocuments}
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
              onClick={goToPreviousPage}
              disabled={currentPage <= 1 || isLoading}
              iconOnly
              icon="chevron-left"
              secondary
            />
            <VscodeButton
              aria-label="Next page"
              title="Next page"
              onClick={goToNextPage}
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
        {isLoading ? (
          <div className={loadingOverlayStyles}>
            <VscodeProgressRing />
            <VscodeLabel>Running query</VscodeLabel>
            {/* Stop button - only shown when loading */}
            {isLoading && (
              <VscodeButton
                aria-label="Stop"
                title="Stop current request"
                onClick={cancelRequest}
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
              <pre key={`${currentPage}-${index}`}>
                {JSON.stringify(doc, null, 2)}
              </pre>
            ))}
            {displayedDocuments.length === 0 && (
              <div className={emptyStateStyles}>No documents to display</div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PreviewApp;
