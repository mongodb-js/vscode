import * as React from 'react';
import { connect } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { Icon } from '@iconify/react';
import bookIcon from '@iconify-icons/codicon/book';

import {
  ActionTypes,
  ToggleShowResourcesPanelAction
} from '../../store/actions';

const styles = require('./resources-panel.less');

type DispatchProps = {
  toggleShowResourcesPanel: () => void;
};

class ResourcesPanel extends React.Component<DispatchProps> {
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

  render(): React.ReactNode {
    return (
      <div className={styles['resources-panel']}>
        <div
          className={styles['resources-panel-background']}
          onClick={(): void => this.props.toggleShowResourcesPanel()}
        />
        <div className={styles['resources-panel-content']}>
          {this.renderHeader()}
        </div>
      </div>
    );
  }
}

const mapDispatchToProps: DispatchProps = {
  toggleShowResourcesPanel: (): ToggleShowResourcesPanelAction => ({
    type: ActionTypes.TOGGLE_SHOW_RESOURCES_PANEL
  })
};

export default connect(null, mapDispatchToProps)(ResourcesPanel);
