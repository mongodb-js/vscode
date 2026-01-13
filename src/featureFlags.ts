const FEATURE_FLAGS: Record<string, boolean> = Object.assign(
  Object.create(null),
  {
    useEnhancedDataBrowsingExperience:
      process.env.MDB_USE_ENHANCED_DATA_BROWSING_EXPERIENCE === 'true',
  },
);

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

export const getFeatureFlag = (flag: FeatureFlag): boolean => {
  if (typeof window === 'object') {
    return (window as any).MDB_FEATURE_FLAGS?.[flag];
  }
  return FEATURE_FLAGS[flag];
};

export const setFeatureFlag = (flag: FeatureFlag, value: boolean): void => {
  FEATURE_FLAGS[flag] = value;
};

export const resetFeatureFlags = (): void => {
  FEATURE_FLAGS.useEnhancedDataBrowsingExperience =
    process.env.MDB_USE_ENHANCED_DATA_BROWSING_EXPERIENCE === 'true';
};

export const getFeatureFlagsScript = (nonce: string): string => {
  return `
    <script nonce="${nonce}">window['MDB_FEATURE_FLAGS']=${JSON.stringify(
      FEATURE_FLAGS,
    )}</script>
  `;
};
