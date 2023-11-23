import assert from 'assert';
import type { ShallowWrapper } from 'enzyme';
import { shallow } from 'enzyme';
import * as React from 'react';
import sinon from 'sinon';
import type { SinonSpy } from 'sinon';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMinus, faPlus } from '@fortawesome/free-solid-svg-icons';

import { HostInput } from '../../../../../../../../views/webview-app/legacy/components/connect-form/general-tab/host/host';
import FormGroup from '../../../../../../../../views/webview-app/legacy/components/form/form-group';
import RadioBoxGroup from '../../../../../../../../views/webview-app/legacy/components/form/radio-box-group/radio-box-group';

describe('Host Component Test Suite', () => {
  test('it shows a form group', () => {
    const wrapper = shallow(
      <HostInput
        hostname="localhost"
        hosts={[{ host: 'localhost', port: 27020 }]}
        isSrvRecord={false}
        port={27019}
        replicaSet={undefined}
        onHostnameChanged={(): void => {}}
        onPortChanged={(): void => {}}
        setReplicaSet={(): void => {}}
        toggleSRVRecord={(): void => {}}
        updateHosts={(): void => {}}
      />
    );
    assert(wrapper.find(FormGroup).exists());
  });

  test('it shows the three connection types (standalone, replicaset, srv)', () => {
    const wrapper = shallow(
      <HostInput
        hostname="localhost"
        hosts={[{ host: 'localhost', port: 27020 }]}
        isSrvRecord={false}
        port={27019}
        replicaSet={undefined}
        onHostnameChanged={(): void => {}}
        onPortChanged={(): void => {}}
        setReplicaSet={(): void => {}}
        toggleSRVRecord={(): void => {}}
        updateHosts={(): void => {}}
      />
    );
    assert(wrapper.find(RadioBoxGroup).exists());
    assert(
      wrapper.find(RadioBoxGroup).props().options[0].label === 'Standalone'
    );
    assert(
      wrapper.find(RadioBoxGroup).props().options[1].label === 'Replica Set'
    );
    assert(
      wrapper.find(RadioBoxGroup).props().options[2].label === 'SRV Record'
    );
  });

  describe('when there is no replicaSet and only one host', () => {
    let wrapper: ShallowWrapper;

    beforeEach(() => {
      wrapper = shallow(
        <HostInput
          hostname="localhost"
          hosts={[{ host: 'localhost', port: 27020 }]}
          isSrvRecord={false}
          port={27019}
          replicaSet={undefined}
          onHostnameChanged={(): void => {}}
          onPortChanged={(): void => {}}
          setReplicaSet={(): void => {}}
          toggleSRVRecord={(): void => {}}
          updateHosts={(): void => {}}
        />
      );
    });

    test('it shows the port input', () => {
      assert(wrapper.find('#port').exists());
    });

    test('it shows the hostname input', () => {
      assert(wrapper.find('#hostname').exists());
    });

    test('it shows a plus button to add a host', () => {
      assert(wrapper.find(FontAwesomeIcon).prop('icon') === faPlus);
    });

    describe('when add host is clicked', () => {
      let fakeSetReplicaSet: SinonSpy;
      let fakeUpdateHosts: SinonSpy;

      beforeEach(() => {
        fakeSetReplicaSet = sinon.fake.returns(undefined);
        fakeUpdateHosts = sinon.fake.returns(undefined);

        wrapper.setProps({
          setReplicaSet: fakeSetReplicaSet,
          updateHosts: fakeUpdateHosts,
        });

        wrapper.find('button').simulate('click', {
          preventDefault: () => {},
        });
      });

      test('it calls to set the replica set to a string', () => {
        assert(fakeSetReplicaSet.called);
        assert(fakeSetReplicaSet.firstCall.args[0] === '');
      });

      test('it calls to update hosts to add a new default host', () => {
        assert(fakeUpdateHosts.called);
        assert(fakeUpdateHosts.firstCall.args[0].length === 2);
        assert(fakeUpdateHosts.firstCall.args[0][1].host === 'localhost');
        assert(fakeUpdateHosts.firstCall.args[0][1].port === 27017);
      });
    });
  });

  describe('when there is a replicaSet or more than one host', () => {
    let wrapper: ShallowWrapper;

    beforeEach(() => {
      wrapper = shallow(
        <HostInput
          hostname="localhost"
          hosts={[{ host: 'localhost', port: 27020 }]}
          isSrvRecord={false}
          port={27019}
          replicaSet={''}
          onHostnameChanged={(): void => {}}
          onPortChanged={(): void => {}}
          setReplicaSet={(): void => {}}
          toggleSRVRecord={(): void => {}}
          updateHosts={(): void => {}}
        />
      );
    });

    test('it shows hostname input', () => {
      assert(wrapper.find('#host-name-0').exists());
    });

    test('it shows the port input', () => {
      assert(wrapper.find('#host-port-0').exists());
    });

    test('it shows a plus button to add a host', () => {
      assert(wrapper.find(FontAwesomeIcon).prop('icon') === faPlus);
    });

    test('it does not show a minus button to remove the host', () => {
      assert(wrapper.find(FontAwesomeIcon).length === 1);
    });

    describe('when there is more than one host', () => {
      beforeEach(() => {
        wrapper.setProps({
          hosts: [
            {
              host: 'underwaterhost',
              port: 27020,
            },
            {
              host: 'outerspacehost',
              port: 27029,
            },
          ],
        });
      });

      it('shows a minus button to remove the host', () => {
        assert(wrapper.find(FontAwesomeIcon).at(1).prop('icon') === faMinus);
      });

      it('shows host name input for each host', () => {
        assert(wrapper.find('#host-name-0').exists());
        assert(
          wrapper.find('#host-name-0').props().value === 'underwaterhost',
          `Expected '${wrapper
            .find('#host-name-0')
            .text()}' to equal 'underwaterhost'`
        );
        assert(wrapper.find('#host-name-1').exists());
        assert(wrapper.find('#host-name-1').props().value === 'outerspacehost');
      });

      it('shows host port input for each host', () => {
        assert(wrapper.find('#host-port-0').exists());
        assert(wrapper.find('#host-port-0').props().value === 27020);
        assert(wrapper.find('#host-port-1').exists());
        assert(wrapper.find('#host-port-1').props().value === 27029);
      });

      describe('when remove host is clicked', () => {
        let fakeUpdateHosts: SinonSpy;

        beforeEach(() => {
          fakeUpdateHosts = sinon.fake.returns(undefined);

          wrapper.setProps({
            updateHosts: fakeUpdateHosts,
          });

          wrapper
            .find('button')
            .at(1)
            .simulate('click', {
              preventDefault: () => {},
            });
        });

        test('it calls to update hosts to with one less host', () => {
          assert(fakeUpdateHosts.called);
          assert(fakeUpdateHosts.firstCall.args[0].length === 1);
          assert(
            fakeUpdateHosts.firstCall.args[0][0].host === 'outerspacehost'
          );
          assert(fakeUpdateHosts.firstCall.args[0][0].port === 27029);
        });
      });
    });
  });

  describe('when srvRecord is true', () => {
    let wrapper: ShallowWrapper;

    beforeEach(() => {
      wrapper = shallow(
        <HostInput
          hostname="localhost"
          hosts={[{ host: 'localhost', port: 27020 }]}
          isSrvRecord
          port={27019}
          replicaSet={undefined}
          onHostnameChanged={(): void => {}}
          onPortChanged={(): void => {}}
          setReplicaSet={(): void => {}}
          toggleSRVRecord={(): void => {}}
          updateHosts={(): void => {}}
        />
      );
    });

    test('it shows hostname input', () => {
      assert(wrapper.find('#hostname').exists());
    });

    test('it does not show the port input', () => {
      assert(!wrapper.find('#port').exists());
    });
  });
});
