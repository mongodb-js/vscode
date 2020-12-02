import * as React from 'react';

import ReadPreferenceSelect from './read-preference-select';

class AdvancedTab extends React.Component {
  render(): React.ReactNode {
    return (
      <React.Fragment>
        <ReadPreferenceSelect />
      </React.Fragment>
    );
  }
}

export default AdvancedTab;
