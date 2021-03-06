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
                  path = "HKEY_LOCAL_MACHINE\\foo\\bar";

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

        it("should support the use of spaces in paths", () => {

            const vreg = make_vreg(),
                  path = "HKLM\\AA\\Hello World\\foo";

            assert.doesNotThrow(() => vreg.write(path, "bar"));
            assert.equal(vreg.read(path), "bar");
        });

        it("should use 'HKLM' and 'HKEY_LOCAL_MACHINE' interchangeably", () => {

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

        it("should write a default value a path ends with a backslash", () => {

            const vreg = make_vreg(),
                  path = "HKLM\\aa\\bb\\foo\\";

            vreg.write(path, "this is the default");
            assert.equal(vreg.read(path), "this is the default");
        });

        it("should automatically create the path when given a valid root", () => {

            const vreg = make_vreg({
                exceptions: {
                    throw_native_vreg_subkey_not_exists: () => {
                        throw new Error("unknown path");
                    }
                }
            });

            const path = "HKLM\\Nothing\\here";
            assert.throws(() => vreg.read(path), "unknown path");

            assert.doesNotThrow(() => vreg.write(path, "hello, world!"));
            assert.equal(vreg.read(path), "hello, world!");
        });

        it("should throw 'invalid root' when trying to write an unknown root", () => {

            const vreg = make_vreg({
                exceptions: {
                    throw_native_vreg_invalid_root: () => {
                        throw new Error("Invalid root: HKAM_BLAH");
                    }
                }
            });

            assert.throws(
                () => vreg.write("HKAM_BLAH\\foo\\bar", "baz"),
                "Invalid root: HKAM_BLAH"
            );
        });
    });

    describe("#Resolve Key", () => {

        it("should create the path and return a the 'foo' key object", () => {

            const vreg  = make_vreg(),
                  path  = "HKLM\\System\\foo\\bar";

            const result = vreg.resolve_key(path, { create: true });

            assert.equal(result.path, path);
            assert.equal(result.value_label, "bar");
            assert.isNull(result.error);
            assert.equal(result.key.name, "foo");
        });

        it("should create and return a key obj when path ends with sep", () => {

            const vreg  = make_vreg(),
                  path  = "HKLM\\System\\foo\\";

            const result = vreg.resolve_key(path, { create: true });

            assert.equal(result.path, path);
            assert.equal(result.value_label, "");
            assert.equal(result.key.name, "foo");
            assert.isNull(result.error);
        });

        it("should not create paths by default", () => {

            const vreg  = make_vreg({
                exceptions: {
                    throw_native_vreg_subkey_not_exists: () => {
                        throw new Error("Cannot find subkey");
                    }
                }
            });

            const path = "HKLM\\System\\foo\\";
            assert.throws(() => vreg.resolve_key(path), "Cannot find subkey");
        });

        it("should return a resolved key object without a value label", () => {

            const vreg = make_vreg();
            vreg.write("HKLM\\System\\foo\\bar", "hello world");

            const keyobj = vreg.resolve_key("HKLM\\System\\foo\\");

            assert.isTrue(keyobj.hasOwnProperty("key"));
            assert.equal(keyobj.key.name, "foo");
            assert.equal(keyobj.path, "HKLM\\System\\foo\\");
            assert.equal(keyobj.value_label, "");
        });
    });

    describe("#Read", () => {

        it("should read the default value if the path ends in a backslash", () => {
            const vreg = make_vreg();

            // First, let's write a default value.
            vreg.write("HKLM\\foo\\bar\\", "baz");
            assert.equal(vreg.read("HKLM\\foo\\bar", "baz"));
        });

        it("should return the default value for a key which exists", () => {
            const vreg = make_vreg(),
                  path = "HKEY_LOCAL_MACHINE\\Foo\\bar\\";
            vreg.write(path, "World!");
            assert.equal(vreg.read(path), "World!");
        });

        it("should throw 'invalid root' when trying to read an unknown root", () => {
            const vreg = make_vreg({
                exceptions: {
                    throw_native_vreg_invalid_root: () => {
                        throw new Error("Invalid root: FOOBAR");
                    }
                }
            });
            assert.throws(() => vreg.read("FOOBAR\\baz"), "Invalid root: FOOBAR");
        });

        it("should throw when unable to open an non-existant registry key", () => {

            const path = "HKEY_LOCAL_MACHINE\\aa\\bb\\cc",
                  vreg = make_vreg({
                      exceptions: {
                          throw_native_vreg_subkey_not_exists: () => {
                              throw new Error("Cannot find subkey");
                          }
                      }
                  });

            assert.throws(() => vreg.read(path), `Cannot find subkey`);
        });
    });

    describe("#Delete", () => {

        it("should delete an existing value", () => {

            const vreg = make_vreg(),
                  path = "HKLM\\foo\\bar\\baz";

            vreg.write(path, "hello world");
            assert.equal(vreg.read(path), "hello world");
            assert.doesNotThrow(() => vreg.delete(path));
            assert.equal(vreg.read(path), undefined);
        });

        it("should delete an entire key if path ends with '\\'", () => {

            const vreg = make_vreg({
                exceptions: {
                    throw_native_vreg_subkey_not_exists: () => {
                        throw new Error("subkey not found");
                    }
                }
            });

            const path = "HKLM\\foo\\bar\\";

            vreg.write("HKLM\\foo\\bar\\default", "!default");
            vreg.write("HKLM\\foo\\bar\\hello",   "!world");
            vreg.write("HKLM\\foo\\bar\\boat",    "!train");

            assert.equal(vreg.read("HKLM\\foo\\bar\\default"), "!default");
            assert.equal(vreg.read("HKLM\\foo\\bar\\hello"), "!world");
            assert.equal(vreg.read("HKLM\\foo\\bar\\boat"), "!train");

            assert.doesNotThrow(() => vreg.delete(path));

            assert.throws(() => vreg.read("HKLM\\foo\\bar\\default"), "subkey not found");
            assert.throws(() => vreg.read("HKLM\\foo\\bar\\hello"),   "subkey not found");
            assert.throws(() => vreg.read("HKLM\\foo\\bar\\boat"),    "subkey not found");
        });

        it("should throw 'invalid root' if trying to delete root key", () => {

            const vreg = make_vreg({
                exceptions: {
                    throw_native_vreg_cannot_delete_root_key: () => {
                        throw new Error("Cannot delete root keys");
                    }
                }
            });

            vreg.write("HKLM\\foo\\bar\\default", "!default");
            vreg.write("HKLM\\foo\\bar\\hello",   "!world");
            vreg.write("HKLM\\foo\\bar\\boat",    "!train");

            assert.throws(() => vreg.delete("HKLM"), "Cannot delete root keys");
        });

        it("should throw when trying to delete an unknown value", () => {

            const vreg = make_vreg({
                exceptions: {
                    throw_native_vreg_subkey_not_exists: () => {
                        throw new Error("Cannot delete registry key");
                    }
                }
            });
            assert.throws(
                () => vreg.delete("HKLM\\foo\\bar\\baz"),
                "Cannot delete registry key"
            );
        });

        it("should throw when trying to delete an unknown subkey", () => {

            const vreg = make_vreg({
                exceptions: {
                    throw_native_vreg_subkey_not_exists: () => {
                        throw new Error("Cannot delete unknown key");
                    }
                }
            });

            assert.throws(
                () => vreg.delete("HKLM\\foo\\bar\\baz\\"),
                "Cannot delete unknown key"
            );
        });
    });

    describe("Check default hives", () => {

        it("should have a HKEY_LOCAL_MACHINE hive", () => {
            const vreg = make_vreg();

            let k1 = "HKEY_LOCAL_MACHINE\\foo\\bar",
                k2 = "HKEY_LOCAL_MACHINE\\fox\\bax";

            assert.doesNotThrow(() => vreg.write(k1, "baz"));
            assert.doesNotThrow(() => vreg.write(k2, "bad"));

            assert.equal(vreg.read(k1), "baz");
            assert.equal(vreg.read(k2), "bad");
        });

        it("should have a HKEY_CURRENT_USER hive", () => {
            const vreg = make_vreg();

            let k1 = "HKEY_CURRENT_USER\\foo\\bar",
                k2 = "HKCU\\fox\\bax";

            assert.doesNotThrow(() => vreg.write(k1, "baz"));
            assert.doesNotThrow(() => vreg.write(k2, "bad"));

            assert.equal(vreg.read(k1), "baz");
            assert.equal(vreg.read(k2), "bad");
        });

        it("should have a HKEY_CLASSES_ROOT hive", () => {
            const vreg = make_vreg();

            let k1 = "HKEY_CLASSES_ROOT\\foo\\bar",
                k2 = "HKCR\\fox\\bax";

            assert.doesNotThrow(() => vreg.write(k1, "baz"));
            assert.doesNotThrow(() => vreg.write(k2, "bad"));

            assert.equal(vreg.read(k1), "baz");
            assert.equal(vreg.read(k2), "bad");
        });

        it("should have a HKEY_USERS hive", () => {
            const vreg = make_vreg();

            let k1 = "HKEY_USERS\\foo\\bar",
                k2 = "HKU\\fox\\bax";

            assert.doesNotThrow(() => vreg.write(k1, "baz"));
            assert.doesNotThrow(() => vreg.write(k2, "bad"));

            assert.equal(vreg.read(k1), "baz");
            assert.equal(vreg.read(k2), "bad");
        });
    });
});
