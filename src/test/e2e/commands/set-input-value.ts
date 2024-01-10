import { clearInputValue } from './clear-input-value';

// For some weird reasons the WebdriverIO.Element.setValue never clears the
// input first and instead always appends the value which is why here we have a
// small workaround that first clears the value and then sets the value later.
export const setInputValue = async (
  browser: WebdriverIO.Browser,
  inputElement: WebdriverIO.Element,
  value: any
) => {
  await clearInputValue(browser, inputElement);
  await inputElement.setValue(value);
  await browser.waitUntil(
    async () => {
      const inputValue = await inputElement.getValue();
      return inputValue === value;
    },
    {
      timeoutMsg: 'Could not set value for the input',
    }
  );
};
