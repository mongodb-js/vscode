import React from 'react';
import {
  Icon,
  css,
  cx,
  palette,
  spacing,
  useDarkMode,
} from '@mongodb-js/compass-components';
import LINKS from '../../../utils/links';
import { trackExtensionLinkClicked } from '../vscode-api';
import { TELEMETRY_SCREEN_ID } from './panel';
import {
  VSCODE_SIDEBAR_BACKGROUND,
  VSCODE_EDITOR_FOREGROUND,
} from '../../vscode-styles';

const ResourceLinks = [
  {
    title: 'Product overview',
    description: 'Get an overview on MongoDB',
    linkId: 'productOverview',
    url: LINKS.docs,
  },
  {
    title: 'Extension documentation',
    description: 'Check the documentation about the extension',
    linkId: 'extensionDocumentation',
    url: LINKS.extensionDocs(),
  },
  {
    title: 'Connect to your database',
    description: 'Connect in just a few steps',
    linkId: 'connectInfo',
    url: LINKS.extensionDocs('connect'),
  },
  {
    title: 'Interact with your data',
    description: 'Play with your data, create queries and aggregations',
    linkId: 'interactWithYourData',
    url: LINKS.extensionDocs('playgrounds'),
  },
] as const;

const linksContainerStyles = css({
  marginTop: spacing[6],
});

const linkStyles = css({
  marginTop: spacing[2],
  padding: `10px ${spacing[3]}px`,
  textAlign: 'left',
  textDecoration: 'none',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  position: 'relative',
  backgroundColor: VSCODE_SIDEBAR_BACKGROUND,
  color: VSCODE_EDITOR_FOREGROUND,
  '&:hover': {
    color: palette.green.base,
  },
});

const linkLightModeStyles = css({
  '&:hover': {
    color: palette.green.dark2,
  },
});

const linkBlockStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[1],
});

const ResourcesPanelLinks: React.FC = () => {
  const isDarkMode = useDarkMode();
  return (
    <div className={linksContainerStyles}>
      {ResourceLinks.map((resourceLink) => (
        <a
          className={cx(linkStyles, {
            [linkLightModeStyles]: !isDarkMode,
          })}
          href={resourceLink.url}
          onClick={(): void => {
            trackExtensionLinkClicked(TELEMETRY_SCREEN_ID, resourceLink.linkId);
          }}
          key={`link-${resourceLink.linkId}`}
          data-testid={`link-${resourceLink.linkId}`}
        >
          <div className={linkBlockStyles}>
            <strong>{resourceLink.title}</strong>
            <span>{resourceLink.description}</span>
          </div>
          <Icon glyph="ArrowRight" />
        </a>
      ))}
    </div>
  );
};

export default ResourcesPanelLinks;
