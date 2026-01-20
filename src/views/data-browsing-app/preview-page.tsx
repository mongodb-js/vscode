import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from 'react';
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
import {
  sendGetDocuments,
  sendRefreshDocuments,
  sendFetchPage,
  sendCancelRequest,
} from './vscode-api';

interface PreviewDocument {
  [key: string]: unknown;
}

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];
const MIN_LOADING_DURATION_MS = 500;

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
  borderBottom: '1px solid var(--vscode-panel-border, #444)',
  gap: spacing[300],
  flexWrap: 'wrap',
  position: 'sticky',
  top: 0,
  backgroundColor: 'var(--vscode-editor-background, #1e1e1e)',
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
});

const paginationArrowsStyles = css({
  display: 'flex',
  alignItems: 'center',
  '--vscode-button-border': 'transparent',
  '--vscode-button-secondaryBackground': 'transparent',
});

const refreshButtonStyles = css({
  '--vscode-button-border': 'transparent',
  '--vscode-button-secondaryBackground': 'transparent',
});

const fitContentSelectStyles = css({
  width: 'auto',
  minWidth: 'unset',
  '--vscode-settings-dropdownBorder': 'transparent',
  '--vscode-single-select': {
    padding: '20px',
  },
});

const stopButtonStyles = css({
  '--vscode-button-border': 'transparent',
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
  color: 'var(--vscode-descriptionForeground)',
});

const PreviewApp: React.FC = () => {
  // Current page's documents (fetched from server)
  const [displayedDocuments, setDisplayedDocuments] = useState<
    PreviewDocument[]
  >([]);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCountInCollection, setTotalCountInCollection] = useState<
    number | null
  >(null);

  const totalDocuments = totalCountInCollection ?? displayedDocuments.length;
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(totalDocuments / itemsPerPage));
  }, [totalDocuments, itemsPerPage]);

  // Ensure current page is valid
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  // Calculate pagination info
  const startItem =
    totalDocuments === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalDocuments);

  // Track when loading started for minimum loading duration
  const loadingStartTimeRef = useRef<number>(Date.now());
  // Track pending timeout IDs so we can clear them on cancellation
  const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper to clear any pending loading timeout
  const clearPendingTimeout = useCallback((): void => {
    if (pendingTimeoutRef.current !== null) {
      clearTimeout(pendingTimeoutRef.current);
      pendingTimeoutRef.current = null;
    }
  }, []);

  // Helper to fetch a specific page from the server
  const fetchPageFromServer = useCallback(
    (page: number, limit: number): void => {
      const skip = (page - 1) * limit;
      clearPendingTimeout();
      loadingStartTimeRef.current = Date.now();
      setIsLoading(true);
      sendFetchPage(skip, limit);
    },
    [clearPendingTimeout],
  );

  useEffect(() => {
    const handleMessage = (event: MessageEvent): void => {
      const message: MessageFromExtensionToWebview = event.data;
      if (message.command === PreviewMessageType.loadDocuments) {
        const elapsed = Date.now() - loadingStartTimeRef.current;
        const remainingTime = Math.max(0, MIN_LOADING_DURATION_MS - elapsed);

        // Clear any existing timeout before setting a new one
        clearPendingTimeout();

        // Ensure minimum loading duration before hiding loader
        pendingTimeoutRef.current = setTimeout(() => {
          pendingTimeoutRef.current = null;
          setDisplayedDocuments((message.documents as PreviewDocument[]) || []);
          if (message.totalCount !== undefined) {
            setTotalCountInCollection(message.totalCount);
          }
          setCurrentPage(1); // Reset to first page when new documents are loaded
          setIsLoading(false);
        }, remainingTime);
      } else if (message.command === PreviewMessageType.loadPage) {
        const elapsed = Date.now() - loadingStartTimeRef.current;
        const remainingTime = Math.max(0, MIN_LOADING_DURATION_MS - elapsed);

        // Clear any existing timeout before setting a new one
        clearPendingTimeout();

        // Ensure minimum loading duration before hiding loader
        pendingTimeoutRef.current = setTimeout(() => {
          pendingTimeoutRef.current = null;
          setDisplayedDocuments((message.documents as PreviewDocument[]) || []);
          setIsLoading(false);
        }, remainingTime);
      } else if (message.command === PreviewMessageType.refreshError) {
        const elapsed = Date.now() - loadingStartTimeRef.current;
        const remainingTime = Math.max(0, MIN_LOADING_DURATION_MS - elapsed);

        // Clear any existing timeout before setting a new one
        clearPendingTimeout();

        // Ensure minimum loading duration before hiding loader
        pendingTimeoutRef.current = setTimeout(() => {
          pendingTimeoutRef.current = null;
          setIsLoading(false);
          // Could show an error message here if needed
        }, remainingTime);
      } else if (message.command === PreviewMessageType.requestCancelled) {
        // Request was cancelled - clear any pending timeouts and reset loading state immediately
        clearPendingTimeout();
        setIsLoading(false);
      }
    };
    console.log('HELLO WORLD');
    window.addEventListener('message', handleMessage);

    // Request initial documents
    sendGetDocuments();

    return () => {
      window.removeEventListener('message', handleMessage);
      // Clear any pending timeout on unmount
      clearPendingTimeout();
    };
  }, [clearPendingTimeout]);

  const handleRefresh = (): void => {
    clearPendingTimeout();
    loadingStartTimeRef.current = Date.now();
    setIsLoading(true);
    setCurrentPage(1); // Reset to first page when refreshing
    sendRefreshDocuments();
  };

  const handleStop = (): void => {
    // Clear any pending timeouts immediately for instant UI feedback
    clearPendingTimeout();
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
    setCurrentPage(1); // Reset to first page when changing items per page
    // Fetch the first page with the new items per page
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
          {/* Refresh */}
          <VscodeButton
            className={refreshButtonStyles}
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
            {startItem}-{endItem} of {totalCountInCollection ?? totalDocuments}
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
                className={stopButtonStyles}
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
