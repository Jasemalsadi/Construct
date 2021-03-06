const assert            = require("chai").assert;
const FoldersCollection = require("../../src/winapi/FoldersCollection");
const VirtualFileSystem = require("../../src/runtime/virtfs");
const make_ctx = require("../testlib");

describe("FoldersCollection", () => {

    describe("Count", () => {

        it("should return the correct count for folders in the collection", () => {

            const ctx = make_ctx();

            ctx.vfs.AddFolder("C:\\RootOne\\a");
            ctx.vfs.AddFolder("C:\\RootOne\\b");
            ctx.vfs.AddFolder("C:\\RootOne\\c");

            const fc = new FoldersCollection(ctx, "C:\\RootOne");

            assert.equal(fc.count, 3);
        });

        it("should return zero if there are no folders in the collection", () => {

            const ctx = make_ctx();

            ctx.vfs.AddFolder("C:\\RootOne");

            const fc = new FoldersCollection(ctx, "C:\\RootOne");

            assert.equal(fc.count, 0);
        });

        it("should update count if new folders are added after instantiation", () => {

            const ctx = make_ctx();

            ctx.vfs.AddFolder("C:\\RootOne");
            ctx.vfs.AddFolder("C:\\RootOne\\a");
            ctx.vfs.AddFolder("C:\\RootOne\\b");
            ctx.vfs.AddFolder("C:\\RootOne\\c");

            const fc = new FoldersCollection(ctx, "C:\\RootOne");
            assert.equal(fc.count, 3);

            // Add a new folder
            ctx.vfs.AddFolder("C:\\RootOne\\d");
            assert.equal(fc.count, 4);
        });
    });


    describe("Item", () => {

        it("should fetch the item by name", () => {
            const ctx = make_ctx();
            ctx.vfs.AddFile("C:\\RootOne\\SubFolder1\\a.txt");

            const fc = new FoldersCollection(ctx, "C:\\RootOne");
            assert.equal(fc.Item("SubFolder1").name, "SubFolder1");
        });

        it("should fetch the item by SFN", () => {
            const ctx = make_ctx();
            ctx.vfs.AddFolder("C:\\RootOne\\LongFoldername");

            const fc = new FoldersCollection(ctx, "C:\\RootOne");
            assert.equal(fc.Item("LONGFO~1").name, "LONGFO~1");
        });

        it("should throw a 'path not found' exception if the folder doesn't exist", () => {

            const ctx = make_ctx({
                exceptions: {
                    throw_path_not_found: () => {
                        throw new Error("folder not found");
                    }
                }
            });

            ctx.vfs.AddFile("C:\\RootOne\\SubFolder1\\a.txt");
            ctx.vfs.AddFile("C:\\RootOne\\SubFolder2\\b.txt");

            const fc = new FoldersCollection(ctx, "C:\\RootOne");
            assert.doesNotThrow(() => fc.Item("SubFolder1"));
            assert.throws(() => fc.Item("SubFolder3"), "folder not found");
        });

        it("should throw an 'invalid procedure call' exception if .Item arg is not string", () => {

            const ctx = make_ctx({
                exceptions: {
                    throw_invalid_fn_arg: () => {
                        throw new Error("not a string");
                    }
                }
            });

            ctx.vfs.AddFile("C:\\RootOne\\SubFolder1\\a.txt");

            const fc = new FoldersCollection(ctx, "C:\\RootOne\\");

            assert.equal(fc.count, 1);

            assert.throws(() => fc.Item(2),          "not a string");
            assert.throws(() => fc.Item(null),       "not a string");
            assert.throws(() => fc.Item(undefined),  "not a string");
            assert.throws(() => fc.Item([]),         "not a string");
            assert.throws(() => fc.Item({}),         "not a string");
            assert.throws(() => fc.Item(() => true), "not a string");
        });

        it("should throw if the backing folder is deleted", () => {

            const ctx = make_ctx({
                exceptions: {
                    throw_path_not_found: () => {
                        throw new Error("backing folder is gone");
                    }
                }
            });

            ctx.vfs.AddFile("C:\\RootOne\\SubFolder1\\a.txt");
            ctx.vfs.AddFile("C:\\RootOne\\SubFolder2\\b.txt");

            const fc = new FoldersCollection(ctx, "C:\\RootOne");
            assert.equal(fc.count, 2);

            assert.doesNotThrow(() => fc.Item("SubFolder1"));

            ctx.vfs.Delete("C:\\RootOne\\SubFolder1");
            assert.throws(() => fc.Item("SubFolder1"), "backing folder is gone");
        });
    });

    describe("#Add", () => {

        it("should add the folder to the current collection", () => {

            const ctx = make_ctx();

            ctx.vfs.AddFolder("C:\\RootOne\\SubFolder1\\foo");
            ctx.vfs.AddFolder("C:\\RootOne\\SubFolder1\\bar");

            const fc = new FoldersCollection(ctx, "C:\\RootOne\\SubFolder1");

            assert.equal(fc.count, 2);
            assert.isFalse(ctx.vfs.FolderExists("C:\\RootOne\\SubFolder1\\baz"));

            fc.Add("baz");
            assert.isTrue(ctx.vfs.FolderExists("C:\\RootOne\\SubFolder1\\baz"));
            assert.equal(fc.count, 3);
        });

        it("should throw 'path not found' if the path is relative 'c:foo'", () => {

            const ctx  = make_ctx({
                exceptions: {
                    throw_path_not_found: () => {
                        throw new Error("c: not allowed");
                    }
                }
            });

            const path = `${ctx.get_env("path")}\\foo`;
            ctx.vfs.AddFolder(path);

            const fc = new FoldersCollection(ctx, path);
            assert.throws(() => fc.Add("C:bar"), "c: not allowed");
        });

        it("should throw if trying to add a folder which already exists", () => {

            const ctx = make_ctx({
                exceptions: {
                    throw_file_already_exists: () => {
                        throw new Error("collision");
                    }
                }
            });

            ctx.vfs.AddFolder("C:\\RootOne\\SubFolder1\\foo");
            ctx.vfs.AddFolder("C:\\RootOne\\SubFolder1\\bar");

            const fc = new FoldersCollection(ctx, "C:\\RootOne\\SubFolder1");

            assert.equal(fc.count, 2);
            assert.throws(() => fc.Add("bar"), "collision");
        });

        it("should throw if the input to Add is invalid", () => {

            const ctx = make_ctx({
                exceptions: {
                    throw_invalid_fn_arg: () => {
                        throw new Error("bad input");
                    }
                }
            });

            ctx.vfs.AddFolder("C:\\RootOne");

            const fc = new FoldersCollection(ctx, "C:\\RootOne"),
                  bad_inputs = [
                      "",
                      "../"
                  ];

            bad_inputs.forEach(input => {
                assert.throws(() => fc.Add(input), "bad input");
            });
        });
    });
});
