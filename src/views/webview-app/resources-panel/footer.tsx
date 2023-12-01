import React from 'react';
import { css, cx, palette, useDarkMode } from '@mongodb-js/compass-components';
import LINKS from '../../../utils/links';
import { trackExtensionLinkClicked } from '../vscode-api';
import { TELEMETRY_SCREEN_ID } from './panel';

const FooterFeatures = [
  {
    title: 'Navigate databases',
    linkId: 'navigateDatabaseInfo',
    url: LINKS.extensionDocs('databases-collections'),
  },
  {
    title: 'Perform CRUD operations',
    linkId: 'crudInfo',
    url: LINKS.extensionDocs('crud-ops'),
  },
  {
    title: 'Run aggregation pipelines',
    linkId: 'aggPipelineInfo',
    url: LINKS.extensionDocs('run-agg-pipelines'),
  },
  {
    title: 'Playgrounds',
    linkId: 'playgroundsInfo',
    url: LINKS.extensionDocs('playgrounds'),
  },
] as const;

const FooterLinks = [
  {
    title: 'Github',
    linkId: 'github',
    url: LINKS.github,
  },
  {
    title: 'Suggest a feature',
    linkId: 'feedback',
    url: LINKS.feedback,
  },
  {
    title: 'Report a bug',
    linkId: 'reportABug',
    url: LINKS.reportBug,
  },
] as const;

const footerStyles = css({
  marginTop: '40px',
  display: 'flex',
  flexDirection: 'row',
  textAlign: 'left',
});

const footerItemStyles = css({
  width: '50%',
  display: 'inline-block',
  '&:last-child': {
    paddingLeft: '10px',
  },
});

const footerItemTitleStyles = css({
  margin: '10px 0px',
  fontWeight: 'bold',
});

const footerItemLinkStyles = css({
  margin: '5px 0px',
  textDecoration: 'none',
  display: 'block',
  color: 'var(--vscode-editor-foreground)',
  '&:hover': {
    color: palette.green.base,
  },
});

const footerItemLinkLightModeStyles = css({
  '&:hover': {
    color: palette.green.dark2,
  },
});

const ResourcesPanelFooter: React.FC = () => {
  const isDarkMode = useDarkMode();
  const itemLinkStyles = cx(footerItemLinkStyles, {
    [footerItemLinkLightModeStyles]: !isDarkMode,
  });
  return (
    <div className={footerStyles}>
      <div className={footerItemStyles}>
        <div className={footerItemTitleStyles}>Key features</div>
        {FooterFeatures.map((footerFeature) => (
          <a
            className={itemLinkStyles}
            href={footerFeature.url}
            key={`footer-feature-${footerFeature.linkId}`}
            data-testid={`footer-feature-${footerFeature.linkId}`}
            onClick={() => {
              trackExtensionLinkClicked(
                TELEMETRY_SCREEN_ID,
                footerFeature.linkId
              );
            }}
          >
            {footerFeature.title}
          </a>
        ))}
      </div>
      <div className={footerItemStyles}>
        <div className={footerItemTitleStyles}>Contribute</div>
        {FooterLinks.map((footerLink) => (
          <a
            className={itemLinkStyles}
            href={footerLink.url}
            key={`footer-link-${footerLink.linkId}`}
            data-testid={`footer-link-${footerLink.linkId}`}
            onClick={() => {
              trackExtensionLinkClicked(TELEMETRY_SCREEN_ID, footerLink.linkId);
            }}
          >
            {footerLink.title}
          </a>
        ))}
      </div>
    </div>
  );
};

export default ResourcesPanelFooter;
