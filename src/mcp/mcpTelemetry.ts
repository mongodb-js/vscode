import {
  AtlasTelemetry,
  type TelemetryCommonProperties,
  type TelemetryConfig,
} from '@mongodb-js/mcp-atlas-telemetry';
import { DEFAULT_TELEMETRY_APP_NAME } from '../connectionController';

/** Reports the VSCode hosting mode on every event. */
export class VSCodeAtlasTelemetry extends AtlasTelemetry {
  public constructor(config: TelemetryConfig) {
    super(config);
  }

  public override getCommonProperties(): TelemetryCommonProperties {
    return {
      ...super.getCommonProperties(),
      hosting_mode: DEFAULT_TELEMETRY_APP_NAME,
    };
  }

  public static createVSCodeTelemetry(
    config: TelemetryConfig,
  ): VSCodeAtlasTelemetry {
    const instance = new VSCodeAtlasTelemetry(config);
    void instance.setup();
    return instance;
  }
}
