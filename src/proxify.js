var winevts = require("./events");

function Proxify(opts) {

    var ee = opts.emitter || function () {};

    return function proxify(target, hndlrs, tag) {

        var NOOP     = () => {},
            hndlrs   = hndlrs || {},
            handlers = {};

        tag = tag || "?";

        handlers._debug     = hndlrs.debug     || console.log;
        handlers._construct = hndlrs.construct || null;
        handlers._apply     = hndlrs.apply     || null;
        handlers._get       = hndlrs.get       || null;
        handlers._any       = hndlrs.any       || NOOP;
        handlers._emit      = hndlrs.emit      || NOOP;

        /*
         * =========================
         * Intercepts function calls
         * =========================
         */
        function apply (target, ctx, args) {

            handlers._debug(`[Proxy:${tag}] DEBUG apply: ${args}`);
            handlers._any("APPLY", ...arguments);

            if (handlers._apply) {
                return handlers._apply(...arguments);
            }
            else {
                return Reflect.apply(...argument);
            }
        }

        /*
         * ==========================
         * Intercepts property access
         * ==========================
         */
        function get (target, key) {

            ee.emit(winevts.DEBUG.property_access, {
                target : target,
                key    : key,
                tag    : tag
            });

            let key_exists = (target.hasOwnProperty(key) === true);
            handlers._debug(`[Proxy:${tag}] DEBUG get: ${key}, exists? ${key_exists}`);
            handlers._any("GET", ...arguments);

            if (! target.hasOwnProperty(key)) {
                ee.emit(winevts.DEBUG.error, new TypeError(
                    `[MISSING PROPERTY] ${tag} instance has no prop ${key}`
                ));
            }

            if (handlers._get) {
                return handlers._get(...arguments);
            }
            else {
                return target[key];
            }
        }

        /*
         * ======================
         * Intercepts 'new' calls
         * ======================
         */
        function construct (target, args) {

            handlers._any("CONSTRUCT", ...arguments);
            handlers._debug(`[Proxy:${tag}] DEBUG construct: ${args}`);

            if (handlers._construct) {
                return handlers._construct(...arguments);
            }
            else {
                return new target(...args);
            }
        }

        return new Proxy(target, { get, apply, construct });
    }
}

     
module.exports = Proxify;
