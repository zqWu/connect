/*!
 * Connect - HTTPServer
 * Copyright(c) 2010 Sencha Inc.
 * Copyright(c) 2011 TJ Holowaychuk
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var finalhandler = require('finalhandler');
var http = require('http');
var debug = require('debug')('connect:dispatcher');
var parseUrl = require('parseurl');

// prototype

var app = module.exports = {};

// environment

var env = process.env.NODE_ENV || 'development';

/* istanbul ignore next */
var defer = typeof setImmediate === 'function' ? setImmediate : function(fn) {
  process.nextTick(fn.bind.apply(fn, arguments))
}

/**
 * Utilize the given middleware `handle` to the given `route`,
 * defaulting to _/_. This "route" is the mount-point for the
 * middleware, when given a value other than _/_ the middleware
 * is only effective when that segment is present in the request's
 * pathname.
 *
 * For example if we were to mount a function at _/admin_, it would
 * be invoked on _/admin_, and _/admin/settings_, however it would
 * not be invoked for _/_, or _/posts_.
 *
 * @param {String|Function|Server} route, callback or server
 * @param {Function|Server} callback or server
 * @return {Server} for chaining
 * @api public
 */

app.use = function(route, fn) {
  // default route to '/'
  if ('string' != typeof route) {
    console.log('app.use::null route, use /');
    fn = route;
    route = '/';
  }

  // wrap sub-apps
  if ('function' == typeof fn.handle) {
    console.log('app.use::function==fn.handle');
    var server = fn;
    server.route = route;
    fn = function(req, res, next) {
      server.handle(req, res, next);
    };
  }

  // wrap vanilla http.Servers
  if (fn instanceof http.Server) {
    console.log('app.use::fn instanceof http.Server');
    fn = fn.listeners('request')[0];
  }

  // strip trailing slash
  if ('/' == route[route.length - 1]) {
    route = route.slice(0, -1);
    console.log('app.use::strip trailing slash,route=' + route);
  }

  // add the middleware
  debug('use %s %s', route || '/', fn.name || 'anonymous');
  console.log('app.use::push to stack[route,fn]');
  this.stack.push({
    route: route,
    handle: fn
  });

  return this;
};

/**
 * Handle server requests, punting them down
 * the middleware stack.
 *
 * @api private
 */

app.handle = function(req, res, out) {
  console.log('\n\napp.handle::' + req.url + ', out=' + out);

  var stack = this.stack,
    searchIndex = req.url.indexOf('?'),
    pathlength = searchIndex !== -1 ? searchIndex : req.url.length,
    fqdn = req.url[0] !== '/' && 1 + req.url.substr(0, pathlength).indexOf('://'),
    protohost = fqdn ? req.url.substr(0, req.url.indexOf('/', 2 + fqdn)) : '',
    removed = '',
    slashAdded = false,
    index = 0;

  // final function handler
  var done = out || finalhandler(req, res, {
    env: env,
    onerror: logerror
  });

  // store the original URL
  req.originalUrl = req.originalUrl || req.url;

  function next(err) {
    console.log('====================app.handle::next');
    console.log('slashAdded ', slashAdded);
    console.log('removed ', removed);
    console.log('stack index ', index);

    if (slashAdded) {
      req.url = req.url.substr(1);
      slashAdded = false;
    }

    if (removed.length !== 0) {
      req.url = protohost + removed + req.url.substr(protohost.length);
      removed = '';
    }

    // next callback
    var layer = stack[index++];

    // all done
    if (!layer) {
      console.log('all done');
      defer(done, err);
      return;
    }

    // route data
    var path = parseUrl(req).pathname || '/';
    var route = layer.route;

    // skip this layer if the route doesn't match
    if (path.toLowerCase().substr(0, route.length) !== route.toLowerCase()) {
      console.log('skip, route not match ,route=', route);
      return next(err);
    }

    // skip if route match does not border "/", ".", or end
    var c = path[route.length];
    if (c !== undefined && '/' !== c && '.' !== c) {
      console.log('skip, oute match does not border route=', route);
      return next(err);
    }

    // trim off the part of the url that matches the route
    if (route.length !== 0 && route !== '/') {
      removed = route;
      req.url = protohost + req.url.substr(protohost.length + removed.length);

      // ensure leading slash
      if (!fqdn && req.url[0] !== '/') {
        req.url = '/' + req.url;
        slashAdded = true;
      }
    }

    // call the layer handle
    console.log('call the layer handle');
    call(layer.handle, route, err, req, res, next);
  }

  next();
};

app.listen = function() {
  var server = http.createServer(this);
  return server.listen.apply(server, arguments);
};

/**
 * Invoke a route handle.
 *
 * @api private
 */

function call(handle, route, err, req, res, next) {
  var arity = handle.length;
  var hasError = Boolean(err);

  debug('%s %s : %s', handle.name || '<anonymous>', route, req.originalUrl);

  try {
    if (hasError && arity === 4) {
      // error-handling middleware
      handle(err, req, res, next);
      return;
    } else if (!hasError && arity < 4) {
      // request-handling middleware
      handle(req, res, next);
      return;
    }
  } catch (e) {
    // reset the error
    err = e;
  }

  // continue
  next(err);
}

/**
 * Log error using console.error.
 *
 * @param {Error} err
 * @api public
 */

function logerror(err) {
  if (env !== 'test') console.error(err.stack || err.toString());
}