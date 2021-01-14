import * as React from 'react';

import Divider from '../../form/divider/divider';
import HostInput from './host/host';
import Authentication from './authentication/authentication';

export class GeneralTab extends React.Component {
  render(): React.ReactNode {
    return (
      <React.Fragment>
        <HostInput />
        <Divider />
        <Authentication />
      </React.Fragment>
    );
  }
}

export default GeneralTab;
