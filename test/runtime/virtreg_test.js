const assert          = require("chai").assert;
const VirtualRegistry = require("../../src/runtime/virtreg");

function make_vreg (opts) {

    opts = opts || {};

    opts.exceptions  = opts.exceptions  || {};
    opts.environment = opts.environment || {};
    opts.config      = opts.config      || {};

    var default_env = {
        path: "C:\\Users\\Construct"
    };

    var default_cfg = {
        "autovivify": true
    };


    let env   = Object.assign({}, default_env, opts.environment),
        cfg   = Object.assign({}, default_cfg, opts.config),
        epoch = opts.epoch || 1234567890;

    let context = {
        epoch: epoch,
        ENVIRONMENT: env,
        CONFIG: cfg,
        emitter: { emit: () => {} },
        get_env: (e) => env[e],
        get_cfg: (c) => cfg[c]
    };

    let new_ctx = Object.assign({}, context, opts);

    return new VirtualRegistry(new_ctx);
}

describe("Virtual Registry", () => {

    describe("#Write", () => {

        it("should allow keys to be written.", () => {
            const vreg = make_vreg(),
                  path = "HKEY_LOCAL_MACHINE\\foo\\bar\\key";

            assert.doesNotThrow(() => vreg.write(path, "value!"));
            assert.equal(vreg.read(path), "value!");
        });

        it("should allow keys to be overwritten", () => {

            const vreg = make_vreg(),
                  path = "HKEY_LOCAL_MACHINE\\aa\\bb\\foo";

            assert.doesNotThrow(() => vreg.write(path, "bar!"));
            assert.equal(vreg.read(path), "bar!");

            assert.doesNotThrow(() => vreg.write(path, "testing"));
            assert.equal(vreg.read(path), "testing");
        });

        it("should allow 'HKLM' and 'HKEY_LOCAL_MACHINE' to be used interchangeably", () => {

            const vreg1     = make_vreg(),
                  vreg2     = make_vreg(),
                  short_key = "HKLM\\aa\\bb\\foo",
                  long_key  = "HKEY_LOCAL_MACHINE\\aa\\bb\\foo";

            // write(HKLM) -> read(HKEY_LOCAL_MACHINE)
            vreg1.write(short_key, "Hello, World!");
            assert.equal(vreg1.read(long_key), "Hello, World!");

            // write(HKEY_LOCAL_MACHINE) -> read(HKLM)
            vreg2.write(long_key, "Hello, World!");
            assert.equal(vreg2.read(short_key), "Hello, World!");
        });

        it("should ignore case differences between paths", () => {

            const vreg = make_vreg(),
                  path = "HKEY_LOCAL_MACHINE\\aa\\bb\\foo";

            vreg.write(path.toUpperCase(), "UPPER CASE");
            assert.equal(vreg.read(path.toLowerCase()), "UPPER CASE");
        });

        it("should allow writing a default value by sending a path which ends with a backslash", () => {

            const vreg = make_vreg(),
                  path = "HKLM\\aa\\bb\\foo\\";

            vreg.write(path, "this is the default");
            assert.equal(vreg.read(path), "this is the default");
        });
    });

    describe("#Read", () => {

        it("should return the default value for a key which exists", () => {
            const vreg = make_vreg(),
                  path = "HKEY_LOCAL_MACHINE\\System\\CurrentControlSet\\Hello\\";
            vreg.write(path, "World!");
            assert.equal(vreg.read(path), "World!");
        });
    });

    describe("#Delete", () => {});
});
