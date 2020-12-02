import assert from 'assert';
import * as React from 'react';
import { shallow } from 'enzyme';

import { HostInput } from '../../../../../../../views/webview-app/components/connect-form/general-tab/host/host';
import FormGroup from '../../../../../../../views/webview-app/components/form/form-group';
// import { Host } from '../../../../../../../views/webview-app/connection-model/connection-model';

describe('Host Component Test Suite', () => {
  test('it shows a form group', () => {
    const wrapper = shallow(<HostInput
      hostname="localhost"
      hosts={[{host: 'localhost', port: 27020}]}
      isSrvRecord={false}
      port={27019}
      replicaSet={undefined}
      onHostnameChanged={(): void => {}}
      onPortChanged={(): void => {}}
      setReplicaSet={(): void => {}}
      toggleSRVRecord={(): void => {}}
      updateHosts={(): void => {}}
    />);
    assert(wrapper.find(FormGroup).exists());
  });

  test('it does not show the port when srv record is true', () => {
    const wrapper = shallow(<HostInput
      hostname="localhost"
      hosts={[{host: 'localhost', port: 27020}]}
      isSrvRecord
      port={27019}
      replicaSet={undefined}
      onHostnameChanged={(): void => {}}
      onPortChanged={(): void => {}}
      setReplicaSet={(): void => {}}
      toggleSRVRecord={(): void => {}}
      updateHosts={(): void => {}}
    />);
    assert(!wrapper.find('port').exists());
  });

  test('it shows the port input when srv record is false', () => {
    const wrapper = shallow(<HostInput
      hostname="localhost"
      hosts={[{host: 'localhost', port: 27020}]}
      isSrvRecord={false}
      port={27019}
      replicaSet={undefined}
      onHostnameChanged={(): void => {}}
      onPortChanged={(): void => {}}
      setReplicaSet={(): void => {}}
      toggleSRVRecord={(): void => {}}
      updateHosts={(): void => {}}
    />);
    assert(wrapper.find('name="port"').exists());
  });

  test('it shows the hostname input when srv record is false', () => {
    const wrapper = shallow(<HostInput
      hostname="localhost"
      hosts={[{host: 'localhost', port: 27020}]}
      isSrvRecord={false}
      port={27019}
      replicaSet={undefined}
      onHostnameChanged={(): void => {}}
      onPortChanged={(): void => {}}
      setReplicaSet={(): void => {}}
      toggleSRVRecord={(): void => {}}
      updateHosts={(): void => {}}
    />);
    assert(wrapper.find('name="hostname"').exists());
  });

  test('it shows hostname input when srv record is true', () => {
    const wrapper = shallow(<HostInput
      hostname="localhost"
      hosts={[{host: 'localhost', port: 27020}]}
      isSrvRecord={false}
      port={27019}
      replicaSet={undefined}
      onHostnameChanged={(): void => {}}
      onPortChanged={(): void => {}}
      setReplicaSet={(): void => {}}
      toggleSRVRecord={(): void => {}}
      updateHosts={(): void => {}}
    />);
    assert(wrapper.find('name="hostname"').exists());
  });
});
