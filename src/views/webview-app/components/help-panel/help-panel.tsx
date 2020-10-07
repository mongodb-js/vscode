import * as React from 'react';
import classnames from 'classnames';
import { connect } from 'react-redux';
import { ActionTypes, LinkClickedAction } from '../../store/actions';

const styles = require('./help-panel.less');

type DispatchProps = {
  onLinkClicked: (screen: string, linkId: string) => void;
};

type props = DispatchProps;

class HelpPanel extends React.Component<props> {
  onLinkClicked = (screen: string, linkId: string): void => {
    this.props.onLinkClicked(screen, linkId);
  };

  renderAtlasSvg(): React.ReactNode {
    return (
      <svg width="36px" height="36px" viewBox="0 0 36 36" version="1.1">
        <title>Atlas</title>
        <defs>
          <linearGradient
            x1="28.515977%"
            y1="105.584466%"
            x2="79.424121%"
            y2="-9.67572816%"
            id="linearGradient-1"
          >
            <stop stopColor="#0D6149" offset="0%" />
            <stop stopColor="#03AA4F" offset="36.97%" />
            <stop stopColor="#00D057" offset="64.96%" />
            <stop stopColor="#5FD891" offset="91.18%" />
            <stop stopColor="#80DBA5" offset="100%" />
          </linearGradient>
          <linearGradient
            x1="82.3061787%"
            y1="109.629126%"
            x2="7.44162975%"
            y2="-16.1830097%"
            id="linearGradient-2"
          >
            <stop stopColor="#0D6149" offset="0%" />
            <stop stopColor="#03AA4F" offset="36.97%" />
            <stop stopColor="#00D057" offset="64.96%" />
            <stop stopColor="#5FD891" offset="91.18%" />
            <stop stopColor="#80DBA5" offset="100%" />
          </linearGradient>
          <linearGradient
            x1="2.43172043%"
            y1="82.3204029%"
            x2="114.608065%"
            y2="-3.16314823%"
            id="linearGradient-3"
          >
            <stop stopColor="#0D6149" offset="0%" />
            <stop stopColor="#03AA4F" offset="36.97%" />
            <stop stopColor="#00D057" offset="64.96%" />
            <stop stopColor="#5FD891" offset="91.18%" />
            <stop stopColor="#80DBA5" offset="100%" />
          </linearGradient>
          <linearGradient
            x1="105.040323%"
            y1="85.5592964%"
            x2="-16.483871%"
            y2="-1.59363401%"
            id="linearGradient-4"
          >
            <stop stopColor="#0D6149" offset="0%" />
            <stop stopColor="#03AA4F" offset="36.97%" />
            <stop stopColor="#00D057" offset="64.96%" />
            <stop stopColor="#5FD891" offset="91.18%" />
            <stop stopColor="#80DBA5" offset="100%" />
          </linearGradient>
        </defs>
        <g
          id="Atlas"
          stroke="none"
          strokeWidth="1"
          fill="none"
          fillRule="evenodd"
        >
          <g id="Color-(1)" fillRule="nonzero">
            <path
              d="M23.6571428,21.6857142 C27.6,19.0285714 31.8,18.3428571 35.3142858,18.4285714 C35.3142858,18.1714286 35.3142858,17.9142857 35.3142858,17.6571429 C35.3142858,14.3142857 34.3714286,11.2285714 32.7428572,8.57142858 C30.2571428,8.82857142 27.6,9.51428572 25.0285714,11.3142857 C21.7714286,13.5428571 19.9714286,16.5428571 19.0285714,18.7714286 L19.0285714,26.2285714 C20.2285714,24.6857142 21.6857142,23.0571428 23.6571428,21.6857142 Z"
              id="Path"
              fill="url(#linearGradient-1)"
            />
            <path
              d="M19.0285714,13.8 C20.1428572,12.2571429 21.6857142,10.6285714 23.6571428,9.25714286 C26.1428572,7.54285714 28.6285714,6.68571428 31.1142858,6.25714286 C28.2,2.82857142 23.9142858,0.514285714 19.1142857,0.171428571 L19.1142857,13.8 L19.0285714,13.8 Z"
              id="Path"
              fill="#00804B"
            />
            <path
              d="M12,21.6857142 C13.9714286,23.0571428 15.4285714,24.6 16.6285714,26.2285714 L16.6285714,18.7714286 C15.6857143,16.5428571 13.8857143,13.5428571 10.6285714,11.3142857 C8.05714286,9.6 5.4,8.82857142 2.91428572,8.57142858 C1.28571429,11.2285714 0.342857142,14.3142857 0.342857142,17.6571429 C0.342857142,17.9142857 0.342857142,18.1714286 0.342857142,18.4285714 C3.85714286,18.3428571 8.05714286,19.0285714 12,21.6857142 Z"
              id="Path"
              fill="url(#linearGradient-2)"
            />
            <path
              d="M25.0285714,23.7428572 C21.7714286,25.9714286 19.9714286,28.9714286 19.0285714,31.2 L19.0285714,35.2285714 C27,34.7142858 33.5142858,28.7142858 34.9714286,21 C31.9714286,20.9142858 28.3714286,21.4285714 25.0285714,23.7428572 Z"
              id="Path"
              fill="url(#linearGradient-3)"
            />
            <path
              d="M16.6285714,31.2 C15.6857143,28.9714286 13.8857143,25.9714286 10.6285714,23.7428572 C7.28571428,21.4285714 3.68571429,20.9142858 0.685714286,21 C2.14285714,28.7142858 8.65714286,34.6285714 16.6285714,35.2285714 L16.6285714,31.2 Z"
              id="Path"
              fill="url(#linearGradient-4)"
            />
            <path
              d="M12,9.34285714 C13.9714286,10.7142857 15.4285714,12.2571429 16.6285714,13.8857143 L16.6285714,0.342857142 C11.8285714,0.685714286 7.54285714,2.91428572 4.62857142,6.42857142 C7.02857142,6.77142858 9.6,7.62857142 12,9.34285714 Z"
              id="Path"
              fill="#00804B"
            />
          </g>
        </g>
      </svg>
    );
  }

  render(): React.ReactNode {
    return (
      <div className={styles['help-panel']}>
        <div className={styles['help-container']}>
          <div className={styles['help-section']}>{this.renderAtlasSvg()}</div>
          <div className={styles['help-section']}>
            <p>
              <strong>New to MongoDB and don't have a cluster?</strong>
            </p>
          </div>
          <div className={styles['help-section']}>
            <p>
              If you don't already have a cluster you can create one for free
              using
              <a
                className={styles['help-link']}
                target="_blank"
                rel="noopener"
                href="https://www.mongodb.com/cloud/atlas"
                onClick={this.onLinkClicked.bind(
                  this,
                  'connectScreen',
                  'atlasLanding'
                )}
              >
                MongoDB Atlas
              </a>
            </p>
          </div>
          <div className={styles['help-section']}>
            <div>
              <a
                className={classnames(styles.btn, styles['btn-sm'])}
                target="_blank"
                rel="noopener"
                href="https://www.mongodb.com/cloud/atlas/register?utm_source=vscode&utm_medium=product&utm_campaign=VS%20code%20extension"
                onClick={this.onLinkClicked.bind(
                  this,
                  'connectScreen',
                  'freeClusterCTA'
                )}
              >
                Create Free Cluster
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

const mapDispatchToProps: DispatchProps = {
  onLinkClicked: (screen, linkId): LinkClickedAction => ({
    type: ActionTypes.EXTENSION_LINK_CLICKED,
    screen,
    linkId
  })
};

export default connect(() => ({}), mapDispatchToProps)(HelpPanel);
