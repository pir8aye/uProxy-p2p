/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../third_party/typings/freedom/freedom-module-env.d.ts' />

import bridge = require('../bridge/bridge');
import logging = require('../logging/logging');
import loggingTypes = require('../loggingprovider/loggingprovider.types');
import net = require('../net/net.types');
import rtc_to_net = require('../rtc-to-net/rtc-to-net');
import socks_to_rtc = require('../socks-to-rtc/socks-to-rtc');
import tcp = require('../net/tcp');

const loggingController = freedom['loggingcontroller']();
loggingController.setDefaultFilter(loggingTypes.Destination.console,
                                   loggingTypes.Level.debug);

const log :logging.Log = new logging.Log('simple-socks');

const socksEndpoint:net.Endpoint = {
  address: '0.0.0.0',
  port: 9999
};

// Don't specify STUN servers because they aren't needed and can, in fact,
// present a problem when Simple SOCKS is running on a system behind a NAT
// without support for hair-pinning.
const pcConfig :freedom.RTCPeerConnection.RTCConfiguration = {
  iceServers: []
};

export const socksToRtc = new socks_to_rtc.SocksToRtc();
export const rtcToNet = new rtc_to_net.RtcToNet();

rtcToNet.start({
  allowNonUnicast: true
}, bridge.best('rtctonet', pcConfig)).then(() => {
  log.info('RtcToNet ready');
}, (e:Error) => {
  log.error('failed to start RtcToNet: %1', e.message);
});

// Must do this after calling start.
rtcToNet.signalsForPeer.setSyncHandler(socksToRtc.handleSignalFromPeer);

// Must do this before calling start.
socksToRtc.on('signalForPeer', rtcToNet.handleSignalFromPeer);

socksToRtc.start(new tcp.Server(socksEndpoint),
    bridge.best('sockstortc', pcConfig, undefined, {
      // See churn pipe source for the full list of transformer names.
      name: 'caesar'
    })).then((endpoint:net.Endpoint) => {
  log.info('SocksToRtc listening on %1', endpoint);
  log.info('curl -x socks5h://%1:%2 www.example.com',
      endpoint.address, endpoint.port);
}, (e:Error) => {
  log.error('failed to start SocksToRtc: %1', e.message);
});
