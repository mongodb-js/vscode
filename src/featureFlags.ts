export type FeatureFlag = 'useNewConnectionForm';
export type FeatureFlags = Record<FeatureFlag, boolean>;
export const getFeatureFlags = (): FeatureFlags => ({
  useNewConnectionForm: `${process.env.MDB_USE_NEW_CONNECTION_FORM}` === 'true',
});
