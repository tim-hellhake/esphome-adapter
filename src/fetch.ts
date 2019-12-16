/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

'use strict';

import request = require('request');

export function fetch(uri: string, user: string, pass: string, method: string = 'GET'): Promise<request.Response> {
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
