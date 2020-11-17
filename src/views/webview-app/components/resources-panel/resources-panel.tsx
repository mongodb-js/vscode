import * as React from 'react';
import { connect } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { Icon } from '@iconify/react';
import bookIcon from '@iconify-icons/codicon/book';

import {
  ActionTypes,
  LinkClickedAction,
  ToggleShowResourcesPanelAction
} from '../../store/actions';

const styles = require('./resources-panel.less');

const ResourceLinks = [{
  title: 'Product overview',
  description: 'Get an overview on MongoDB',
  linkId: 'productOverview',
  url: 'https://www.mongodb.com/products/vs-code'
  // TODO: Should we use a special link.
}, {
  // TODO: Do we pair this with the help tree resource links?
  title: 'Extension documentation',
  description: 'Check the documentation about the extension',
  linkId: 'extensionDocumentation',
  url: 'https://docs.mongodb.com/mongodb-vscode/'
}, {
  title: 'Connect to your database',
  description: 'Connect in just a few steps',
  url: 'https://docs.mongodb.com/mongodb-vscode/connect',
  linkId: 'connectInfo'
}, {
  title: 'Interact with your data',
  description: 'Play with your data, create queries and aggregations',
  // TODO: This link good?
  url: 'https://docs.mongodb.com/mongodb-vscode/playgrounds',
  linkId: 'interactWithYourData'
}];

const FooterFeatures = [{
  title: 'Navigate databases'
}, {
  title: 'Perform CRUD operations'
}, {
  title: 'Run aggregation pipelines'
}, {
  title: 'Playgrounds'
}];

const FooterLinks = [{
  title: 'Github',
  linkId: 'github',
  url: 'https://github.com/mongodb-js/vscode'
}, {
  title: 'Stack Overflow',
  linkId: 'stackOverflow',
  url: 'https://stackoverflow.com/questions'
}, {
  title: 'Suggest a feature',
  linkId: 'feedback',
  url: 'https://feedback.mongodb.com/forums/929236-mongodb-for-vs-code/'
}, {
  title: 'Report a bug',
  linkId: 'reportABug',
  url: 'https://github.com/mongodb-js/vscode/issues'
}];

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
          <FontAwesomeIcon
            icon={faTimes}
          />
        </button>
        <div className={styles['resources-panel-header']}>
          <Icon
            className={styles['resources-panel-book-icon']}
            icon={bookIcon}
          />&nbsp;<strong>MongoDB</strong>&nbsp;resources
        </div>
      </React.Fragment>
    );
  }

  renderLinks(): React.ReactNode {
    return (
      <div className={styles['resources-panel-links-container']}>
        {ResourceLinks.map(resourceLink => (
          <a
            className={styles['resources-panel-link']}
            href={resourceLink.url}
            onClick={(): void => this.onLinkClicked(
              'overviewResourcesPanel',
              resourceLink.linkId
            )}
            key={`link-${resourceLink.linkId}`}
          >
            <div>
              <strong>
                {resourceLink.title}
              </strong>
            </div>
            <div>
              {resourceLink.description}
            </div>
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
            <strong>
              Key Features
            </strong>
          </div>
          {FooterFeatures.map(footerFeature => (
            <div
              className={styles['resources-panel-footer-link']}
              key={`footer-feature-${footerFeature.title}`}
            >
              {footerFeature.title}
            </div>
          ))}
        </div>
        <div className={styles['resources-panel-footer-item']}>
          <div className={styles['resources-panel-footer-item-title']}>
            <strong>
              Contribute
            </strong>
          </div>
          {FooterLinks.map(footerLink => (
            <a
              className={styles['resources-panel-footer-link']}
              href={footerLink.url}
              onClick={(): void => this.onLinkClicked(
                'overviewResourcesPanel',
                footerLink.linkId
              )}
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
    linkId
  }),
  toggleShowResourcesPanel: (): ToggleShowResourcesPanelAction => ({
    type: ActionTypes.TOGGLE_SHOW_RESOURCES_PANEL
  })
};

export default connect(null, mapDispatchToProps)(ResourcesPanel);
