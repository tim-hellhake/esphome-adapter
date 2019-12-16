/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

'use strict';

import { load } from 'cheerio';

export interface DeviceProperty {
    domain: string,
    id: string,
    name: string
}

export function parseTable(html: string): DeviceProperty[] {
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
