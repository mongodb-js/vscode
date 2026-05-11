import { getDeviceId as _getDeviceId } from '@mongodb-js/device-id';
import { machineId } from 'node-machine-id';

export function getDeviceId(abortSignal: AbortSignal): Promise<string> {
  return _getDeviceId({
    getMachineId: (): Promise<string> => machineId(true),
    abortSignal,
  });
}
