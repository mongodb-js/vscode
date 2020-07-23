import * as React from 'react';
// import classnames from 'classnames';
import { connect } from 'react-redux';

import { ActionTypes, LinkClickedAction } from '../../store/actions';
import { AppState } from '../../store/store';
import ChangeStreamEvent from './change-stream-event';

const styles = require('../../connect.module.less');

type stateProps = {
  changeStreamEvents: any[];
};

type dispatchProps = {
  onLinkClicked: (screen: string, linkId: string) => void;
};

type props = stateProps & dispatchProps;

class ChangeStreamViewer extends React.Component<props> {
  onLinkClicked = (screen: string, linkId: string): void => {
    this.props.onLinkClicked(screen, linkId);
  };

  render(): React.ReactNode {
    const {
      changeStreamEvents
    } = this.props;

    return (
      <div className={styles['change-stream']}>
        {(!changeStreamEvents || changeStreamEvents.length === 0) && (
          <h3>
            Listening for events...
          </h3>
        )}
        {changeStreamEvents.map(event => (
          <ChangeStreamEvent
            _id={event._id}
            operationType={event.operationType}
            data={event}
          />
        ))}
      </div>
    );
  }
}

const mapStateToProps = (state: AppState): stateProps => {
  return {
    changeStreamEvents: state.changeStreamEvents
  };
};

const mapDispatchToProps: dispatchProps = {
  onLinkClicked: (screen, linkId): LinkClickedAction => ({
    type: ActionTypes.EXTENSION_LINK_CLICKED,
    screen,
    linkId
  })
};

export default connect(mapStateToProps, mapDispatchToProps)(ChangeStreamViewer);
