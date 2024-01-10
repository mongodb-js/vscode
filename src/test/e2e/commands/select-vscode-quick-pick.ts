// To be used once we already have the quick pick opened
export const selectVsCodeQuickPick = async (
  browser: WebdriverIO.Browser,
  quickPickText: string,
  waitUntilGone = true
) => {
  const matchingQuickPicks = await browser.$$(
    '#quickInput_list .monaco-list-row'
  );
  const targetQuickPick =
    await matchingQuickPicks.find<WebdriverIO.Element | null>(
      async (quickPick) => {
        const quickPickLabel = await quickPick.getComputedLabel();
        if (
          quickPickLabel === quickPickText ||
          quickPickLabel.startsWith(quickPickText)
        ) {
          return true;
        }
        return false;
      }
    );

  await expect(targetQuickPick).not.toBe(null);
  await targetQuickPick?.click();
  if (waitUntilGone) {
    await browser.waitUntil(
      async () => {
        return !(await targetQuickPick?.isDisplayed());
      },
      {
        timeoutMsg: 'Quick pick still visible after selecting the quick pick',
      }
    );
  }
};
