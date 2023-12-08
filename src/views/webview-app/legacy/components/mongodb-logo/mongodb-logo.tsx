import * as React from 'react';

import { MongoDBLogo as LeafyGreenMongoDBLogo } from '@mongodb-js/compass-components';

import styles from './mongodb-logo.less';

function MongoDBLogo() {
  return (
    <div className={styles['mdb-logo-container']}>
      <LeafyGreenMongoDBLogo color="green-base" />
    </div>
  );
}

export default MongoDBLogo;
