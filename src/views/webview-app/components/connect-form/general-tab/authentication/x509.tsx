import * as React from 'react';
import { connect } from 'react-redux';

import type { X509UsernameChangedAction } from '../../../../store/actions';
import { ActionTypes } from '../../../../store/actions';
import FormInput from '../../../form/form-input';

type DispatchProps = {
  onX509UsernameChanged: (newUsername: string) => void;
};

type props = {
  x509Username?: string;
} & DispatchProps;

class X509 extends React.Component<props> {
  onUsernameChanged = (evt): void => {
    this.props.onX509UsernameChanged(evt.target.value.trim());
  };

  render(): React.ReactNode {
    const { x509Username } = this.props;

    return (
      <div>
        <FormInput
          label="Username"
          name="x509-username"
          changeHandler={this.onUsernameChanged}
          value={x509Username || ''}
        />
      </div>
    );
  }
}

const mapDispatchToProps: DispatchProps = {
  onX509UsernameChanged: (newUsername: string): X509UsernameChangedAction => ({
    type: ActionTypes.X509_USERNAME_CHANGED,
    x509Username: newUsername,
  }),
};

export default connect(null, mapDispatchToProps)(X509);
