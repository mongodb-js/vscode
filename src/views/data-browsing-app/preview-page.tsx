import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  VscodeButton,
  VscodeLabel,
  VscodeOption,
  VscodeProgressRing,
  VscodeSingleSelect,
} from '@vscode-elements/react-elements';
import { css, spacing } from '@mongodb-js/compass-components';
import type { MessageFromExtensionToWebview, JsonTokenColors } from './extension-app-message-constants';
import { PreviewMessageType } from './extension-app-message-constants';
import {
  sendGetDocuments,
  sendRefreshDocuments,
} from './vscode-api';
import DocumentTreeView from './document-tree-view';

interface PreviewDocument {
  [key: string]: unknown;
}

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
  borderBottom: '1px solid var(--vscode-panel-border, #444)',
  gap: spacing[300],
  flexWrap: 'wrap',
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
    // eslint-disable-next-line @typescript-eslint/naming-convention
  '--vscode-button-border': 'transparent',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '--vscode-button-secondaryBackground': 'transparent',
});

const refreshButtonStyles = css({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '--vscode-button-border': 'transparent',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '--vscode-button-secondaryBackground': 'transparent',
});

const fitContentSelectStyles = css({
  width: 'auto',
  minWidth: 'unset',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '--vscode-settings-dropdownBorder': 'transparent',
  '--vscode-single-select': {
    padding: '20px'
  },
});

const loadingOverlayStyles = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: spacing[600],
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
  const [documents, setDocuments] = useState<PreviewDocument[]>([]);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCountInCollection, setTotalCountInCollection] = useState<
    number | null
  >(null);
  const [themeColors, setThemeColors] = useState<JsonTokenColors | undefined>(undefined);

  const totalDocuments = documents.length;
  const totalPages = Math.max(1, Math.ceil(totalDocuments / itemsPerPage));

  // Ensure current page is valid
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  // Calculate displayed documents based on pagination
  const displayedDocuments = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return documents.slice(startIndex, endIndex);
  }, [documents, currentPage, itemsPerPage]);

  // Calculate pagination info
  const startItem =
    totalDocuments === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalDocuments);

  // Track when loading started for minimum loading duration
  const loadingStartTimeRef = useRef<number>(Date.now());
  const MIN_LOADING_DURATION_MS = 500;

  useEffect(() => {
    const handleMessage = (event: MessageEvent): void => {
      console.log("handling message")
      console.log(event.data)
      console.log("Expected THEME_CHANGED value:", PreviewMessageType.themeChanged)
      console.log("Received command:", event.data?.command)
      console.log("Match?", event.data?.command === PreviewMessageType.themeChanged)
      const message: MessageFromExtensionToWebview = event.data;
      if (message.command === PreviewMessageType.loadDocuments) {
        const elapsed = Date.now() - loadingStartTimeRef.current;
        const remainingTime = Math.max(0, MIN_LOADING_DURATION_MS - elapsed);

        // Ensure minimum loading duration before hiding loader
        setTimeout(() => {
          setDocuments(message.documents || []);
          if (message.totalCount !== undefined) {
            setTotalCountInCollection(message.totalCount);
          }
          setCurrentPage(1); // Reset to first page when new documents are loaded
          setIsLoading(false);
        }, remainingTime);
      } else if (message.command === PreviewMessageType.refreshError) {
        const elapsed = Date.now() - loadingStartTimeRef.current;
        const remainingTime = Math.max(0, MIN_LOADING_DURATION_MS - elapsed);

        // Ensure minimum loading duration before hiding loader
        setTimeout(() => {
          setIsLoading(false);
          // Could show an error message here if needed
        }, remainingTime);
      } else if (message.command === PreviewMessageType.themeChanged) {
        // Update theme colors when theme changes
        console.log('[DataBrowser] Received theme colors:', message.colors);
        setThemeColors(message.colors);
      }
    };
    console.log("HELLO WORLD")
    window.addEventListener('message', handleMessage);

    // Request initial documents
    sendGetDocuments();

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const handleRefresh = (): void => {
    loadingStartTimeRef.current = Date.now();
    setIsLoading(true);
    sendRefreshDocuments();
  };

  const handlePrevPage = (): void => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = (): void => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleItemsPerPageChange = (event: Event): void => {
    const target = event.target as HTMLSelectElement;
    const newItemsPerPage = parseInt(target.value, 10);
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  return (
    <div className={containerStyles}>
      {/* Toolbar */}
      <div className={toolbarStyles}>
        {/* Left side - Insert Document */}
        <div className={toolbarGroupStyles}>

        </div>

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
              disabled={currentPage <= 1}
              iconOnly
              icon="chevron-left"
              secondary
            />
            <VscodeButton
              aria-label="Next page"
              title="Next page"
              onClick={handleNextPage}
              disabled={currentPage >= totalPages}
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
            <VscodeLabel>Loading documents...</VscodeLabel>
          </div>
        ) : (
          <>
            {displayedDocuments.map((doc, index) => (
              <DocumentTreeView
                key={`${currentPage}-${index}`}
                document={doc}
                themeColors={themeColors}
              />
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
