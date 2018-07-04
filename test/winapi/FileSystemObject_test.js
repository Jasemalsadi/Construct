const assert = require("chai").assert;
const FSO = require("../../src/winapi/FileSystemObject");
const VirtualFileSystem = require("../../src/runtime/virtfs");

var ctx = null;

function MakeFSO (opts) {

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


    let env = Object.assign({}, default_env, opts.ENVIRONMENT),
        cfg = Object.assign({}, default_cfg, opts.config);

    let context = {
        epoch: 1,
        ENVIRONMENT: env,
        CONFIG: cfg,
        emitter: { emit: () => {} },
        exceptions: {},
        vfs: {},
        get_env: (e) => env[e],
        get_cfg: (c) => cfg[c]
    };

    let new_ctx = Object.assign({}, context, opts);

    let vfs = new VirtualFileSystem(new_ctx);
    new_ctx.vfs = vfs;

    // We set this just so code outside of this function can access
    // the created context object should it need to.
    ctx = new_ctx;

    return new FSO(new_ctx);
}

describe("Scripting.FileSystemObject", () => {

    describe("#BuildPath", () => {

        it("should build a path from two parts", () => {

            let fso = MakeFSO();

            assert.equal(fso.BuildPath("foo", "bar"), "foo\\bar");
            assert.equal(fso.BuildPath("\\\\foo\\bar", "testing\\test.txt"),
                         "\\\\foo\\bar\\testing\\test.txt");

        });

        it("should just combine the two parts, not check if they're valid", () => {

            let fso = MakeFSO();

            assert.equal(fso.BuildPath("C:\\foo\\bar", "../../../baz"),
                         "C:\\foo\\bar\\../../../baz");

        });
    });

    describe("#CopyFile", () => {

        it("should throw file not found if src file does not exist", () => {

            fso = MakeFSO({
                exceptions: {
                    throw_file_not_found: () => {
                        throw new Error("cannot find src file");
                    }
                }
            });

            assert.throws(() =>
                          fso.CopyFile("missing.txt", "foo.txt"),
                          "cannot find src file"
                         );


        });

        it("should throw path not found if the dest dir does not exist", () => {

            fso = MakeFSO({
                exceptions: {
                    throw_path_not_found: () => {
                        throw new Error("cannot find dest dir");
                    }
                }
            });

            ctx.vfs.AddFile("C:\\file.txt");
            assert.throws(() =>
                          fso.CopyFile("C:\\file.txt", "C:\\No\\Dir\\here.txt"),
                          "cannot find dest dir");
        });

        it("should throw if a file copy operation matches destination folder (ambiguous)", () => {

            let fso = MakeFSO({
                exceptions: {
                    throw_permission_denied: () => {
                        throw new Error("file copy is ambiguous");
                    }
                }
            });

            ctx.vfs.AddFile("C:\\Users\\Construct\\file_a.txt");
            ctx.vfs.AddFolder("C:\\Users\\Construct\\bar");

            assert.throws(() => fso.CopyFile(
                "C:\\Users\\Construct\\file_a.txt", "C:\\Users\\Construct\\bar"
            ), "file copy is ambiguous");
        });

        it("should copy in to a directory when a path ends with a trailing slash", () => {

            let fso = MakeFSO();

            ctx.vfs.AddFile("C:\\Users\\Construct\\file_a.txt");
            ctx.vfs.AddFolder("C:\\Users\\Construct\\bar");

            assert.isFalse(ctx.vfs.FileExists("C:\\Users\\Construct\\bar\\file_a.txt"));
            assert.isTrue(ctx.vfs.FileExists("C:\\Users\\Construct\\file_a.txt"));

            assert.doesNotThrow(() =>
                                fso.CopyFile("C:\\Users\\Construct\\file_a.txt",
                                             "C:\\Users\\Construct\\bar\\"));

            assert.isTrue(ctx.vfs.FileExists("C:\\Users\\Construct\\bar\\file_a.txt"));
        });

        it("should support copying wildcards", () => {

            const fso = MakeFSO();

            ctx.vfs.AddFolder("C:\\Users\\Construct\\source");
            ctx.vfs.AddFile("C:\\Users\\Construct\\source\\foo.txt");
            ctx.vfs.AddFile("C:\\Users\\Construct\\source\\bar.txt");
            ctx.vfs.AddFile("C:\\Users\\Construct\\source\\baz.txt");
            ctx.vfs.AddFile("C:\\Users\\Construct\\source\\fox.txt");
            ctx.vfs.AddFile("C:\\Users\\Construct\\source\\fff.txt");

            ctx.vfs.AddFolder("C:\\Users\\Construct\\dest");

            assert.deepEqual(ctx.vfs.FindFiles("C:\\Users\\Construct\\dest", "*"), []);

            fso.CopyFile("C:\\Users\\Construct\\source\\f??.txt", "C:\\Users\\Construct\\dest");

            assert.deepEqual(ctx.vfs.FindFiles("C:\\Users\\Construct\\dest", "*.txt").sort(),
                             ["foo.txt", "fox.txt", "fff.txt"].sort());
        });

        it("should copy a file and all SFN/LFN paths to it should be correct", () => {

            const fso = MakeFSO();

            ctx.vfs.AddFile("C:\\HelloWorld\\SubFolderA\\LongFilename.txt", "source file");
            ctx.vfs.AddFolder("C:\\dest");

            assert.isFalse(ctx.vfs.FileExists("C:\\dest\\LongFilename.txt"));
            assert.isFalse(ctx.vfs.FileExists("C:\\dest\\LONGFI~1.TXT"));

            fso.CopyFile("C:\\HELLOW~1\\SubFolderA\\LONGFI~1.TXT", "C:\\dest\\LongFilename.txt");

            assert.isTrue(ctx.vfs.FileExists("C:\\dest\\LONGFI~1.TXT"));

            // WHY DOES This FAIL?
            assert.isTrue(ctx.vfs.FileExists("C:\\dest\\LongFilename.txt"));
        });
    });

    describe("#CopyFolder", () => {

        it("should copy a folder from one place to another with all files", () => {

            const fso = MakeFSO({});

            ctx.vfs.AddFolder("C:\\source\\dir1");
            ctx.vfs.AddFile("C:\\source\\dir1\\foo.txt");

            ctx.vfs.AddFolder("C:\\dest");

            assert.isFalse(ctx.vfs.FolderExists("C:\\dest\\dir1"));
            assert.isFalse(ctx.vfs.FileExists("C:\\dest\\dir1\\foo.txt"));

            fso.CopyFolder("C:\\source\\dir1", "C:\\dest");

            assert.isTrue(ctx.vfs.FolderExists("C:\\dest\\dir1"));
            assert.isTrue(ctx.vfs.FileExists("C:\\dest\\dir1\\foo.txt"));
        });

        it("should copy all folders matching a wildcard expression", () => {

            const fso = MakeFSO();

            ctx.vfs.AddFolder("C:\\source\\dir1");
            ctx.vfs.AddFolder("C:\\source\\dir2");
            ctx.vfs.AddFolder("C:\\source\\dir3");
            ctx.vfs.AddFolder("C:\\source\\foo");

            ctx.vfs.AddFolder("C:\\source\\bar");

            ctx.vfs.AddFolder("C:\\dest");

            ctx.vfs.AddFile("C:\\source\\dir1\\foo.txt");
            ctx.vfs.AddFile("C:\\source\\dir2\\bar.txt");
            ctx.vfs.AddFile("C:\\source\\dir3\\baz.txt");

            assert.isFalse(ctx.vfs.FolderExists("C:\\dest\\dir1"));
            assert.isFalse(ctx.vfs.FolderExists("C:\\dest\\dir1"));
            assert.isFalse(ctx.vfs.FolderExists("C:\\dest\\dir1"));

            fso.CopyFolder("C:\\source\\dir?", "C:\\dest");

            assert.isTrue(ctx.vfs.FolderExists("C:\\dest\\dir1"));
            assert.isTrue(ctx.vfs.FolderExists("C:\\dest\\dir2"));
            assert.isTrue(ctx.vfs.FolderExists("C:\\dest\\dir3"));

            assert.isTrue(ctx.vfs.FileExists("C:\\dest\\dir1\\foo.txt"));
            assert.isTrue(ctx.vfs.FileExists("C:\\dest\\dir2\\bar.txt"));
            assert.isTrue(ctx.vfs.FileExists("C:\\dest\\dir3\\baz.txt"));

        });

        it("should correctly copy with no trailing separator on the destination path", () => {

            // From Chapter 10, P.280 "VBScript in a Nutshell" book.
            const fso = MakeFSO();

            ctx.vfs.AddFolder("C:\\RootOne\\SubFolder1");
            ctx.vfs.AddFolder("C:\\RootOne\\SubFolder2");
            ctx.vfs.AddFolder("C:\\RootTwo");

            fso.CopyFolder("C:\\RootOne\\*", "C:\\RootTwo");

            assert.isTrue(ctx.vfs.FolderExists("C:\\RootTwo\\SubFolder1"));
            assert.isTrue(ctx.vfs.FolderExists("C:\\RootTwo\\SubFolder2"));
        });

        it("should correctly copy with a trailing separator in to the destination", () => {

            // From Chapter 10, P.280 "VBScript in a Nutshell" book.

            const fso = MakeFSO();

            ctx.vfs.AddFolder("C:\\RootOne\\SubFolder1");
            ctx.vfs.AddFolder("C:\\RootOne\\SubFolder2");
            ctx.vfs.AddFolder("C:\\RootTwo");

            assert.isFalse(ctx.vfs.FolderExists("C:\\RootTwo\\RootOne"));
            assert.isFalse(ctx.vfs.FolderExists("C:\\RootTwo\\RootOne\\SubFolder1"));
            assert.isFalse(ctx.vfs.FolderExists("C:\\RootTwo\\RootOne\\SubFolder2"));

            assert.isFalse(ctx.vfs.FolderExists("C:\\RootTwo\\RootOne"));
            assert.isFalse(ctx.vfs.FolderExists("C:\\RootTwo\\RootOne\\SubFolder1"));
            assert.isFalse(ctx.vfs.FolderExists("C:\\RootTwo\\RootOne\\SubFolder2"));

            fso.CopyFolder("C:\\RootOne", "C:\\RootTwo\\");

            assert.isTrue(ctx.vfs.FolderExists("C:\\RootTwo\\RootOne"));
            assert.isTrue(ctx.vfs.FolderExists("C:\\RootTwo\\RootOne\\SubFolder1"));
            assert.isTrue(ctx.vfs.FolderExists("C:\\RootTwo\\RootOne\\SubFolder2"));
        });

        it("should throw if a wildcard character is used anywhere in the destination", () => {

            const fso = MakeFSO({
                exceptions: {
                    throw_invalid_fn_arg: () => {
                        throw new Error("no wildcards in dest path");
                    }
                }
            });

            ctx.vfs.AddFolder("C:\\RootOne\\SubFolder1");
            ctx.vfs.AddFolder("C:\\RootTwo");

            assert.throws(() => fso.CopyFolder("C:\\RootOne", "C:\\RootTwo*"),
                          "no wildcards in dest path");

            assert.throws(() => fso.CopyFolder("C:\\RootOne", "C:\\*\\RootTwo"),
                          "no wildcards in dest path");
        });

        it("should throw if source contains a wildcard which isn't the last part", () =>{

            const fso = MakeFSO({
                exceptions: {
                    throw_invalid_fn_arg: () => {
                        throw new Error("no wildcards in src dirname");
                    }
                }
            });

            ctx.vfs.AddFolder("C:\\RootOne\\SubFolder1");
            ctx.vfs.AddFolder("C:\\RootTwo");

            assert.throws(()=> fso.CopyFolder("C:\\*\\SubFolder1", "C:\\RootTwo"),
                          "no wildcards in src dirname");
        });

        it("should successfully copy to the root of the volume.", () => {

            const fso = MakeFSO();

            ctx.vfs.AddFolder("C:\\RootOne\\SubFolder1");

            assert.isFalse(ctx.vfs.FolderExists("C:\\SubFolder1"));
            fso.CopyFolder("C:\\RootOne\\SubFolder1", "C:\\");
            assert.isTrue(ctx.vfs.FolderExists("C:\\SubFolder1"));
        });

        it("should not throw when source and destination are the same", () => {

            const vfs = MakeFSO();

            ctx.vfs.AddFile("C:\\RootOne\\SubFolder1\\foo.txt");

            assert.doesNotThrow(() => vfs.CopyFolder("C:\\RootOne\\SubFolder1",
                                                     "C:\\RootOne\\SubFolder1"));
        });

        it("should recursively copy until source and dest paths are equal, then throw", () => {

            const vfs = MakeFSO({
                exceptions: {
                    throw_invalid_fn_arg: () => {
                        throw new Error("copy in to self not allowed");
                    }
                }
            });

            ctx.vfs.AddFolder("C:\\RootOne\\a");
            ctx.vfs.AddFolder("C:\\RootOne\\b");
            ctx.vfs.AddFolder("C:\\RootOne\\c");
            ctx.vfs.AddFolder("C:\\RootOne\\d");
            ctx.vfs.AddFolder("C:\\RootOne\\z");
            ctx.vfs.AddFile("C:\\RootOne\\a.txt");
            ctx.vfs.AddFile("C:\\RootOne\\b.txt");
            ctx.vfs.AddFile("C:\\RootOne\\a\\hi.txt");

            assert.throws(() =>
                          vfs.CopyFolder("C:\\RootOne\\*", "C:\\RootOne\\z"),
                          "copy in to self not allowed");

            assert.isTrue(ctx.vfs.FolderExists("C:\\RootOne\\z\\a"));
            assert.isTrue(ctx.vfs.FolderExists("C:\\RootOne\\z\\b"));
            assert.isTrue(ctx.vfs.FolderExists("C:\\RootOne\\z\\c"));
            assert.isTrue(ctx.vfs.FolderExists("C:\\RootOne\\z\\d"));
            assert.isTrue(ctx.vfs.FileExists("C:\\RootOne\\z\\a\\hi.txt"));

            // Doesn't copy these files, as the copy from rootone\z to
            // rootone\z throws.  This also ensures search order is
            // lexically ordered.
            assert.isFalse(ctx.vfs.FileExists("C:\\RootOne\\z\\a.txt"));
            assert.isFalse(ctx.vfs.FileExists("C:\\RootOne\\z\\b.txt"));
        });

        it("should throw if overwrite is false and a file already exists", () => {

            const fso = MakeFSO({
                exceptions: {
                    throw_file_already_exists: () => {
                        throw new Error("file exists");
                    }
                }
            });

            ctx.vfs.AddFile("C:\\RootOne\\SubFolder1\\a.txt");
            ctx.vfs.AddFile("C:\\RootOne\\SubFolder2\\b.txt");
            ctx.vfs.AddFile("C:\\RootOne\\SubFolder3\\c.txt");

            ctx.vfs.AddFile("C:\\RootTwo\\SubFolder2\\b.txt");

            assert.isFalse(ctx.vfs.FileExists("C:\\RootTwo\\SubFolder1\\a.txt"));
            assert.isFalse(ctx.vfs.FileExists("C:\\RootTwo\\SubFolder1\\c.txt"));

            assert.isTrue(ctx.vfs.FileExists("C:\\RootTwo\\SubFolder2\\b.txt"));

            assert.throws(() => fso.CopyFolder("C:\\RootOne\\*", "C:\\RootTwo", false),
                          "file exists");

            // It should have copied some files before the throw
            assert.isTrue(ctx.vfs.FileExists("C:\\RootTwo\\SubFolder1\\a.txt"));
            assert.isTrue(ctx.vfs.FileExists("C:\\RootTwo\\SubFolder2\\b.txt"));

            // But no files after...
            assert.isFalse(ctx.vfs.FileExists("C:\\RootTwo\\SubFolder3\\c.txt"));
        });

        it("should copy and all SFNs should resolve correctly", () => {

            const fso = MakeFSO();

            ctx.vfs.AddFile("C:\\HelloWorld\\SubFolderA\\LongFilename.txt", "source file");
            ctx.vfs.AddFolder("C:\\dest");

            fso.CopyFolder("C:\\HelloWorld", "C:\\dest");

            assert.isTrue(ctx.vfs.FileExists("C:\\dest\\HELLOW~1\\SUBFOL~1\\LongFilename.txt"));

            assert.isTrue(ctx.vfs.FolderExists("C:\\dest\\HELLOW~1\\SUBFOL~1"));
            assert.isTrue(ctx.vfs.FileExists("C:\\dest\\HELLOW~1\\SUBFOL~1\\LongFilename.txt"));
            assert.isTrue(ctx.vfs.FileExists("C:\\dest\\HELLOW~1\\SUBFOL~1\\LONGFI~1.TXT"));

            // Let's change the contents of the file and make sure the
            // link points to the copy not the original.
            ctx.vfs.AddFile("C:\\dest\\HELLOW~1\\SUBFOL~1\\LONGFI~1.TXT", "testing...");
        });

        it("should copy to paths which contain '/../'", () => {

            const fso = MakeFSO();

            ctx.vfs.AddFile("C:\\HelloWorld\\SubFolderA\\LongFilename.txt", "source file");
            ctx.vfs.AddFolder("C:\\dest");

            fso.CopyFolder("C:\\HelloWorld\\SubFolderA\\..", "C:\\dest");

            assert.isTrue(ctx.vfs.FolderExists("C:\\dest\\HelloWorld\\SubFolderA"));
            assert.isTrue(ctx.vfs.FileExists("C:\\dest\\HelloWorld\\SubFolderA\\longfilename.txt"));
        });
    });

    describe("#CreateFolder", () => {

        it("should successfully create and return a Folder instance", () => {

            let fso = MakeFSO();
            assert.isFalse(ctx.vfs.FolderExists("C:\\foo\\bar"));

            let dir = fso.CreateFolder("C:\\foo\\bar");

            assert.equal(dir.name, "bar");
            assert.equal(dir.path, "C:\\foo\\bar");
        });

        it("should throw if the folder already exists", () => {

            let fso = MakeFSO({
                exceptions: {
                    throw_file_already_exists: () => {
                        throw new Error("folder exists");
                    }
                }
            });

            ctx.vfs.AddFolder("C:\\RootOne");
            assert.isTrue(ctx.vfs.FolderExists("C:\\RootOne"));
            assert.throws(() => fso.CreateFolder("C:\\RootOne"), "folder exists");
        });

        it("should create a folder in the CWD if only a foldername is given", () => {

            const fso = MakeFSO();

            // CWD is ctx.get_env("path") == "C:\Users\Construct".
            assert.isFalse(ctx.vfs.FolderExists("C:\\Users\\Construct\\RootOne"));

            fso.CreateFolder("RootOne");
            assert.isTrue(ctx.vfs.FolderExists("C:\\Users\\Construct\\RootOne"));
        });

        it("should correctly handle relative paths", () => {

            const fso = MakeFSO();

            // CWD is ctx.get_env("path") == "C:\Users\Construct".
            assert.isFalse(ctx.vfs.FolderExists("C:\\Users\\RootOne"));

            fso.CreateFolder("..\\RootOne");
            assert.isTrue(ctx.vfs.FolderExists("C:\\Users\\RootOne"));
        });

        it("should throw 'type mismatch' for a null argument", () => {

            const fso = MakeFSO({
                exceptions: {
                    throw_type_mismatch: () => {
                        throw new Error("null is type mismatch");
                    }
                }
            });

            assert.throws(() => fso.CreateFolder(null), "null is type mismatch");
        });

        it("should throw 'invalid procedure call or argument' for non-string arguments", () => {

            const fso = MakeFSO({
                exceptions: {
                    throw_invalid_fn_arg: () => {
                        throw new Error("bad foldername");
                    }
                }
            });

            let bad_file_names = [
                "",
                undefined
            ];

            bad_file_names.forEach(
                (f) => assert.throws(() => fso.CreateFolder(f), "bad foldername")
            );
        });

        it("should create a folder named '1' if the Number 1 is given as a folder name", () => {

            const fso = MakeFSO();

            assert.isFalse(ctx.vfs.FolderExists("C:\\Users\\Construct\\1"));

            fso.CreateFolder(1);
            assert.isTrue(ctx.vfs.FolderExists("C:\\Users\\Construct\\1"));
        });

        it("should create a folder named '[Object object]' for folder name param '{}'", () => {

            const fso = MakeFSO();
            assert.isFalse(ctx.vfs.FolderExists("C:\\Users\\Construct\\[Object object]"));
            fso.CreateFolder({});
            assert.isTrue(ctx.vfs.FolderExists("C:\\Users\\Construct\\[object Object]"));
        });

        it("should throw 'bad filename or number' if the path param is invalid", () => {

            const fso = MakeFSO({
                exceptions: {
                    throw_bad_filename_or_number: () => {
                        throw new Error("bad filename");
                    }
                }
            });

            let bad_path_names = [
                "c/a:b",
                null,
                [],
                "foo*"
            ];

            bad_path_names.forEach(p => assert.throws(() => fso.CreateFolder(p)));
        });
    });

    xdescribe("#CreateTextFile", () => {

        it("should throw 'bad filename or number' if a wildcard appears in the filename", () => {

            let fso = MakeFSO({
                exceptions: {
                    throw_bad_filename_or_number: () => {
                        throw new Error("wildcards not permitted");
                    }
                }});

            assert.throws(() => fso.CreateTextFile("foo*.txt"),       "wildcards not permitted");
            assert.throws(() => fso.CreateTextFile("C:\\foo>.txt"),   "wildcards not permitted");
            assert.throws(() => fso.CreateTextFile("C:\\*\\foo.txt"), "wildcards not permitted");


        });

        it("should throw if overwriting is is disabled", () => {

            let fso = MakeFSO({
                exceptions: {
                    throw_file_already_exists: () => {
                        throw new Error("file exists...");
                    }
                }
            });

            ctx.vfs.AddFile("C:\\file.txt", "abcd");
            const OVERWRITE = false;
            assert.throws(() => fso.CreateTextFile("C:\\file.txt", OVERWRITE), "file exists...");
            assert.equal(ctx.vfs.GetFile("C:\\file.txt").contents, "abcd");


        });

        it("should create the text file in the CWD if no path is given", () => {

            let fso = MakeFSO();

            assert.isFalse(ctx.vfs.GetFile("C:\\Users\\Construct\\file.txt"));
            fso.CreateTextFile("file.txt");
            assert.equal(
                ctx.vfs.GetFile("C:\\Users\\Construct\\file.txt").constructor.name, "FileObject"
            );
        });

        it("should create a file even if the path is partial", () => {

            let fso = new FSO(ctx);

            assert.isFalse(ctx.vfs.GetFile("C:\\relative.txt"));
            fso.CreateTextFile("../../relative.txt");
            assert.equal(ctx.vfs.GetFile("C:\\relative.txt").constructor.name, "FileObject");


        });

        it("should throw if the filepath does not exist", () => {

            let fso = MakeFSO({
                exceptions: {
                    throw_path_not_found: () => {
                        throw new Error("path not found (av:false)");
                    }
                },
                config: { autovivify: false } });

            assert.throws(
                () => fso.CreateTextFile("C:\\bogus\\path.txt"), "path not found (av:false)"
            );


        });

        it("should return a TextStream instance", () => {

            let fso = MakeFSO(),
                ts  = fso.CreateTextFile("file.txt");

            let ts_api = [
                "Read", "ReadAll", "ReadLine", "Skip", "SkipLine",
                "Write", "WriteBlankLines", "WriteLine"
            ];

            ts_api.forEach((method) => assert.isFunction(ts[method]));


        });

        it("should open a text file and then fail to write to it by default", () => {

            ctx.vfs.AddFile("C:\\file.txt", "Hello, World!");

            let fso = MakeFSO();

            var ts;
            assert.doesNotThrow(() => ts = fso.CreateTextFile("C:\\file.txt"));
            assert.doesNotThrow(() => ts.write("overwrite successful"));

            assert.equal(ctx.vfs.GetFile("C:\\file.txt").contents, "overwrite successful");


        });

        it("should write unicode if signalled to do so", () => {

            let fso = MakeFSO(),
                ts  = fso.CreateTextFile("C:\\unicode.txt", true, true);

            ts.Write("7-bit ASCII or GTFO...");

            let filebuf = ctx.vfs.GetFile("C:\\unicode.txt").contents;

            assert.deepEqual(
                filebuf.slice(0, 8),
                Buffer.from([
                    0xFF, // BOM
                    0xFE, // BOM
                    0x37, // '7'
                    0x00, //
                    0x2d, // '-'
                    0x00, //
                    0x62, // 'b'
                    0x00, //
                ])
            );
        });
    });

    describe("#DeleteFile", () => {

        it("should delete the file given in the supplied filespec", () => {

            const fso = MakeFSO();

            ctx.vfs.AddFile("C:\\RootOne\\SubDir1\\foo.txt");
            assert.isTrue(ctx.vfs.FileExists("C:\\RootOne\\SubDir1\\foo.txt"));

            fso.DeleteFile("C:\\RootOne\\SubDir1\\foo.txt");
            assert.isFalse(ctx.vfs.FileExists("C:\\RootOne\\SubDir1\\foo.txt"));
        });

        it("should delete all files matching the wildcard expression", () => {

            const fso = MakeFSO();

            ctx.vfs.AddFile("C:\\RootOne\\foo_1.txt");
            ctx.vfs.AddFile("C:\\RootOne\\foo_2.txt");
            ctx.vfs.AddFile("C:\\RootOne\\bar.txt");

            fso.DeleteFile("C:\\RootOne\\foo*.txt");

            assert.isFalse(ctx.vfs.FileExists("C:\\RootOne\\foo_1.txt"));
            assert.isFalse(ctx.vfs.FileExists("C:\\RootOne\\foo_2.txt"));
            assert.isTrue(ctx.vfs.FileExists("C:\\RootOne\\bar.txt"));
        });

        it("should not throw 'file not found' if no files match", () => {

            const fso = MakeFSO({
                exceptions: {
                    throw_file_not_found: () => {
                        throw new Error("no files match");
                    }
                }
            });

            ctx.vfs.AddFile("C:\\RootOne\\foo_1.txt");
            ctx.vfs.AddFile("C:\\RootOne\\foo_2.txt");
            ctx.vfs.AddFile("C:\\RootOne\\bar.txt");

            assert.throws(() => fso.DeleteFile("C:\\RootOne\\nomatch*.txt"), "no files match");
        });

        it("should throw 'bad filename or number' if non-filepart contains a wildcard", () => {

            const fso = MakeFSO({
                exceptions: {
                    throw_bad_filename_or_number: () => {
                        throw new Error("no wildcards");
                    }
                }
            });

            assert.throws(() => fso.DeleteFile("C:\\Users\\Construct\\*\\Desktop\\blah.txt"),
                          "no wildcards");
        });

        it("should delete the file if the filename is literal", () => {

            const fso = MakeFSO();

            ctx.vfs.AddFile("C:\\RootOne\\foo.txt");
            assert.doesNotThrow(() => fso.DeleteFile("C:\\RootOne\\foo.txt"));
            assert.isFalse(ctx.vfs.FileExists("C:\\RootOne\\foo.txt"));
        });

        it("should delete files in the CWD if the path is relative", () => {

            const fso  = MakeFSO(),
                  file = ctx.get_env("path") + "\\foo.txt";

            ctx.vfs.AddFile(file);
            assert.isTrue(ctx.vfs.FileExists(file));

            fso.DeleteFile(file);
            assert.isFalse(ctx.vfs.FileExists(file));
        });

        it("should do the right thing when deleting from the root", () => {

            const fso = MakeFSO({
                ENVIRONMENT: { path: "C:\\" }
            });

            ctx.vfs.AddFile("C:\\foo.txt");
            assert.isTrue(ctx.vfs.FileExists("C:\\foo.txt"));

            fso.DeleteFile("C:\\foo.txt");
            assert.isFalse(ctx.vfs.FileExists("C:\\foo.txt"));
        });

        it("should throw 'bad filename or number' if the path is invalid", () => {

            const fso = MakeFSO({
                exceptions: {
                    throw_bad_filename_or_number: () => {
                        throw new Error("invalid filename");
                    }
                }
            });

            assert.throws(() => fso.DeleteFile(":.*"), "invalid filename");
        });

        it("should do nothing when the file to delete is a folder", () => {

            const fso  = MakeFSO(),
                  path = "C:\\RootOne\\SubDir1";

            ctx.vfs.AddFolder(path);
            assert.doesNotThrow(() => fso.DeleteFile(path));
            assert.isTrue(ctx.vfs.FolderExists(path));
        });
    });

    describe("#DeleteFolder", () => {

        it("should successfully delete a folder", () => {

            const fso = MakeFSO();

            ctx.vfs.AddFolder("C:\\RootOne\\SubDir1");
            assert.isTrue(ctx.vfs.FolderExists("C:\\RootOne\\SubDir1"));

            fso.DeleteFolder("C:\\RootOne\\SubDir1");
            assert.isFalse(ctx.vfs.FolderExists("C:\\RootOne\\SubDir1"));
        });

        it("should delete all folders (empty/not empty) which match PATTERN", () => {

            const fso = MakeFSO();

            ctx.vfs.AddFile("C:\\RootOne\\Subdir1\\foo\\bar.txt");
            ctx.vfs.AddFile("C:\\RootOne\\SubDir2\\baz.txt");
            ctx.vfs.AddFolder("C:\\RootOne\\foo");

            assert.isTrue(ctx.vfs.FolderExists("C:\\RootOne\\Subdir1"));
            assert.isTrue(ctx.vfs.FolderExists("C:\\RootOne\\Subdir2"));

            fso.DeleteFolder("C:\\RootOne\\SubDir*");

            assert.isFalse(ctx.vfs.FolderExists("C:\\RootOne\\Subdir1"));
            assert.isFalse(ctx.vfs.FolderExists("C:\\RootOne\\Subdir2"));
        });

        it("should throw 'Path not found' if the folder does not exist", () => {

            const fso = MakeFSO({
                exceptions: {
                    throw_path_not_found: () => {
                        throw new Error("no path found");
                    }
                }
            });

            assert.throws(() => fso.DeleteFolder("C:\\Does\\Not\\Exist"), "no path found");
        });

        it("should throw 'Path not found' if the wildcard expr matches zero folders", () => {

            const fso = MakeFSO({
                exceptions: {
                    throw_path_not_found: () => {
                        throw new Error("Wildcard matched nothing");
                    }
                }
            });

            ctx.vfs.AddFolder("C:\\RootOne\\SubDir1\\foo");
            ctx.vfs.AddFolder("C:\\RootOne\\SubDir2\\bar");
            ctx.vfs.AddFolder("C:\\RootOne\\SubDir3\\baz");

            assert.throws(() => fso.DeleteFolder("C:\\RootOne\\foo*"), "Wildcard matched nothing");
        });

        it("should handle relative deletes from the CWD of the process", () => {

            const fso = MakeFSO();

            ctx.vfs.AddFolder(`${ctx.get_env("path")}\\foo`);
            ctx.vfs.AddFolder(`${ctx.get_env("path")}\\fox`);
            ctx.vfs.AddFolder(`${ctx.get_env("path")}\\bar`);

            fso.DeleteFolder("fo*");

            assert.isFalse(ctx.vfs.FolderExists(`${ctx.get_env("path")}\\foo`));
            assert.isFalse(ctx.vfs.FolderExists(`${ctx.get_env("path")}\\fox`));
            assert.isTrue(ctx.vfs.FolderExists(`${ctx.get_env("path")}\\bar`));

        });

        it("should correctly handle and delete paths which are relative", () => {

            const fso = MakeFSO();

            ctx.vfs.AddFolder(`${ctx.get_env("path")}\\foo`);
            ctx.vfs.AddFolder(`${ctx.get_env("path")}\\fox`);
            ctx.vfs.AddFolder(`${ctx.get_env("path")}\\bar`);

            fso.DeleteFolder("../Construct/fo*");

            assert.isFalse(ctx.vfs.FolderExists(`${ctx.get_env("path")}\\foo`));
            assert.isFalse(ctx.vfs.FolderExists(`${ctx.get_env("path")}\\fox`));
            assert.isTrue(ctx.vfs.FolderExists(`${ctx.get_env("path")}\\bar`));
        });

        it("should throw 'invalid procedure call or argument' if path ends in trailing \\", () => {

            const fso = MakeFSO({
                exceptions: {
                    throw_invalid_fn_arg: () => {
                        throw new Error("path ends with trailing sep");
                    }
                }
            });

            ctx.vfs.AddFolder("C:\\RootOne\\SubDir1");
            assert.throws(() => fso.DeleteFolder("C:\\RootOne\\"), "path ends with trailing sep");
        });
        });

        describe("#DriveExists", () => {

        it("should return true for 'C', 'C:' or 'C:\\'", () => {

        const fso = MakeFSO();

        let true_drives  = ["C", "C:", "C:\\", "c:/"],
        false_drives = ["D", "A:\\", ""];

        true_drives.forEach(d => assert.isTrue(fso.DriveExists(d)));
        false_drives.forEach(d => assert.isFalse(fso.DriveExists(d)));
        });
        });

    describe(".Drives", () => {

        it("should return a DrivesCollection object", () => {

            const fso = MakeFSO(),
                  dco = fso.Drives;

            assert.equal(dco.count, 1);
            assert.equal(dco.item("c").path, "C:");
        });

        it("should throw if the DrivesCollection property is assigned to", () => {

            const fso = MakeFSO({
                exceptions: {
                    throw_unsupported_prop_or_method: () => {
                        throw new Error(".drives is read only");
                    }
                }
            });

            assert.throws(() => fso.Drives = 5, "drives is read only");
        });
    });

    describe("#FileExists", () => {

        it("should return true|false upon file existance", () => {

            const fso = MakeFSO();

            ctx.vfs.AddFile("C:\\RootOne\\SubDir1\\foo.txt");
            ctx.vfs.AddFile("C:\\RootOne\\SubDir2\\bar.txt");
            ctx.vfs.AddFile("C:\\RootOne\\SubDir3\\baz.txt");
            ctx.vfs.AddFile(`${ctx.get_env("path")}\\foo.txt`);

            const true_paths = [
                "C:\\RootOne\\SubDir1\\foo.txt",
                "../../RootOne\\SubDir2\\bar.txt",
                "foo.txt"
            ];

            true_paths.forEach(p => assert.isTrue(fso.FileExists(p)));

            const false_paths = [
                "C:\\Foo.txt",
                "C:\\Users\\Construct",
                "C:\\RootOne\\SubDir1\\foo.txt\\",
                "D:\\foo.txt",
                ""
            ];

            false_paths.forEach(p => assert.isFalse(fso.FileExists(p)));
        });

        it("should return false if filespec contains wildcard characters", () => {

            const fso = MakeFSO();

            ctx.vfs.AddFile("C:\\RootOne\\foo.txt");
            ctx.vfs.AddFile("C:\\RootOne\\bar.txt");

            assert.isFalse(fso.FileExists("C:\\RootOne\\*.txt"));
        });
    });


    const NOOP = () => {};


    xdescribe("#FolderExists", NOOP);
    xdescribe("#GetAbsolutePathName", NOOP);
    xdescribe("#GetBaseName", NOOP);
    xdescribe("#GetDrive", NOOP);
    xdescribe("#GetDriveName", NOOP);
    xdescribe("#GetExtensionName", NOOP);
    xdescribe("#GetFile", NOOP);

    xdescribe("#GetFileName", NOOP);
    xdescribe("#GetFolder", NOOP);
    xdescribe("#GetParentFolderName", NOOP);
    xdescribe("#GetSpecialFolders", NOOP);
    xdescribe("#GetTempName", NOOP);
    xdescribe("#MoveFile", NOOP);
    xdescribe("#MoveFolder", NOOP);
    xdescribe("#OpenTextfile", NOOP);
});
