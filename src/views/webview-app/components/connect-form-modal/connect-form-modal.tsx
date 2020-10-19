import * as React from 'react';
import { connect } from 'react-redux';

import ConnectionForm from '../connect-form/connection-form';
import {
  ActionTypes,
  ToggleShowConnectionFormAction
} from '../../store/actions';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';

const styles = require('./connect-form-modal.less');

type DispatchProps = {
  toggleShowConnectForm: () => void;
};

export class ConnectFormModal extends React.PureComponent<DispatchProps> {
  render(): React.ReactNode {
    return (
      <React.Fragment>
        <div
          className={styles['connect-form-modal-back']}
          onClick={(): void => this.props.toggleShowConnectForm()}
        />
        <div className={styles['connect-form-modal']}>
          <button
            className={styles['connect-form-modal-close']}
            onClick={(): void => this.props.toggleShowConnectForm()}
          >
            <FontAwesomeIcon
              icon={faTimes}
            />
          </button>
          <ConnectionForm />
        </div>
      </React.Fragment>
    );
  }
}

const mapDispatchToProps: DispatchProps = {
  toggleShowConnectForm: (): ToggleShowConnectionFormAction => ({
    type: ActionTypes.TOGGLE_SHOW_CONNECTION_FORM
  })
};

export default connect(null, mapDispatchToProps)(ConnectFormModal);

