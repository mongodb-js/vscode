import * as React from 'react';
import { connect } from 'react-redux';

import {
  ActionTypes,
  LinkClickedAction,
  TrustedLinkClickedAction,
} from '../../store/actions';
import { VSCODE_EXTENSION_SEGMENT_ANONYMOUS_ID } from '../../extension-app-message-constants';
import AtlasLogo from './atlas-logo';

import styles from './atlas-cta.less';

type DispatchProps = {
  onLinkClicked: (screen: string, linkId: string) => void;
  openTrustedLink: (linkTo: string) => void;
};

class AtlasCTA extends React.Component<DispatchProps> {
  onAtlasCtaClicked = (): void => {
    const telemetryUserId = window[VSCODE_EXTENSION_SEGMENT_ANONYMOUS_ID];
    const atlasLink = `https://mongodb.com/products/vs-code/vs-code-atlas-signup?utm_campaign=vs-code-extension&utm_source=visual-studio&utm_medium=product&ajs_aid=${telemetryUserId}`;
    this.props.openTrustedLink(atlasLink);

    this.onLinkClicked('overviewPage', 'freeClusterCTA');
  };

  onLinkClicked = (screen: string, linkId: string): void => {
    this.props.onLinkClicked(screen, linkId);
  };

  render(): React.ReactNode {
    return (
      <div className={styles['atlas-cta']}>
        <div className={styles['atlas-cta-logo']}>{<AtlasLogo />}</div>
        <div className={styles['atlas-cta-text']}>
          <div>
            <strong>New to MongoDB and don't have a cluster?</strong>
          </div>
          <div>
            Create one for free using&nbsp;
            <a
              className={styles['atlas-cta-text-link']}
              target="_blank"
              rel="noopener"
              href="https://www.mongodb.com/cloud/atlas"
              onClick={this.onLinkClicked.bind(
                this,
                'overviewPage',
                'atlasLanding'
              )}
            >
              MongoDB Atlas
            </a>
            .
          </div>
        </div>
        <a
          className={styles['atlas-cta-button']}
          target="_blank"
          rel="noopener"
          href="#"
          onClick={this.onAtlasCtaClicked}
        >
          Create free cluster
        </a>
      </div>
    );
  }
}

const mapDispatchToProps: DispatchProps = {
  onLinkClicked: (screen, linkId): LinkClickedAction => ({
    type: ActionTypes.EXTENSION_LINK_CLICKED,
    screen,
    linkId,
  }),
  openTrustedLink: (linkTo: string): TrustedLinkClickedAction => ({
    type: ActionTypes.TRUSTED_LINK_CLICKED,
    linkTo,
  }),
};

export default connect(() => ({}), mapDispatchToProps)(AtlasCTA);
