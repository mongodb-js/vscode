const FEATURE_FLAGS = {
  useOldConnectionForm: `${process.env.MDB_USE_OLD_CONNECTION_FORM}` === 'true',
};

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

export const getFeatureFlag = (flag: FeatureFlag): boolean => {
  if (typeof window === 'object') {
    return (window as any).MDB_FEATURE_FLAGS?.[flag];
  }
  return FEATURE_FLAGS[flag];
};

export const getFeatureFlagsScript = (nonce: string): string => {
  return `
    <script nonce="${nonce}">window['MDB_FEATURE_FLAGS']=${JSON.stringify(
      FEATURE_FLAGS,
    )}</script>
  `;
};
