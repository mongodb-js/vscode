import React from 'react';
import { Icon, css, spacing } from '@mongodb-js/compass-components';
import LINKS from '../../../utils/links';
import { trackExtensionLinkClicked } from '../vscode-api';
import { TELEMETRY_SCREEN_ID } from './panel';

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
  backgroundColor: 'var(--vscode-sideBar-background, rgba(50, 50, 50, 0.25))',
  color: 'var(--vscode-editor-foreground)',
});

const linkBlockStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[1],
});

const ResourcesPanelLinks: React.FC = () => (
  <div className={linksContainerStyles}>
    {ResourceLinks.map((resourceLink) => (
      <a
        className={linkStyles}
        href={resourceLink.url}
        onClick={() => {
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

export default ResourcesPanelLinks;
