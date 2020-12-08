import util from 'util';

const delay = util.promisify(setTimeout);

const MAX_TIMEOUT = 10000;

export const defer = (): [
  Promise<unknown>,
  () => void,
  () => void
] => {
  let resolve;
  let reject;
  const p = new Promise((_resolve, _reject) => {resolve = _resolve; reject = _reject;});
  return [p, resolve, reject];
}

export const ensureResult = async(timeout, getFn, testFn, failMsg): Promise<any> => {
  let result = await getFn();
  while(!testFn(result)) {
    console.log(`looping at timeout=${timeout}, result=${result}`);
    if (timeout > MAX_TIMEOUT) {
      throw new Error(`Waited for ${failMsg}, never happened`);
    }
    await delay(timeout);
    timeout *= 2; // try again but wait double
    result = await getFn();
  }
  return result;
};

