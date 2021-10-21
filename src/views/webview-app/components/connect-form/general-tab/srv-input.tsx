import * as React from 'react';
import { connect } from 'react-redux';
import Toggle from '@leafygreen-ui/toggle';

import { ActionTypes, IsSrvRecordToggledAction } from '../../../store/actions';
import { AppState } from '../../../store/store';

const styles = require('../../../connect.module.less');

type StateProps = {
  isSrvRecord: boolean;
};

type DispatchProps = {
  onSRVRecordToggled: () => void;
};

class SRVInput extends React.PureComponent<StateProps & DispatchProps> {
  /**
   * Handles SRV record toggle.
   *
   * @param {Object} evt - evt.
   */
  onSRVRecordToggled = (): void => {
    this.props.onSRVRecordToggled();
  };

  render(): React.ReactNode {
    const { isSrvRecord } = this.props;

    return (
      <div className={styles['form-item']}>
        <div>
          <label>
            <span>SRV Record</span>
          </label>
        </div>
        <Toggle
          aria-labelledby="SRV Record"
          className={styles['form-toggle']}
          name="isSrvRecord"
          onChange={this.onSRVRecordToggled}
          checked={isSrvRecord}
          size="small"
          disabled={false}
        />
      </div>
    );
  }
}

const mapStateToProps = (state: AppState): StateProps => {
  return {
    isSrvRecord: state.currentConnection.isSrvRecord
  };
};

const mapDispatchToProps: DispatchProps = {
  onSRVRecordToggled: (): IsSrvRecordToggledAction => ({
    type: ActionTypes.IS_SRV_RECORD_TOGGLED
  })
};

export default connect(mapStateToProps, mapDispatchToProps)(SRVInput);
