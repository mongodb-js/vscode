import React from 'react';
import {
  css,
  spacing,
  palette,
  IconButton,
  Body,
  Icon,
  useDarkMode,
  cx,
} from '@mongodb-js/compass-components';

const headerTextStyles = css({
  fontSize: spacing[4],
  color: palette.green.base,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: spacing[2],
});

const headerTextLightModeStyles = css({
  color: palette.green.dark2,
});

const ResourcesPanelHeader: React.FC<{ onCloseClick: () => void }> = ({
  onCloseClick,
}) => {
  const isDarkMode = useDarkMode();
  return (
    <>
      <div style={{ textAlign: 'right' }}>
        <IconButton aria-label="Close" onClick={onCloseClick}>
          <Icon glyph="X" />
        </IconButton>
      </div>
      <Body
        as="div"
        className={cx(headerTextStyles, {
          [headerTextLightModeStyles]: !isDarkMode,
        })}
      >
        <Icon size={32} glyph="University" />
        <span>
          &nbsp;<strong>MongoDB</strong>&nbsp;resources
        </span>
      </Body>
    </>
  );
};

export default ResourcesPanelHeader;
