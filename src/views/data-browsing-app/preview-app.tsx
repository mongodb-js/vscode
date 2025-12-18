import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  LeafyGreenProvider,
  Icon,
  IconButton,
  Select,
  Option,
  Menu,
  MenuItem,
  css,
  spacing,
} from '@mongodb-js/compass-components';
import { useDetectVsCodeDarkMode } from './use-detect-vscode-dark-mode';
import {
  PreviewMessageType,
  type MessageFromExtensionToWebview,
  type SortOption,
} from './extension-app-message-constants';
import {
  sendGetDocuments,
  sendRefreshDocuments,
  sendSortDocuments,
} from './vscode-api';
import DocumentTreeView from './document-tree-view';

interface PreviewDocument {
  [key: string]: unknown;
}
type ViewType = 'tree' | 'json' | 'table';

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

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

const toolbarLabelStyles = css({
  fontSize: 13,
  fontWeight: 500,
});

const paginationInfoStyles = css({
  fontSize: 13,
  whiteSpace: 'nowrap',
});

const selectWrapperStyles = css({
  '& button': {
    width: 'auto',
    minWidth: 'unset',
  },
});

const refreshButtonStyles = css({
  display: 'flex',
  alignItems: 'center',
  gap: spacing[100],
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: `${spacing[100]}px ${spacing[200]}px`,
  borderRadius: spacing[100],
  fontSize: 13,
  fontWeight: 500,
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});

const paginationArrowsStyles = css({
  display: 'flex',
  alignItems: 'center',
});

const spinnerKeyframes = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

const loadingOverlayStyles = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: spacing[600],
  flexDirection: 'column',
  gap: spacing[300],
});

const spinnerStyles = css({
  animation: 'spin 1s linear infinite',
});

const PreviewApp: React.FC = () => {
  const darkMode = useDetectVsCodeDarkMode();
  const [documents, setDocuments] = useState<PreviewDocument[]>([]);
  const [sortOption, setSortOption] = useState<SortOption>('default');
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [viewType, setViewType] = useState<ViewType>('tree');
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCountInCollection, setTotalCountInCollection] = useState<number | null>(null);

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
  const startItem = totalDocuments === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
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

  const handleSortChange = (value: string): void => {
    const newSortOption = value as SortOption;
    setSortOption(newSortOption);
    loadingStartTimeRef.current = Date.now();
    setIsLoading(true);
    sendSortDocuments(newSortOption);
  };

  const handleItemsPerPageChange = (value: string): void => {
    const newItemsPerPage = parseInt(value, 10);
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  const handleViewTypeChange = (value: string): void => {
    setViewType(value as ViewType);
    // TODO: Implement different view renderings
  };

  const toggleSettingsMenu = (): void => {
    setSettingsMenuOpen(!settingsMenuOpen);
  };

  return (
    <LeafyGreenProvider darkMode={darkMode}>
      <div
        style={{
          backgroundColor: darkMode ? '#1E1E1E' : '#FFFFFF',
          minHeight: '100vh',
          color: darkMode ? '#CCCCCC' : '#000000',
        }}
      >
        {/* Toolbar */}
        <div className={toolbarStyles}>
          {/* Left side - Insert Document */}
          <div className={toolbarGroupStyles}>
            <IconButton
              aria-label="Insert Document"
              title="Insert Document"
              onClick={(): void => {
                // TODO: Implement insert document functionality
              }}
            >
              <Icon glyph="Plus" />
            </IconButton>
            <span className={toolbarLabelStyles}>Insert Document</span>
          </div>

          {/* Right side - Actions */}
          <div className={toolbarGroupWideStyles}>
            {/* Refresh - single button with icon and text */}
            <button
              className={refreshButtonStyles}
              onClick={handleRefresh}
              title="Refresh"
              disabled={isLoading}
              style={{ opacity: isLoading ? 0.5 : 1, cursor: isLoading ? 'not-allowed' : 'pointer' }}
            >
              <Icon glyph="Refresh" size="small" />
              <span>Refresh</span>
            </button>

            {/* Sort */}
            <div className={toolbarGroupStyles}>
              <span className={toolbarLabelStyles}>Sort</span>
              <div className={selectWrapperStyles}>
                <Select
                  aria-label="Sort order"
                  value={sortOption}
                  onChange={handleSortChange}
                  size="xsmall"
                  allowDeselect={false}
                  dropdownWidthBasis="option"
                >
                  <Option value="default">Default</Option>
                  <Option value="asc">Ascending</Option>
                  <Option value="desc">Descending</Option>
                </Select>
              </div>
            </div>

            {/* Items per page */}
            <div className={selectWrapperStyles}>
              <Select
                aria-label="Items per page"
                value={itemsPerPage.toString()}
                onChange={handleItemsPerPageChange}
                size="xsmall"
                allowDeselect={false}
                dropdownWidthBasis="option"
              >
                {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                  <Option key={option} value={option.toString()}>
                    {option}
                  </Option>
                ))}
              </Select>
            </div>

            {/* Pagination info */}
            <span className={paginationInfoStyles}>
              {startItem}-{endItem} of {totalCountInCollection ?? totalDocuments}
            </span>

            {/* Page navigation arrows */}
            <div className={paginationArrowsStyles}>
              <IconButton
                aria-label="Previous page"
                title="Previous page"
                onClick={handlePrevPage}
                disabled={currentPage <= 1}
              >
                <Icon glyph="CaretLeft" />
              </IconButton>
              <IconButton
                aria-label="Next page"
                title="Next page"
                onClick={handleNextPage}
                disabled={currentPage >= totalPages}
              >
                <Icon glyph="CaretRight" />
              </IconButton>
            </div>

            {/* View type */}
            <div className={selectWrapperStyles}>
              <Select
                aria-label="View type"
                value={viewType}
                onChange={handleViewTypeChange}
                size="xsmall"
                allowDeselect={false}
                dropdownWidthBasis="option"
              >
                <Option value="tree">Tree view</Option>
                <Option value="json">JSON view</Option>
                <Option value="table">Table view</Option>
              </Select>
            </div>

            {/* Settings dropdown */}
            <Menu
              open={settingsMenuOpen}
              setOpen={setSettingsMenuOpen}
              trigger={
                <IconButton
                  aria-label="Settings"
                  title="Settings"
                  onClick={toggleSettingsMenu}
                >
                  <Icon glyph="Settings" />
                </IconButton>
              }
            >
              <MenuItem>Show line numbers</MenuItem>
              <MenuItem>Expand all</MenuItem>
              <MenuItem>Collapse all</MenuItem>
              <MenuItem>Copy documents</MenuItem>
            </Menu>
          </div>
        </div>

        {/* Documents content */}
        <div style={{ padding: '16px' }}>
          {/* Inject keyframes for spinner animation */}
          <style>{spinnerKeyframes}</style>

          {isLoading ? (
            <div className={loadingOverlayStyles}>
              <span className={spinnerStyles}>
                <Icon glyph="Refresh" size="large" />
              </span>
              <span style={{ color: darkMode ? '#888' : '#666' }}>
                Loading documents...
              </span>
            </div>
          ) : (
            <>
              {displayedDocuments.map((doc, index) => (
                <DocumentTreeView key={`${currentPage}-${index}`} document={doc} />
              ))}
              {displayedDocuments.length === 0 && (
                <div style={{
                  textAlign: 'center',
                  padding: '32px',
                  color: darkMode ? '#888' : '#666'
                }}>
                  No documents to display
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </LeafyGreenProvider>
  );
};

export default PreviewApp;

