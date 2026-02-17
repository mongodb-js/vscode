import React, { useState, useRef, useEffect, useCallback } from 'react';
import { VscodeButton } from '@vscode-elements/react-elements';
import { css } from '@mongodb-js/compass-components';

export interface BulkAction {
  value: string;
  label: string;
  description: string;
}

const wrapperStyles = css({
  position: 'relative',
  display: 'inline-block',
});

const menuStyles = css({
  position: 'absolute',
  top: '100%',
  left: 0,
  zIndex: 100,
  minWidth: '320px',
  marginTop: '2px',
  padding: '4px 0',
  backgroundColor: 'var(--vscode-menu-background, #252526)',
  border: '1px solid var(--vscode-menu-border, var(--vscode-widget-border, #454545))',
  borderRadius: '4px',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.36)',
  listStyle: 'none',
});

const menuItemStyles = css({
  padding: '6px 10px',
  cursor: 'pointer',
  color: 'var(--vscode-menu-foreground, var(--vscode-foreground, #cccccc))',
  '&:hover': {
    backgroundColor:
      'var(--vscode-menu-selectionBackground, var(--vscode-list-hoverBackground, #2a2d2e))',
    color:
      'var(--vscode-menu-selectionForeground, var(--vscode-list-hoverForeground, #ffffff))',
  },
});

const menuItemLabelStyles = css({
  fontSize: '13px',
  lineHeight: '20px',
});

const menuItemDescriptionStyles = css({
  fontSize: '12px',
  opacity: 0.7,
  lineHeight: 1.4,
  marginTop: '2px',
});

interface BulkActionsSelectProps {
  actions: BulkAction[];
  onAction: (actionValue: string) => void;
  disabled?: boolean;
}

const BulkActionsSelect: React.FC<BulkActionsSelectProps> = ({
  actions,
  onAction,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleToggle = useCallback(() => {
    if (!disabled) {
      setIsOpen((prev) => !prev);
    }
  }, [disabled]);

  const handleItemClick = useCallback(
    (value: string) => {
      onAction(value);
      setIsOpen(false);
    },
    [onAction],
  );

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleClickOutside = (event: MouseEvent): void => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={wrapperRef} className={wrapperStyles}>
      <VscodeButton
        aria-label="Bulk Actions"
        aria-haspopup="true"
        aria-expanded={isOpen}
        title="Bulk Actions"
        onClick={handleToggle}
        disabled={disabled}
        icon-after="chevron-down"
        secondary
      >
        Bulk Actions
      </VscodeButton>
      {isOpen && (
        <ul className={menuStyles} role="menu" aria-label="Bulk Actions">
          {actions.map((action) => (
            <li
              key={action.value}
              className={menuItemStyles}
              role="menuitem"
              onClick={(): void => handleItemClick(action.value)}
            >
              <div className={menuItemLabelStyles}>{action.label}</div>
              <div className={menuItemDescriptionStyles}>
                {action.description}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

BulkActionsSelect.displayName = 'BulkActionsSelect';

export default BulkActionsSelect;
