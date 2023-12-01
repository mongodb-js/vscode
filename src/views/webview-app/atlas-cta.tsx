import React from 'react';
import {
  Body,
  Button,
  css,
  cx,
  palette,
  spacing,
  useDarkMode,
} from '@mongodb-js/compass-components';
import LINKS from '../../utils/links';
import AtlasLogo from './atlas-logo';
import { openTrustedLink, trackExtensionLinkClicked } from './vscode-api';
import { VSCODE_EXTENSION_SEGMENT_ANONYMOUS_ID } from './extension-app-message-constants';

const ctaContainerStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[2],
  marginTop: spacing[4],
  alignItems: 'center',
  '@media(min-width: 600px)': {
    '&': {
      flexDirection: 'row',
      gap: spacing[4],
    },
  },
});

const atlasTxtLogoContainerStyles = css({
  display: 'flex',
  alignItems: 'center',
  gap: spacing[2],
});

const txtStyles = css({
  textAlign: 'left',
});

const linkDarkModeStyles = css({
  color: palette.green.base,
  '&:hover': {
    color: palette.green.base,
  },
});

const linkLightModeStyles = css({
  color: palette.green.dark2,
  '&:hover': {
    color: palette.green.dark2,
  },
});

const AtlasCta: React.FC = () => {
  const isDarkMode = useDarkMode();

  const handleAtlasCTAClicked = () => {
    const telemetryUserId = window[VSCODE_EXTENSION_SEGMENT_ANONYMOUS_ID];
    const atlasLink = LINKS.createAtlasCluster(telemetryUserId);
    openTrustedLink(atlasLink);
    trackExtensionLinkClicked('overviewPage', 'freeClusterCTA');
  };

  return (
    <div className={ctaContainerStyles}>
      <div className={atlasTxtLogoContainerStyles}>
        <AtlasLogo />
        <div className={txtStyles}>
          <Body as="div">
            <strong>New to MongoDB and don't have a cluster?</strong>
          </Body>
          <Body as="div">
            Create one for free using&nbsp;
            <a
              className={cx({
                [linkDarkModeStyles]: isDarkMode,
                [linkLightModeStyles]: !isDarkMode,
              })}
              data-testid="link-atlas"
              target="_blank"
              rel="noopener"
              href={LINKS.atlas}
              onClick={() =>
                trackExtensionLinkClicked('overviewPage', 'atlasLanding')
              }
            >
              MongoDB Atlas
            </a>
            .
          </Body>
        </div>
      </div>
      <Button variant="default" onClick={handleAtlasCTAClicked}>
        Create free cluster
      </Button>
    </div>
  );
};

export default AtlasCta;
