import * as React from 'react';

type props = {
  children: React.ReactElement;
  store: any;
};

/**
 * Connects a store to a component where the store state matches
 * the component state.
 */
class StoreConnector extends React.Component<props, {}> {
  constructor(initalProps) {
    super(initalProps);

    this.state = initalProps.store.state;
  }

  /**
   * Subscribe to changes from the store.
   */
  componentDidMount(): void {
    this.unsubscribe = this.props.store.listen(this.setState.bind(this));
  }

  /**
   * Unsubscribe from changes to the store.
   */
  componentWillUnmount(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  unsubscribe?: () => void;

  /**
   * Render a shallow clone of the children and pass in the state as props.
   *
   * @return {React.Element} shallow clone of the child element.
   */
  render(): React.ReactNode {
    return React.cloneElement(this.props.children, this.state);
  }
}

export default StoreConnector;
