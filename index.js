'use strict';

let parseUrl = require('url').parse;

let DEFAULT_PORTS = {
  ftp: 21,
  gopher: 70,
  http: 80,
  https: 443,
  ws: 80,
  wss: 443,
};

let stringEndsWith = String.prototype.endsWith || function(s) {
  return s.length <= this.length &&
    this.indexOf(s, this.length - s.length) !== -1;
};

/**
 * @param {string|object} url - The URL, or the result from url.parse.
 * @param {object} options - Additional options.
 * @param {boolean} [options.overrideNoProxy=true] - Whatever to override NO_PROXY lists or combine them.
 * @param {string|string[]} [options.additionalNoProxy=[]] - Additional custom NO_PROXY lists.
 * @return {string} The URL of the proxy that should handle the request to the
 *  given URL. If no proxy is set, this will be an empty string.
 */
function getProxyForUrl(url, options) {
  options = Object.assign({
    overrideNoProxy: true,
    additionalNoProxy: [],
  }, options);  // Default values

  let parsedUrl = typeof url === 'string' ? parseUrl(url) : url || {};
  let proto = parsedUrl.protocol;
  let hostname = parsedUrl.host;
  let port = parsedUrl.port;
  if (typeof hostname !== 'string' || !hostname || typeof proto !== 'string') {
    return '';  // Don't proxy URLs without a valid scheme or host.
  }

  proto = proto.split(':', 1)[0];
  // Stripping ports in this way instead of using parsedUrl.hostname to make
  // sure that the brackets around IPv6 addresses are kept.
  hostname = hostname.replace(/:\d*$/, '');
  port = parseInt(port) || DEFAULT_PORTS[proto] || 0;
  if (!shouldProxy(hostname, port, options.overrideNoProxy, options.additionalNoProxy)) {
    return '';  // Don't proxy URLs that match NO_PROXY.
  }

  let proxy =
    getEnv('npm_config_' + proto + '_proxy') ||
    getEnv(proto + '_proxy') ||
    getEnv('npm_config_proxy') ||
    getEnv('all_proxy');
  if (proxy && proxy.indexOf('://') === -1) {
    // Missing scheme in proxy, default to the requested URL's scheme.
    proxy = proto + '://' + proxy;
  }
  return proxy;
}

/**
 * Determines whether a given URL should be proxied.
 *
 * @param {string} hostname - The host name of the URL.
 * @param {number} port - The effective port of the URL.
 * @param {boolean} overrideNoProxy - Override NO_PROXY instead on merging.
 * @param {string|string[]} additionalNoProxy - Additional NO_PROXY values.
 * @returns {boolean} Whether the given URL should be proxied.
 * @private
 */
function shouldProxy(hostname, port, overrideNoProxy, additionalNoProxy) {
  if (typeof additionalNoProxy === 'string') {
    additionalNoProxy = [
      additionalNoProxy,
    ];
  }

  let defaultNoProxy = [
    getEnv('npm_config_no_proxy'),
    getEnv('no_proxy'),
  ];

  let noProxyList = [
    ...defaultNoProxy,
    ...additionalNoProxy,
  ];

  let NO_PROXY;
  
  if (overrideNoProxy) {
    // Behaviour from 1.1.0
    NO_PROXY = noProxyList
      .reduce((a, b) => a || b);
  } else {
    // Never proxy if wildcard is set in any of lists.
    if (noProxyList.indexOf('*') !== -1) {
      return false;
    }

    NO_PROXY = noProxyList
      .filter(item => !!item) // exclude empty items
      .join(',');
  }

  NO_PROXY = NO_PROXY.toLowerCase();

  if (!NO_PROXY) {
    return true;  // Always proxy if NO_PROXY is not set.
  }

  if (NO_PROXY === '*') {
    return false;  // Never proxy if wildcard is set.
  }

  return NO_PROXY.split(/[,\s]/).every(function(proxy) {
    if (!proxy) {
      return true;  // Skip zero-length hosts.
    }
    let parsedProxy = proxy.match(/^(.+):(\d+)$/);
    let parsedProxyHostname = parsedProxy ? parsedProxy[1] : proxy;
    let parsedProxyPort = parsedProxy ? parseInt(parsedProxy[2]) : 0;
    if (parsedProxyPort && parsedProxyPort !== port) {
      return true;  // Skip if ports don't match.
    }

    if (!/^[.*]/.test(parsedProxyHostname)) {
      // No wildcards, so stop proxying if there is an exact match.
      return hostname !== parsedProxyHostname;
    }

    if (parsedProxyHostname.charAt(0) === '*') {
      // Remove leading wildcard.
      parsedProxyHostname = parsedProxyHostname.slice(1);
    }
    // Stop proxying if the hostname ends with the no_proxy host.
    return !stringEndsWith.call(hostname, parsedProxyHostname);
  });
}

/**
 * Get the value for an environment letiable.
 *
 * @param {string} key - The name of the environment letiable.
 * @return {string} The value of the environment letiable.
 * @private
 */
function getEnv(key) {
  return process.env[key.toLowerCase()] || process.env[key.toUpperCase()] || '';
}

exports.getProxyForUrl = getProxyForUrl;
