import * as React from 'react';
import Toggle from '@leafygreen-ui/toggle';

import Actions from '../../../store/actions';

const styles = require('../../../connect.module.less');

type props = {
  isSrvRecord: boolean;
};

class SRVInput extends React.PureComponent<props> {
  static displayName = 'SRVInput';

  /**
   * Handles SRV record toggle.
   *
   * @param {Object} evt - evt.
   */
  onSRVRecordToggled = (): void => {
    Actions.onSRVRecordToggled();
  };

  render(): React.ReactNode {
    const {
      isSrvRecord
    } = this.props;

    return (
      <div className={styles['form-item']}>
        <div>
          <label><span>SRV Record</span></label>
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

export default SRVInput;
