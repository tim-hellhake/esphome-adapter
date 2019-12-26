/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

'use strict';

import { Adapter, Device, Property } from 'gateway-addon';
import { fetch } from './fetch';
import { DeviceProperty } from './discovery';

interface BinarySensorResponse {
    id: string,
    state: string,
    value: boolean
}

class BinarySensorProperty extends Property {
    constructor(private device: Device, private manifest: any, private host: string, private id: String) {
        super(device, 'on', {
            '@type': 'BooleanProperty',
            type: 'boolean',
            title: 'On',
            description: 'The state of the sensor',
            readOnly: true
        });
    }

    public startPolling(intervalMs: number) {
        setInterval(() => this.poll(), intervalMs);
    }

    public async poll() {
        const {
            user,
            password
        } = this.manifest.moziot.config;

        const response = await fetch(`http://${this.host}/binary_sensor/${this.id}`, user, password);

        if (response.statusCode == 200) {
            const result: BinarySensorResponse = JSON.parse(response.body);
            this.update(result.value);
        } else {
            console.log(`Could not fetch status for ${this.device.name}#${this.title}: ${response.statusCode} (${response.statusMessage})`);
        }
    }

    update(value: boolean) {
        this.setCachedValueAndNotify(value);
    }
}

export class BinarySensorDevice extends Device {
    private binarysensorProperty: BinarySensorProperty;

    constructor(adapter: Adapter, manifest: any, id: string, host: string, deviceProperty: DeviceProperty) {
        super(adapter, `${id}_${deviceProperty.id}`);
        this['@context'] = 'https://iot.mozilla.org/schemas/';
        this['@type'] = ['BinarySensor'];
        this.name = `${deviceProperty.name} (${host})`;

        const {
            pollInterval
        } = manifest.moziot.config;

        this.binarysensorProperty = new BinarySensorProperty(this, manifest, host, deviceProperty.id);
        this.addProperty(this.binarysensorProperty);
        this.binarysensorProperty.startPolling(Math.max(pollInterval || 1000, 500));
    }

    addProperty(property: Property) {
        this.properties.set(property.name, property);
    }
}
