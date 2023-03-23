import * as React from 'react';
import { connect } from 'react-redux';
import { Icon } from '@iconify/react';
import bookIcon from '@iconify-icons/codicon/book';

import MongoDBLogo from '../../mongodb-logo/mongodb-logo';
import {
  ActionTypes,
  ToggleShowResourcesPanelAction,
} from '../../../store/actions';

import styles from './overview-header.less';

type DispatchProps = {
  toggleShowResourcesPanel: () => void;
};

class OverviewHeader extends React.Component<DispatchProps> {
  renderResourcesButton(): React.ReactNode {
    return (
      <button
        className={styles['resources-button']}
        onClick={(): void => this.props.toggleShowResourcesPanel()}
      >
        <Icon className={styles['resources-button-icon']} icon={bookIcon} />
        <div className={styles['resources-button-title']}>Resources</div>
      </button>
    );
  }

  render(): React.ReactNode {
    return (
      <div className={styles['overview-header']}>
        <div className={styles['overview-header-content-area']}>
          <MongoDBLogo />
          <div className={styles['overview-header-description']}>
            Navigate your databases and collections, use playgrounds for
            exploring and transforming your data
          </div>
          {this.renderResourcesButton()}
        </div>
        <div className={styles['overview-header-bar']} />
      </div>
    );
  }
}

const mapDispatchToProps: DispatchProps = {
  toggleShowResourcesPanel: (): ToggleShowResourcesPanelAction => ({
    type: ActionTypes.TOGGLE_SHOW_RESOURCES_PANEL,
  }),
};

export default connect(null, mapDispatchToProps)(OverviewHeader);
