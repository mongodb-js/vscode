import React from 'react';
import {
  Body,
  css,
  focusRing,
  Icon,
  MongoDBLogo,
  spacing,
} from '@mongodb-js/compass-components';

const headerContainerStyles = css({
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: spacing[2],
  position: 'relative',
});

const headerTextStyles = css({
  textAlign: 'center',
  maxWidth: '60%',
});

const resourcesBtnContainer = css({
  position: 'absolute',
  top: spacing[3],
  right: spacing[3],
});

const resourcesBtnStyles = css(
  {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    background: 'none',
    border: 'none',
    color: 'inherit',
    '&:hover': {
      cursor: 'pointer',
    },
  },
  focusRing
);

const OverviewHeader: React.FC<{ onResourcesClick: () => void }> = ({
  onResourcesClick,
}) => {
  return (
    <div className={headerContainerStyles}>
      <MongoDBLogo color="green-base" />
      <Body className={headerTextStyles}>
        Navigate your databases and collections, use playgrounds for exploring
        and transforming your data
      </Body>
      <Body as="div" className={resourcesBtnContainer}>
        <button
          type="button"
          className={resourcesBtnStyles}
          onClick={onResourcesClick}
        >
          <Icon size={32} glyph="University" />
          Resources
        </button>
      </Body>
    </div>
  );
};

export default OverviewHeader;
