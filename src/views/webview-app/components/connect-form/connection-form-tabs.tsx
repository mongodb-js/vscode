import classnames from 'classnames';
import * as React from 'react';
import { connect } from 'react-redux';

import type { SetConnectionFormTabAction } from '../../store/actions';
import { ActionTypes } from '../../store/actions';
import type { AppState } from '../../store/store';
import { CONNECTION_FORM_TABS } from '../../store/constants';

import styles from './connection-form.less';

type StateProps = {
  connectionFormTab: CONNECTION_FORM_TABS;
};

type DispatchProps = {
  setConnectionFormTab: (connectionFormTab: CONNECTION_FORM_TABS) => void;
};

type props = StateProps & DispatchProps;

export class ConnectionFormTabs extends React.Component<props> {
  onClickNewConnectFormTab = (
    e: React.MouseEvent,
    newTab: CONNECTION_FORM_TABS
  ): void => {
    e.preventDefault();

    this.props.setConnectionFormTab(newTab);
  };

  render(): React.ReactNode {
    const { connectionFormTab } = this.props;

    return (
      <div className={styles['connection-form-tabs-container']} role="tablist">
        <button
          className={classnames({
            [styles['connection-form-tab']]: true,
            [styles['connection-form-tab-selected']]:
              connectionFormTab === CONNECTION_FORM_TABS.GENERAL,
          })}
          onClick={(e): void =>
            this.onClickNewConnectFormTab(e, CONNECTION_FORM_TABS.GENERAL)
          }
          role="tab"
          aria-selected={connectionFormTab === CONNECTION_FORM_TABS.GENERAL}
        >
          General
        </button>
        <button
          className={classnames({
            [styles['connection-form-tab']]: true,
            [styles['connection-form-tab-selected']]:
              connectionFormTab === CONNECTION_FORM_TABS.SSL,
          })}
          onClick={(e): void =>
            this.onClickNewConnectFormTab(e, CONNECTION_FORM_TABS.SSL)
          }
          role="tab"
          aria-selected={connectionFormTab === CONNECTION_FORM_TABS.SSL}
        >
          SSL/TLS
        </button>
        <button
          className={classnames({
            [styles['connection-form-tab']]: true,
            [styles['connection-form-tab-selected']]:
              connectionFormTab === CONNECTION_FORM_TABS.SSH,
          })}
          onClick={(e): void =>
            this.onClickNewConnectFormTab(e, CONNECTION_FORM_TABS.SSH)
          }
          role="tab"
          aria-selected={connectionFormTab === CONNECTION_FORM_TABS.SSH}
        >
          SSH Tunnel
        </button>
        <button
          className={classnames({
            [styles['connection-form-tab']]: true,
            [styles['connection-form-tab-selected']]:
              connectionFormTab === CONNECTION_FORM_TABS.ADVANCED,
          })}
          onClick={(e): void =>
            this.onClickNewConnectFormTab(e, CONNECTION_FORM_TABS.ADVANCED)
          }
          role="tab"
          aria-selected={connectionFormTab === CONNECTION_FORM_TABS.ADVANCED}
        >
          Advanced
        </button>
      </div>
    );
  }
}

const mapStateToProps = (state: AppState): StateProps => {
  return {
    connectionFormTab: state.connectionFormTab,
  };
};

const mapDispatchToProps: DispatchProps = {
  setConnectionFormTab: (
    connectionFormTab: CONNECTION_FORM_TABS
  ): SetConnectionFormTabAction => ({
    type: ActionTypes.SET_CONNECTION_FORM_TAB,
    connectionFormTab,
  }),
};

export default connect(mapStateToProps, mapDispatchToProps)(ConnectionFormTabs);
