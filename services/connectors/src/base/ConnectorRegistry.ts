import { IConnector, PortalSource, ConnectorRegistry as IConnectorRegistry } from '@licitapp/shared';
import { WherexConnector } from '../adapters/wherex/WherexConnector';
import { PortalMineroConnector } from '../adapters/portalminero/PortalMineroConnector';
import { SapAribaConnector } from '../adapters/sapariba/SapAribaConnector';
import { SicepConnector } from '../adapters/sicep/SicepConnector';
import { CoupaConnector } from '../adapters/coupa/CoupaConnector';
import { ChileCompraConnector } from '../adapters/chilecompra/ChileCompraConnector';

class ConnectorRegistry implements IConnectorRegistry {
  private readonly connectors: Map<PortalSource, IConnector> = new Map();

  constructor() {
    this.register(new WherexConnector());
    this.register(new PortalMineroConnector());
    this.register(new SapAribaConnector());
    this.register(new SicepConnector());
    this.register(new CoupaConnector());
    this.register(new ChileCompraConnector());
  }

  private register(connector: IConnector): void {
    this.connectors.set(connector.source, connector);
  }

  get(source: PortalSource): IConnector {
    const connector = this.connectors.get(source);
    if (!connector) throw new Error(`Connector not found for source: ${source}`);
    return connector;
  }

  getAll(): IConnector[] {
    return Array.from(this.connectors.values());
  }

  getEnabled(): IConnector[] {
    return this.getAll().filter((c) => c.config.enabled);
  }
}

export const registry = new ConnectorRegistry();
