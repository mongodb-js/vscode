import * as React from 'react';
import Toggle from '@leafygreen-ui/toggle';
import { connect } from 'react-redux';

import { ActionTypes, IsSrvRecordToggledAction } from '../../../store/actions';

const styles = require('../../../connect.module.less');

type dispatchProps = {
  onSRVRecordToggled: () => void;
};

type props = {
  isSrvRecord: boolean;
} & dispatchProps;

class SRVInput extends React.PureComponent<props> {
  static displayName = 'SRVInput';

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
          className={styles['form-toggle']}
          name="isSrvRecord"
          onChange={this.onSRVRecordToggled}
          checked={isSrvRecord}
          size="small"
          variant="default"
          disabled={false}
        />
      </div>
    );
  }
}

const mapDispatchToProps: dispatchProps = {
  onSRVRecordToggled: (): IsSrvRecordToggledAction => ({
    type: ActionTypes.IS_SRV_RECORD_TOGGLED
  })
};

export default connect(null, mapDispatchToProps)(SRVInput);
