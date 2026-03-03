eval( // First line so that the line numbers in assertions match.
  (() => {
    const {readFileSync} = require('fs');
    const filename = require('path').join(__dirname, 'test.js');
    let txt = readFileSync(filename, {encoding: 'utf-8'});
    function replaceSource(lineSource, lineReplacement) {
      if (!txt.includes(lineSource)) {
        throw new Error(`Line not found: ${lineSource}`);
      }
      txt = txt.replace(lineSource, lineReplacement);
    }
    // describe/it is stable since Node 20. Fall back to a minimal polyfill
    // for older versions.
    replaceSource(
      String.raw`import {describe, it} from 'node:test';`,
      String.raw`function describe(t,f){f()}function it(t,f){f()}`
    );
    replaceSource(
      String.raw`import assert from 'node:assert';`,
      String.raw`const assert = require('assert');`

    );
    replaceSource(
      String.raw`import {parse as parseUrl} from 'node:url';`,
      String.raw`const {parse: parseUrl} = require('url');`
    );
    // This is why we go through the effort at all: verify that require() works.
    replaceSource(
      String.raw`import {getProxyForUrl} from 'proxy-from-env';`,
      String.raw`const {getProxyForUrl} = require('proxy-from-env');`
    );
    if (process.version.startsWith('v10.')) {
      // Need to require directory instead of package name in Node 10 to avoid:
      // Error: Cannot find module 'proxy-from-env'
      replaceSource(
        String.raw`require('proxy-from-env');`,
        String.raw`require('.');`
      );
    }

    // URL.canParse was introduced in Node 18. Polyfill it, but only its usage
    // in tests so that we fail if the implementation were to rely on it.
    replaceSource(
      String.raw`URL.canParse(`,
      String.raw`(u=>{try{new URL(u);return true;}catch{return false;}})(`
    );

    txt +=
      String.raw`// The test is quiet by default, log something.
      console.log('Ran tests with require(proxy-from-env)');`;
    return txt;
  })()
);
