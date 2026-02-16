import React, { useCallback, useImperativeHandle, forwardRef } from 'react';
import {
  VscodeOption,
  VscodeSingleSelect,
} from '@vscode-elements/react-elements';
import { css } from '@mongodb-js/compass-components';

export interface BulkAction {
  value: string;
  label: string;
  description: string;
}

export interface BulkActionsSelectHandle {
  /**
   * Exposed for testing only - allows tests to manually call the change handler in JSDOM.
   * DO NOT use this in production code.
   */
  _testOnlyHandleChange: (event: Event) => void;
}

const selectStyles = css({
  width: 'fit-content',
  minWidth: 'unset',
});

const PLACEHOLDER_VALUE = '__placeholder__';

function buildShadowStyles(actions: BulkAction[]): string {
  const perActionStyles = actions.flatMap((action, i) => {
    const idx = i + 1; // offset by 1 for the hidden placeholder option at index 0
    return [
      `.options li.option[data-index="${idx}"] {`,
      '  height: auto !important;',
      '  white-space: normal !important;',
      '  overflow: visible !important;',
      '  padding: 4px 8px !important;',
      '  line-height: 20px !important;',
      '}',
      `.options li.option[data-index="${idx}"]::after {`,
      `  content: "${action.description}";`,
      '  display: block;',
      '  font-size: 12px;',
      '  opacity: 0.7;',
      '  white-space: normal;',
      '  line-height: 1.4;',
      '  margin-top: 2px;',
      '}',
    ];
  });

  return [
    // Transparent background so the select face looks like a toolbar button
    '.select-face { background-color: transparent !important; }',
    '.select-face:hover { background-color: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31)) !important; }',
    // Hide the placeholder option from the dropdown list
    '.options li.option:first-child { display: none; }',
    // Widen the dropdown to fit description text
    '.dropdown { min-width: 320px !important; }',
    // Hide the default hover-only description area
    '.description { display: none !important; }',
    // Let the scrollable container size to its content
    '.scrollable { height: auto !important; max-height: 220px !important; }',
    // Only highlight on hover (prevent persistent active highlight)
    '.option.active { background-color: transparent !important; color: var(--vscode-foreground, #cccccc) !important; outline: none !important; }',
    '.option.active:hover { background-color: var(--vscode-list-hoverBackground, #2a2d2e) !important; color: var(--vscode-list-hoverForeground, #ffffff) !important; }',
    ...perActionStyles,
  ].join('\n');
}

const STYLE_ID = 'bulk-actions-custom-styles';

interface BulkActionsSelectProps {
  actions: BulkAction[];
  onAction: (actionValue: string) => void;
  disabled?: boolean;
  className?: string;
}

const BulkActionsSelect = forwardRef<
  BulkActionsSelectHandle,
  BulkActionsSelectProps
>(({ actions, onAction, disabled = false, className }, ref) => {
  const selectRef = useCallback(
    (node: HTMLElement | null) => {
      if (!node) {
        return;
      }
      const sr = node.shadowRoot;
      if (sr && !sr.querySelector(`#${STYLE_ID}`)) {
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = buildShadowStyles(actions);
        sr.appendChild(style);
      }
    },
    [actions],
  );

  const handleChange = useCallback(
    (event: Event): void => {
      const target = event.target as HTMLSelectElement;
      const value = target.value;
      if (value !== PLACEHOLDER_VALUE) {
        onAction(value);
      }
      // Reset back to the placeholder so the label always shows "Bulk Actions"
      target.value = PLACEHOLDER_VALUE;
    },
    [onAction],
  );

  // Expose handler for testing (JSDOM workaround)
  useImperativeHandle(ref, () => ({
    _testOnlyHandleChange: handleChange,
  }));

  return (
    <VscodeSingleSelect
      className={className ?? selectStyles}
      aria-label="Bulk Actions"
      value={PLACEHOLDER_VALUE}
      onChange={handleChange}
      disabled={disabled}
      ref={selectRef}
    >
      <VscodeOption value={PLACEHOLDER_VALUE}>Bulk Actions</VscodeOption>
      {actions.map((action) => (
        <VscodeOption key={action.value} value={action.value}>
          {action.label}
        </VscodeOption>
      ))}
    </VscodeSingleSelect>
  );
});

BulkActionsSelect.displayName = 'BulkActionsSelect';

export default BulkActionsSelect;
