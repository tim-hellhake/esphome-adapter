# ESPHome Adapter

[![build](https://github.com/tim-hellhake/esphome-adapter/workflows/Build/badge.svg)](https://github.com/tim-hellhake/esphome-adapter/actions?query=workflow:Build)
[![dependencies](https://david-dm.org/tim-hellhake/esphome-adapter.svg)](https://david-dm.org/tim-hellhake/esphome-adapter)
[![devDependencies](https://david-dm.org/tim-hellhake/esphome-adapter/dev-status.svg)](https://david-dm.org/tim-hellhake/esphome-adapter?type=dev)
[![optionalDependencies](https://david-dm.org/tim-hellhake/esphome-adapter/optional-status.svg)](https://david-dm.org/tim-hellhake/esphome-adapter?type=optional)
[![license](https://img.shields.io/badge/license-MPL--2.0-blue.svg)](LICENSE)

Connect your [ESPHome](https://esphome.io/) devices.

## Configuration (if you enabled authentication)
1. Go to the addon config
2. Enter the same user/password as in the ESPHome config
3. If the ESPHome `api` is enabled enter the port of the `web_server` as `fallbackPort` in the config

## Prerequisites
1. The web server needs to be enabled (`web_server`)

## Limitations
* Currently only switches are supported.

## Example firmware for the Sonoff S20
```
esphome:
  name: <name of your choice>
  platform: ESP8266
  board: esp01_1m

wifi:
  ssid: <YOUR_SSID>
  password: <YOUR_PASSWORD>

logger:

ota:

web_server:
  port: 80
  auth:
    username: <USERNAME>
    password: <PASSWORD>

switch:
  - platform: gpio
    name: "Sonoff S20 Relay"
    pin: GPIO12
```
