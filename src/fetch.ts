/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

'use strict';

import request = require('request');

export function fetch(uri: string, user: string, pass: string, method: string = 'GET'): Promise<request.Response> {
    let additionalProperties: Record<string, unknown> = {}

    if (user && pass) {
        additionalProperties = {
            auth: {
                user,
                pass,
                sendImmediately: false
            }
        }
    }

    return new Promise((resolve, reject) => {
        request({
            method,
            uri,
            ...additionalProperties
        }, function (error, response) {
            if (error) {
                reject(error);
            } else {
                resolve(response);
            }
        });
    });
}
