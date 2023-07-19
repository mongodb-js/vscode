import * as React from 'react';

import { MongoDBLogo as LeafyGreenMongoDBLogo } from '@leafygreen-ui/logo';

import styles from './mongodb-logo.less';

function MongoDBLogo() {
  return (
    <div className={styles['mdb-logo-container']}>
      <LeafyGreenMongoDBLogo color="green-base" />
    </div>
  );
}

export default MongoDBLogo;
