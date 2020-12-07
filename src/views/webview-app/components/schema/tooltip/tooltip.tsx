import React from 'react';
import ReactTooltip from 'react-tooltip';

type props = {
  id: string;
  effect?: string;
  className?: string;
  place?: string;
  delayShow?: number;
};

class Tooltip extends React.Component<props> {
  static defaultProps = {
    place: 'right',
    effect: 'solid',
    className: 'hadron-tooltip',
    delayShow: 200
  };

  /**
   * Render the tooltip component.
   *
   * @returns {React.Component} The component.
   */
  render() {
    const {
      id,
      effect,
      className,
      place,
      delayShow
    } = this.props;

    return (
      <ReactTooltip
        id={id as any}
        effect={effect as any}
        className={className as any}
        place={place as any}
        delayShow={delayShow as any}
      />
    );
  }
}

export default Tooltip;
