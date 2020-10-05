import * as React from 'react';
import { connect } from 'react-redux';
import { ActionTypes, LinkClickedAction } from '../../store/actions';

const styles = require('../../connect.module.less');

type dispatchProps = {
  onLinkClicked: (screen: string, linkId: string) => void;
};

type props = dispatchProps;

class OverviewHeader extends React.Component<props> {
  onLinkClicked = (screen: string, linkId: string): void => {
    this.props.onLinkClicked(screen, linkId);
  };

  render(): React.ReactNode {
    return (
      <div className={styles.overview}>
        <h2>MongoDB</h2>
        <div>
          Navigate your databases and collections, use playgrounds for queries and aggregations
          {/* TODO: Wording */}
        </div>
        <hr />
      </div>
    );
  }
}

const mapDispatchToProps: dispatchProps = {
  onLinkClicked: (screen, linkId): LinkClickedAction => ({
    type: ActionTypes.EXTENSION_LINK_CLICKED,
    screen,
    linkId
  })
};

export default connect(() => ({}), mapDispatchToProps)(OverviewHeader);
