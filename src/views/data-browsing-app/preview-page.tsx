import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  VscodeButton,
  VscodeLabel,
  VscodeOption,
  VscodeProgressRing,
  VscodeSingleSelect,
} from '@vscode-elements/react-elements';
import { css, spacing } from '@mongodb-js/compass-components';
import type { MessageFromExtensionToWebview } from './extension-app-message-constants';
import { PreviewMessageType } from './extension-app-message-constants';
import { sendGetDocuments, sendCancelRequest } from './vscode-api';
import {
  VSCODE_PANEL_BORDER,
  VSCODE_EDITOR_BACKGROUND,
  VSCODE_DESCRIPTION_FOREGROUND,
} from '../vscode-styles';

interface PreviewDocument {
  [key: string]: unknown;
}

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_ITEMS_PER_PAGE = 10;

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
  const [displayedDocuments, setDisplayedDocuments] = useState<
    PreviewDocument[]
  >([]);
  const [itemsPerPage, setItemsPerPage] = useState<number>(
    DEFAULT_ITEMS_PER_PAGE,
  );
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCountInCollection, setTotalCountInCollection] = useState<
    number | null
  >(null);
  const [hasReceivedCount, setHasReceivedCount] = useState(false);

  const isCountAvailable = totalCountInCollection !== null;
  const totalDocuments = isCountAvailable
    ? totalCountInCollection
    : displayedDocuments.length;
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(totalDocuments / itemsPerPage));
  }, [totalDocuments, itemsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const startItem =
    totalDocuments === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalDocuments);

  const fetchPageFromServer = useCallback(
    (page: number, limit: number): void => {
      const skip = (page - 1) * limit;
      setIsLoading(true);
      sendGetDocuments(skip, limit);
    },
    [],
  );

  useEffect(() => {
    const handleMessage = (event: MessageEvent): void => {
      const message: MessageFromExtensionToWebview = event.data;
      switch (message.command) {
        case PreviewMessageType.loadDocuments:
          setDisplayedDocuments((message.documents as PreviewDocument[]) || []);
          setCurrentPage(1);
          setIsLoading(false);
          break;
        case PreviewMessageType.loadPage:
          setDisplayedDocuments((message.documents as PreviewDocument[]) || []);
          setIsLoading(false);
          break;
        case PreviewMessageType.refreshError:
          setIsLoading(false);
          // Could show an error message here if needed
          break;
        case PreviewMessageType.requestCancelled:
          setIsLoading(false);
          break;
        case PreviewMessageType.updateTotalCount:
          setTotalCountInCollection(message.totalCount);
          setHasReceivedCount(true);
          break;
        case PreviewMessageType.updateTotalCountError:
          // Count fetch failed - mark as received with null value
          setHasReceivedCount(true);
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    sendGetDocuments(0, itemsPerPage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const handleRefresh = (): void => {
    setIsLoading(true);
    setCurrentPage(1);
    sendGetDocuments(0, itemsPerPage);
  };

  const handleStop = (): void => {
    setIsLoading(false);
    sendCancelRequest();
  };

  const handlePrevPage = (): void => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      fetchPageFromServer(newPage, itemsPerPage);
    }
  };

  const handleNextPage = (): void => {
    if (currentPage < totalPages) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      fetchPageFromServer(newPage, itemsPerPage);
    }
  };

  const handleItemsPerPageChange = (event: Event): void => {
    const target = event.target as HTMLSelectElement;
    const newItemsPerPage = parseInt(target.value, 10);
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
    fetchPageFromServer(1, newItemsPerPage);
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
            onClick={handleRefresh}
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
              onClick={handlePrevPage}
              disabled={currentPage <= 1 || isLoading}
              iconOnly
              icon="chevron-left"
              secondary
            />
            <VscodeButton
              aria-label="Next page"
              title="Next page"
              onClick={handleNextPage}
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
                onClick={handleStop}
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
