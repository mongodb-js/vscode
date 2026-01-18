import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  VscodeButton,
  VscodeIcon,
  VscodeLabel,
  VscodeOption,
  VscodeProgressRing,
  VscodeSingleSelect,
  VscodeToolbarButton,
  VscodeCollapsible,
} from '@vscode-elements/react-elements';
import type { MessageFromExtensionToWebview } from './extension-app-message-constants';
import { PreviewMessageType, type SortOption } from './extension-app-message-constants';
import {
  sendGetDocuments,
  sendRefreshDocuments,
  sendSortDocuments,
} from './vscode-api';

interface PreviewDocument {
  [key: string]: unknown;
}
type ViewType = 'tree' | 'json' | 'table';

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderBottom: '1px solid var(--vscode-panel-border, #444)',
    gap: '12px',
    flexWrap: 'wrap' as const,
  },
  toolbarGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  toolbarGroupWide: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  paginationInfo: {
    fontSize: '13px',
    whiteSpace: 'nowrap' as const,
  },
  paginationArrows: {
    display: 'flex',
    alignItems: 'center',
  },
  loadingOverlay: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  content: {
    padding: '16px',
    flex: 1,
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '32px',
    color: 'var(--vscode-descriptionForeground)',
  },
  documentCard: {
    marginBottom: '8px',
    backgroundColor: 'var(--vscode-editor-background)',
    border: '1px solid var(--vscode-panel-border)',
    borderRadius: '4px',
  },
};

const PreviewApp: React.FC = () => {
  const [documents, setDocuments] = useState<PreviewDocument[]>([]);
  const [sortOption, setSortOption] = useState<SortOption>('default');
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [viewType, setViewType] = useState<ViewType>('tree');
  const [isLoading, setIsLoading] = useState(true);
  const [totalCountInCollection, setTotalCountInCollection] = useState<
    number | null
  >(null);

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
      }
    };

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

  const handleSortChange = (event: Event): void => {
    const target = event.target as HTMLSelectElement;
    const newSortOption = target.value as SortOption;
    setSortOption(newSortOption);
    loadingStartTimeRef.current = Date.now();
    setIsLoading(true);
    sendSortDocuments(newSortOption);
  };

  const handleItemsPerPageChange = (event: Event): void => {
    const target = event.target as HTMLSelectElement;
    const newItemsPerPage = parseInt(target.value, 10);
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  const handleViewTypeChange = (event: Event): void => {
    const target = event.target as HTMLSelectElement;
    setViewType(target.value as ViewType);
    // TODO: Implement different view renderings
  };

  const renderDocumentContent = (doc: PreviewDocument): React.ReactNode => {
    return (
      <pre
        style={{
          margin: 0,
          padding: '8px 12px',
          fontSize: '12px',
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {JSON.stringify(doc, null, 2)}
      </pre>
    );
  };

  return (
    <div style={styles.container}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        {/* Left side - Insert Document */}
        <div style={styles.toolbarGroup}>
          <VscodeToolbarButton
            aria-label="Insert Document"
            title="Insert Document"
            onClick={(): void => {
              // TODO: Implement insert document functionality
            }}
          >
            <VscodeIcon name="add" />
          </VscodeToolbarButton>
          <VscodeLabel>Insert Document</VscodeLabel>
        </div>

        {/* Right side - Actions */}
        <div style={styles.toolbarGroupWide}>
          {/* Refresh */}
          <VscodeButton
            aria-label="Refresh"
            title="Refresh"
            onClick={handleRefresh}
            disabled={isLoading}
            iconOnly
            icon="refresh"
            secondary
          />

          {/* Sort */}
          <div style={styles.toolbarGroup}>
            <VscodeLabel>Sort</VscodeLabel>
            <VscodeSingleSelect
              aria-label="Sort order"
              value={sortOption}
              onChange={handleSortChange}
            >
              <VscodeOption value="default">Default</VscodeOption>
              <VscodeOption value="asc">Ascending</VscodeOption>
              <VscodeOption value="desc">Descending</VscodeOption>
            </VscodeSingleSelect>
          </div>

          {/* Items per page */}
          <VscodeSingleSelect
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
          <span style={styles.paginationInfo}>
            {startItem}-{endItem} of {totalCountInCollection ?? totalDocuments}
          </span>

          {/* Page navigation arrows */}
          <div style={styles.paginationArrows}>
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

          {/* View type */}
          <VscodeSingleSelect
            aria-label="View type"
            value={viewType}
            onChange={handleViewTypeChange}
          >
            <VscodeOption value="tree">Tree view</VscodeOption>
            <VscodeOption value="json">JSON view</VscodeOption>
            <VscodeOption value="table">Table view</VscodeOption>
          </VscodeSingleSelect>

          {/* Settings */}
          <VscodeToolbarButton
            aria-label="Settings"
            title="Settings"
            onClick={(): void => {
              // TODO: Implement settings menu
            }}
          >
            <VscodeIcon name="settings-gear" />
          </VscodeToolbarButton>
        </div>
      </div>

      {/* Documents content */}
      <div style={styles.content}>
        {isLoading ? (
          <div style={styles.loadingOverlay}>
            <VscodeProgressRing />
            <VscodeLabel>Loading documents...</VscodeLabel>
          </div>
        ) : (
          <>
            {displayedDocuments.map((doc, index) => {
              const docId =
                doc._id !== undefined
                  ? String(doc._id)
                  : `Document ${startItem + index}`;
              return (
                <div key={`${currentPage}-${index}`} style={styles.documentCard}>
                  <VscodeCollapsible title={docId} open>
                    {renderDocumentContent(doc)}
                  </VscodeCollapsible>
                </div>
              );
            })}
            {displayedDocuments.length === 0 && (
              <div style={styles.emptyState}>No documents to display</div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PreviewApp;
