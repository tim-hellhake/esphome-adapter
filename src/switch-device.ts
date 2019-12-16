/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

'use strict';

import { Adapter, Device, Property } from 'gateway-addon';
import { fetch } from './fetch';
import { DeviceProperty } from './discovery';

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

export class SwitchDevice extends Device {
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
