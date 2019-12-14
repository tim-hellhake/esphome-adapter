/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

'use strict';

import { Adapter, Device, Property } from 'gateway-addon';
import { Browser, tcp } from 'dnssd';
import { load } from 'cheerio';
import request = require('request');
import { isIPv4 } from 'net';

interface SwitchResponse {
  id: string,
  state: string,
  value: boolean
}

class SwitchProperty extends Property {
  private lastState?: boolean;

  constructor(private device: Device, private manifest: any, private host: string, private id: String) {
    super(device, 'on', {
      '@type': 'OnOffProperty',
      type: 'boolean',
      title: 'On',
      description: 'Wether the device is on or off'
    });
  }

  async setValue(value: boolean) {
    const {
      user,
      password
    } = this.manifest.moziot.config;

    try {
      console.log(`Set value of ${this.device.name} / ${this.title} to ${value}`);
      await super.setValue(value);

      const method = value ? 'turn_on' : 'turn_off';
      const response = await fetch(`http://${this.host}/switch/${this.id}/${method}`, user, password, 'POST');

      if (response.statusCode != 200) {
        console.log(`Could not set value: ${response.statusCode} (${response.statusMessage})`);
      }
    } catch (e) {
      console.log(`Could not set value: ${e}`);
    }
  }

  public startPolling(intervalMs: number) {
    setInterval(() => this.poll(), intervalMs);
  }

  public async poll() {
    const {
      user,
      password
    } = this.manifest.moziot.config;

    const response = await fetch(`http://${this.host}/switch/${this.id}`, user, password);

    if (response.statusCode == 200) {
      const result: SwitchResponse = JSON.parse(response.body);
      this.update(result.value);
    } else {
      console.log(`Could not fetch status for ${this.device.name}#${this.title}: ${response.statusCode} (${response.statusMessage})`);
    }
  }

  update(value: boolean) {
    if (this.lastState != value) {
      this.lastState = value;
      this.setCachedValue(value);
      this.device.notifyPropertyChanged(this);
      console.log(`Value of ${this.device.name}#${this.title} changed to ${value}`);
    }
  }
}

class SwitchDevice extends Device {
  private switchProperty: SwitchProperty;

  constructor(adapter: Adapter, manifest: any, id: string, host: string, deviceProperty: DeviceProperty) {
    super(adapter, `${id}_${deviceProperty.id}`);
    this['@context'] = 'https://iot.mozilla.org/schemas/';
    this['@type'] = ['SmartPlug'];
    this.name = `${deviceProperty.name} (${host})`;

    const {
      pollInterval
    } = manifest.moziot.config;

    this.switchProperty = new SwitchProperty(this, manifest, host, deviceProperty.id);
    this.addProperty(this.switchProperty);
    this.switchProperty.startPolling(Math.max(pollInterval || 1000, 500));
  }

  addProperty(property: Property) {
    this.properties.set(property.name, property);
  }
}

export class ESPHomeAdapter extends Adapter {
  private httpBrowser?: Browser;
  private apiBrowser?: Browser;
  private devices: { [key: string]: SwitchDevice } = {};

  constructor(addonManager: any, private manifest: any) {
    super(addonManager, manifest.display_name, manifest.id);
    addonManager.addAdapter(this);
    this.startDiscovery();
  }

  public startPairing(_timeoutSeconds: number) {
    console.log('Start pairing');
    this.startDiscovery();
  }

  public startDiscovery() {
    const {
      fallbackPort
    } = this.manifest.moziot.config;

    this.httpBrowser = new Browser(tcp('http'));
    this.apiBrowser = new Browser(tcp('esphomelib'));

    this.httpBrowser.on('serviceUp', async service => {
      const host = this.removeTrailingDot(service.host);
      console.log(`Discovered http service at ${host}`);
      const addresses: string[] = service?.addresses;
      this.handleService(host, addresses.filter(isIPv4)[0] || host, service.port);
    });

    this.apiBrowser.on('serviceUp', async service => {
      const host = this.removeTrailingDot(service.host);
      console.log(`Discovered api service at ${host}`);
      const addresses: string[] = service?.addresses;
      this.handleService(host, addresses.filter(isIPv4)[0] || host, fallbackPort || 80);
    });

    this.httpBrowser.start();
    this.apiBrowser.start();
  }

  private async handleService(name: string, host: string, port: number) {
    const {
      user,
      password
    } = this.manifest.moziot.config;

    const url = `${host}:${port}`;

    console.log(`Probing ${url}`);

    const result = await fetch(`http://${url}`, user, password);

    if (result.statusCode == 200) {
      const body = result.body;

      if (body.indexOf('ESPHome') >= 0) {
        console.log(`Discovered device ${name} at ${host}`);

        let device = this.devices[name];

        if (!device) {
          const deviceProperties = parseTable(body);
          console.log(`Found properties ${JSON.stringify(deviceProperties)} of ${name}`);

          for (const deviceProperty of deviceProperties) {
            if (deviceProperty.domain == 'switch') {
              const device = new SwitchDevice(this, this.manifest, name, host, deviceProperty);
              this.handleDeviceAdded(device);
            }
          }
        }
      } else {
        console.log(`${name} seems not to be an ESPHome device`);
      }
    } else {
      console.log(`${name} responded with ${result.statusCode}`);
    }
  }

  private removeTrailingDot(str: string) {
    if (str.length > 0 && str.lastIndexOf('.') === (str.length - 1)) {
      return str.substring(0, str.length - 1);
    }

    return str;
  }

  public cancelPairing() {
    console.log('Cancel pairing');

    if (this.httpBrowser) {
      this.httpBrowser.stop();
      this.httpBrowser = undefined;
    }

    if (this.apiBrowser) {
      this.apiBrowser.stop();
      this.apiBrowser = undefined;
    }
  }
}

function fetch(uri: string, user: string, pass: string, method: string = 'GET'): Promise<request.Response> {
  return new Promise((resolve, reject) => {
    request({
      method,
      uri,
      auth: {
        user,
        pass,
        sendImmediately: false
      }
    }, function (error, response) {
      if (error) {
        reject(error);
      } else {
        resolve(response);
      }
    });
  });
}

function parseTable(html: string): DeviceProperty[] {
  const $ = load(html);
  const rows = $('#states tbody tr');
  const properties: DeviceProperty[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const attributes = row.attribs;

    const property: DeviceProperty = {
      domain: attributes.class,
      id: attributes.id?.replace(`${attributes.class}-`, ''),
      name: getName(row) || attributes.id
    }

    if (!property.domain) {
      console.log('No domain attribute found');
      continue;
    }

    if (!property.id) {
      console.log('No id attribute found');
      continue;
    }

    properties.push(property);
  }

  return properties;
}

function getName(row: CheerioElement) {
  const columns = row.children;

  if (columns.length > 0) {
    const column = columns[0];

    if (column.children.length > 0) {
      return column.children[0].data;
    }
  }

  return undefined;
}

interface DeviceProperty {
  domain: string,
  id: string,
  name: string
}
