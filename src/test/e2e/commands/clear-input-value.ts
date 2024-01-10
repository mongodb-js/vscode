import { Key } from 'webdriverio';

// For some weird reasons the WebdriverIO.Element.clearValue does not work as
// expected which is why here we have a small workaround to do the same.
export const clearInputValue = async (
  browser: WebdriverIO.Browser,
  inputElement: WebdriverIO.Element
) => {
  await inputElement.waitForClickable();
  await inputElement.doubleClick();
  await browser.keys([Key.Ctrl, 'A']);
  await browser.keys(Key.Delete);
  await browser.waitUntil(
    async () => {
      const inputValue = await inputElement.getValue();
      return inputValue === '';
    },
    {
      timeoutMsg: 'Could not clear input',
    }
  );
};
