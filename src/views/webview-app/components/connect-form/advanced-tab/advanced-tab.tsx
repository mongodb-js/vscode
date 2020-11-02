import * as React from 'react';

import ReadPreferenceSelect from './read-preference-select';
import ReplicaSetInput from './replica-set-input';

class AdvancedTab extends React.Component {
  render(): React.ReactNode {
    return (
      <React.Fragment>
        <ReplicaSetInput />
        <ReadPreferenceSelect />
      </React.Fragment>
    );
  }
}

export default AdvancedTab;
