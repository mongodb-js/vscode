import * as React from 'react';
import { connect } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { Icon } from '@iconify/react';
import bookIcon from '@iconify-icons/codicon/book';

import type {
  LinkClickedAction,
  ToggleShowResourcesPanelAction,
} from '../../store/actions';
import { ActionTypes } from '../../store/actions';

import styles from './resources-panel.less';
import LINKS from '../../../../utils/links';

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
];

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
];

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
];

const TELEMETRY_SCREEN_ID = 'overviewResourcesPanel';

type DispatchProps = {
  onLinkClicked: (screen: string, linkId: string) => void;
  toggleShowResourcesPanel: () => void;
};

class ResourcesPanel extends React.Component<DispatchProps> {
  onLinkClicked = (screen: string, linkId: string): void => {
    this.props.onLinkClicked(screen, linkId);
  };

  renderHeader(): React.ReactNode {
    return (
      <React.Fragment>
        <button
          className={styles['resources-panel-close']}
          onClick={(): void => this.props.toggleShowResourcesPanel()}
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>
        <div className={styles['resources-panel-header']}>
          <Icon
            className={styles['resources-panel-book-icon']}
            icon={bookIcon}
          />
          &nbsp;<strong>MongoDB</strong>&nbsp;resources
        </div>
      </React.Fragment>
    );
  }

  renderLinks(): React.ReactNode {
    return (
      <div className={styles['resources-panel-links-container']}>
        {ResourceLinks.map((resourceLink) => (
          <a
            className={styles['resources-panel-link']}
            href={resourceLink.url}
            onClick={(): void =>
              this.onLinkClicked(TELEMETRY_SCREEN_ID, resourceLink.linkId)
            }
            key={`link-${resourceLink.linkId}`}
          >
            <div>
              <strong>{resourceLink.title}</strong>
            </div>
            <div>{resourceLink.description}</div>
            <FontAwesomeIcon
              className={styles['resources-panel-link-icon']}
              icon={faArrowRight}
            />
          </a>
        ))}
      </div>
    );
  }

  renderFooter(): React.ReactNode {
    return (
      <div className={styles['resources-panel-footer']}>
        <div className={styles['resources-panel-footer-item']}>
          <div className={styles['resources-panel-footer-item-title']}>
            Key features
          </div>
          {FooterFeatures.map((footerFeature) => (
            <a
              className={styles['resources-panel-footer-link']}
              key={`footer-feature-${footerFeature.linkId}`}
              href={footerFeature.url}
              onClick={(): void =>
                this.onLinkClicked(TELEMETRY_SCREEN_ID, footerFeature.linkId)
              }
            >
              {footerFeature.title}
            </a>
          ))}
        </div>
        <div className={styles['resources-panel-footer-item']}>
          <div className={styles['resources-panel-footer-item-title']}>
            Contribute
          </div>
          {FooterLinks.map((footerLink) => (
            <a
              className={styles['resources-panel-footer-link']}
              href={footerLink.url}
              onClick={(): void =>
                this.onLinkClicked(TELEMETRY_SCREEN_ID, footerLink.linkId)
              }
              key={`footer-link-${footerLink.linkId}`}
            >
              {footerLink.title}
            </a>
          ))}
        </div>
      </div>
    );
  }

  render(): React.ReactNode {
    return (
      <div className={styles['resources-panel']}>
        <div
          className={styles['resources-panel-background']}
          onClick={(): void => this.props.toggleShowResourcesPanel()}
        />
        <div className={styles['resources-panel-content']}>
          {this.renderHeader()}
          {this.renderLinks()}
          {this.renderFooter()}
        </div>
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
  toggleShowResourcesPanel: (): ToggleShowResourcesPanelAction => ({
    type: ActionTypes.TOGGLE_SHOW_RESOURCES_PANEL,
  }),
};

export default connect(null, mapDispatchToProps)(ResourcesPanel);
