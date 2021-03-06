const assert            = require("chai").assert;
const DrivesCollection  = require("../../src/winapi/DrivesCollection");
const VirtualFileSystem = require("../../src/runtime/virtfs");
const make_ctx = require("../testlib");

var ctx;

describe("DrivesCollection", () => {

    describe("Count", () => {

        it("should return '1' as we only support 'C:\\' at this time", () => {

            const ctx = make_ctx(),
                  dc = new DrivesCollection(ctx);

            assert.equal(dc.count, 1);
        });

        it("should throw 'invalid prop assignment' when trying to assign to .count", () => {

            const ctx = make_ctx({
                exceptions: {
                    throw_wrong_argc_or_invalid_prop_assign: () => {
                        throw new Error("cannot assign to .count");
                    }
                }
            });

            const dc = new DrivesCollection(ctx);
            assert.throws(() => dc.count = 4, "cannot assign to .count");
        });
    });


    describe("Item", () => {

        it("should return a Drive object for each valid C-drive specifier", () => {

            const ctx = make_ctx(),
                  dc  = new DrivesCollection(ctx);

            const valid_drive_names = [
                "c",
                "c:",
                "c:\\",
                "c:/",
                "C",
                "C:",
                "C:\\",
                "C:/"
            ];

            valid_drive_names.forEach(dn => {
                assert.doesNotThrow(() => dc.Item(dn));
                assert.equal(dc.Item(dn).path, "C:");
            });
        });

        it("should throw a 'device unavailable' if an unknown drive is requested", () => {

            const ctx = make_ctx({
                exceptions: {
                    throw_device_unavailable: () => {
                        throw new Error("no drive");
                    }
                }
            });

            const no_drives = [
                "a", "a:", "a:/", "a:\\",
                "b", "b:", "b:/", "b:\\",
                "x", "x:", "x:/", "x:\\"
            ];

            const dc = new DrivesCollection(ctx);
            no_drives.forEach(d => assert.throws(() => dc.Item(d), "no drive"));
        });
    });
});
