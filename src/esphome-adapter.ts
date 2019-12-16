/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

'use strict';

import { Adapter } from 'gateway-addon';
import { Browser, tcp } from 'dnssd';
import { isIPv4 } from 'net';
import { fetch } from './fetch';
import { parseTable } from './discovery';
import { BinarySensorDevice } from './binary-sensor-device';
import { SwitchDevice } from './switch-device';

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
            switch (deviceProperty.domain) {
              case 'binary_sensor': {
                const device = new BinarySensorDevice(this, this.manifest, name, host, deviceProperty);
                this.handleDeviceAdded(device);
                break;
              }
              case 'switch': {
                const device = new SwitchDevice(this, this.manifest, name, host, deviceProperty);
                this.handleDeviceAdded(device);
                break;
              }
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
