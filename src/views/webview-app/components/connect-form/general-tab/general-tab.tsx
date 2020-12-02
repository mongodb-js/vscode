import * as React from 'react';

import HostInput from './host/host';
import Authentication from './authentication/authentication';

export class GeneralTab extends React.Component {
  render(): React.ReactNode {
    return (
      <React.Fragment>
        <HostInput />
        <Authentication />
      </React.Fragment>
    );
  }
}

export default GeneralTab;
