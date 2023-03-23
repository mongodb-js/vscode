import * as React from 'react';

import { MongoDBLogo as LeafyGreenMongoDBLogo } from '@leafygreen-ui/logo';

import styles from './mongodb-logo.less';

class MongoDBLogo extends React.PureComponent {
  render(): React.ReactNode {
    return <LeafyGreenMongoDBLogo className={styles['mdb-logo-svg']} />;
  }
}

export default MongoDBLogo;
