import classnames from 'classnames';
import * as React from 'react';
import { connect } from 'react-redux';

import {
  ActionTypes,
  SetConnectionFormTabAction
} from '../../store/actions';
import { AppState } from '../../store/store';
import { CONNECTION_FORM_TABS } from '../../store/constants';

const styles = require('./connection-form.less');

type StateProps = {
  connectionFormTab: CONNECTION_FORM_TABS;
};

type DispatchProps = {
  setConnectionFormTab: (connectionFormTab: CONNECTION_FORM_TABS) => void;
};

type props = StateProps & DispatchProps;

export class ConnectionFormTabs extends React.Component<props> {
  render(): React.ReactNode {
    const {
      connectionFormTab,
      setConnectionFormTab
    } = this.props;

    return (
      <ul
        className={styles['connection-form-tabs-container']}
        role="tablist"
      >
        <li
          className={classnames({
            [styles['connection-form-tab']]: true,
            [styles['connection-form-tab-selected']]: connectionFormTab === CONNECTION_FORM_TABS.GENERAL
          })}
          onClick={(): void => setConnectionFormTab(CONNECTION_FORM_TABS.GENERAL)}
          role="tab"
          aria-selected={connectionFormTab === CONNECTION_FORM_TABS.GENERAL}
        >General</li>
        <li
          className={classnames({
            [styles['connection-form-tab']]: true,
            [styles['connection-form-tab-selected']]: connectionFormTab === CONNECTION_FORM_TABS.SSL
          })}
          onClick={(): void => setConnectionFormTab(CONNECTION_FORM_TABS.SSL)}
          role="tab"
          aria-selected={connectionFormTab === CONNECTION_FORM_TABS.SSL}
        >SSL/TLS</li>
        <li
          className={classnames({
            [styles['connection-form-tab']]: true,
            [styles['connection-form-tab-selected']]: connectionFormTab === CONNECTION_FORM_TABS.SSH
          })}
          onClick={(): void => setConnectionFormTab(CONNECTION_FORM_TABS.SSH)}
          role="tab"
          aria-selected={connectionFormTab === CONNECTION_FORM_TABS.SSH}
        >SSH Tunnel</li>
        <li
          className={classnames({
            [styles['connection-form-tab']]: true,
            [styles['connection-form-tab-selected']]: connectionFormTab === CONNECTION_FORM_TABS.ADVANCED
          })}
          onClick={(): void => setConnectionFormTab(CONNECTION_FORM_TABS.ADVANCED)}
          role="tab"
          aria-selected={connectionFormTab === CONNECTION_FORM_TABS.ADVANCED}
        >Advanced</li>
      </ul>
    );
  }
}

const mapStateToProps = (state: AppState): StateProps => {
  return {
    connectionFormTab: state.connectionFormTab
  };
};

const mapDispatchToProps: DispatchProps = {
  setConnectionFormTab: (connectionFormTab: CONNECTION_FORM_TABS): SetConnectionFormTabAction => ({
    type: ActionTypes.SET_CONNECTION_FORM_TAB,
    connectionFormTab
  })
};

export default connect(mapStateToProps, mapDispatchToProps)(ConnectionFormTabs);
