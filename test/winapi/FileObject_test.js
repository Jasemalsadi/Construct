const assert            = require("chai").assert;
const File              = require("../../src/winapi/FileObject.js");
const VirtualFileSystem = require("../../src/runtime/virtfs");
const win32path         = require("path").win32;

function make_ctx (opts) {

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

    var default_assoc = {
        "txt": "Text Document",
        "jpg": "JPEG image"
    };

    let env   = Object.assign({}, default_env, opts.environment),
        cfg   = Object.assign({}, default_cfg, opts.config),
        assoc = Object.assign({}, default_assoc, opts.associations),
        epoch = opts.epoch || 1234567890;

    function get_file_assoc (f) {

        const extname = win32path
                  .extname(win32path.basename(f))
                  .toLowerCase()
                  .replace(".", "");

        if (assoc.hasOwnProperty(extname)) {
            return assoc[extname];
        }

        return `${extname} File`;
    }

    let context = {
        epoch: epoch,
        ENVIRONMENT: env,
        CONFIG: cfg,
        emitter: { emit: () => {} },
        get_env: (e) => env[e],
        get_cfg: (c) => cfg[c],
        get_file_association: (f) => get_file_assoc(f)
    };

    let vfs = new VirtualFileSystem(context);
    context.vfs = vfs;
    return Object.assign({}, context, opts);
}

describe("FileObject", () => {

    describe("Construction", () => {

        it("should throw if the given file is a folder", () => {

            const path = "C:\\RootOne",
                  ctx  = make_ctx({
                      exceptions: {
                          throw_file_not_found: () => {
                              throw new Error("no file");
                          }
                      }
                  });

            ctx.vfs.AddFolder(path);
            assert.throws(() => new File(ctx, path), "no file");
        });

        it("should throw if the supplied file does not exist", () => {

            const path = "C:\\RootOne",
                  ctx  = make_ctx({
                      exceptions: {
                          throw_file_not_found: () => {
                              throw new Error("no file");
                          }
                      }
                  });

            ctx.vfs.AddFolder(path);
            assert.throws(() => new File(ctx, `${path}\\does_not_exist.txt`), "no file");
        });

        it("should throw if the folderpath does not exist", () => {
            const ctx  = make_ctx({
                exceptions: {
                    throw_file_not_found: () => {
                        throw new Error("no file");
                    }
                }
            });

            assert.throws(() => new File(ctx, "C:\\Does\\Not\\Exist.txt"), "no file");
        });
    });

    describe(".Attributes", () => {

        it("should return a number when .Attributes is requested", () => {

            const ctx = make_ctx();
            ctx.vfs.AddFile("C:\\foo.txt");

            const file = new File(ctx, "C:\\foo.txt");
            assert.isNumber(file.attributes);
            assert.equal(file.attributes, 32);
        });
    });

    describe(".DateCreated", () => {

        it("should return a date object from when this file was created", () => {

            const path =  "C:\\RootOne\\HelloWorld.txt",
                  ctx  = make_ctx();

            ctx.vfs.AddFile(path);

            const file = new File(ctx, path);
            assert.instanceOf(file.DateCreated, Date);
        });
    });

    describe(".DateLastAccessed", () => {

        it("should return a date object from when this file was accessed", () => {

            const path =  "C:\\RootOne\\HelloWorld.txt",
                  ctx  = make_ctx();

            ctx.vfs.AddFile(path);

            const file = new File(ctx, path);
            assert.instanceOf(file.DateLastAccessed, Date);
        });
    });

    describe(".DateLastModified", () => {

        it("should return a date object from when this file was last modified", () => {

            const path =  "C:\\RootOne\\HelloWorld.txt",
                  ctx  = make_ctx();

            ctx.vfs.AddFile(path);

            const file = new File(ctx, path);
            assert.instanceOf(file.DateLastModified, Date);
        });
    });

    describe(".Drive", () => {

        it("should return a Drive object when .Drive is looked-up", () => {

            const path = "C:\\RootOne\\HelloWorld.txt",
                  ctx  = make_ctx();

            ctx.vfs.AddFile(path);

            const file = new File(ctx, path),
                  drive  = file.Drive;

            assert.equal(drive.driveletter, "C");
            assert.equal(drive.isREADY, true);
            assert.isNumber(drive.totalsize);
        });
    });

    describe(".Name", () => {

        // TODO: Add a test which asserts that a throw occurs when
        // trying to write to a file whose name contains illegal
        // chars.

        it("should return the basename of the backing path as the name", () => {

            const ctx = make_ctx();
            ctx.vfs.AddFile("C:\\RootOne\\HelloWorld.txt");

            ["hellow~1.txt", "HELLOW~1.TXT", "HelloWorld.txt"].forEach(n => {
                const file = new File(ctx, `C:\\RootOne\\${n}`);
                assert.equal(file.name, n);
            });
        });

        it("should rename the file when .Name is assigned to", () => {

            const path = "C:\\RootOne\\foo.txt",
                  ctx  = make_ctx();

            ctx.vfs.AddFile(path);

            const file = new File(ctx, path);

            assert.equal(file.name, "foo.txt");

            assert.isFalse(ctx.vfs.FileExists("C:\\RootOne\\bar.txt"));
            file.name = "bar.txt";
            assert.isTrue(ctx.vfs.FileExists("C:\\RootOne\\bar.txt"));
        });

        it("should throw 'file already exists' if the file already exists", () => {

            const path = "C:\\RootOne\\foo.txt",
                  ctx  = make_ctx({
                      exceptions: {
                          throw_file_already_exists: () => {
                              throw new Error("file exists");
                          }
                      }
                  });

            ctx.vfs.AddFile(path);
            const file = new File(ctx, path);
            assert.throws(() => file.Name = "foo.txt", "file exists");
        });

    });

    describe(".Parentfolder", () => {

        it("should return a Folder object which represents the parent folder", () => {

            const ctx  = make_ctx(),
                  path = "C:\\RootOne\\SubFolder1\\foo.txt";

            ctx.vfs.AddFile(path);

            const file = new File(ctx, path),
                  parent = file.ParentFolder;

            assert.equal(parent.name, "SubFolder1");
        });

        it("should return undefined if the Folder is already root", () => {
            const ctx  = make_ctx();
            ctx.vfs.AddFile("C:\\foo.txt");
            const file = new File(ctx, "C:\\foo.txt");
            assert.equal(file.ParentFolder, undefined);
        });

        it("should use env path if path is 'C:'", () => {
            const ctx = make_ctx();
            ctx.vfs.AddFile("C:\\Users\\Construct\\foo.txt");

            assert.equal(new File(ctx, "c:foo.txt").ParentFolder.name, "Construct");
            assert.equal(new File(ctx,   "foo.txt").ParentFolder.name, "Construct");
        });
    });

    describe(".Path", () => {

        it("should return the complete path to the current folder, including drive", () => {

            const path = "C:\\RootOne\\SubFolder1\\foo.txt",
                  ctx  = make_ctx();

            ctx.vfs.AddFile(path);

            const file = new File(ctx, path);
            assert.equal(file.path, path);
        });
    });

    describe(".ShortName", () => {

        it("should return the shortname for the backing file", () => {

            const path = "C:\\RootOneFoo\\SubFolder1\\helloworld.txt",
                  ctx  = make_ctx();

            ctx.vfs.AddFile(path);

            assert.equal(new File(ctx, path).ShortName, "HELLOW~1.TXT");
        });

        it("should return the file name if the file name is already a valid SFN", () => {

            const path = "C:\\RootOne\\foo.txt",
                  ctx  = make_ctx();

            ctx.vfs.AddFile(path);
            assert.equal(new File(ctx, path).ShortName, "foo.txt");
        });
    });

    describe(".ShortPath", () => {

        it("should return a short path version of the path", () => {

            const ctx = make_ctx();

            ctx.vfs.AddFile("C:\\HelloWorld\\LongFileName.txt");
            ctx.vfs.AddFile("C:\\Foo\\Bar\\Baz.txt");
            ctx.vfs.AddFile("C:\\hi.txt");

            assert.equal(new File(ctx, "C:\\HelloWorld\\LongFileName.txt").ShortPath,
                         "C:\\HELLOW~1\\LONGFI~1.TXT");

            assert.equal(new File(ctx, "C:\\Foo\\Bar\\Baz.txt").ShortPath,
                         "C:\\Foo\\Bar\\Baz.txt");

            assert.equal(new File(ctx, "C:\\hi.txt").ShortPath, "C:\\hi.txt");
        });
    });

    describe(".Size", () => {

        it("should return size as a number", () => {

            const ctx = make_ctx();
            ctx.vfs.AddFile("C:\\RootOne\\SubFolder1\\foo.txt");

            ctx.vfs.AddFile("C:\\Foo\\bar.txt", "abcd");
            assert.equal(new File(ctx, "C:\\Foo\\bar.txt").size, 4);

            const file = new File(ctx, "C:\\RootOne\\SubFolder1\\foo.txt");
            assert.isNumber(file.size);
            assert.equal(file.size, 0);

        });
    });

    describe(".Type", () => {

        it("should return the correct type for all known type instances", () => {

            const ctx = make_ctx();
            ctx.vfs.AddFile("C:\\foo.txt");
            ctx.vfs.AddFile("C:\\bar.jpg");
            ctx.vfs.AddFile("C:\\baz.boo");

            assert.equal(new File(ctx, "C:\\foo.txt").type, "Text Document");
            assert.equal(new File(ctx, "C:\\bar.jpg").type, "JPEG image");
            assert.equal(new File(ctx, "C:\\baz.boo").type, "boo File");
        });
    });

    describe("#Copy", () => {

        it("should throw if trying to overwrite itself", () => {

            const ctx = make_ctx({
                exceptions: {
                    throw_permission_denied: () => {
                        throw new Error("permission denied");
                    }
                }
            });
            ctx.vfs.AddFile("C:\\foo.txt");
            assert.isTrue(ctx.vfs.FileExists("C:\\foo.txt"));

            const file = new File(ctx, "C:\\foo.txt");
            assert.throws(() => file.Copy("C:\\foo.txt"), "permission denied");
        });

        it("should throw if the destination filename contains a wildcard char", () => {

            const ctx = make_ctx({
                exceptions: {
                    throw_invalid_fn_arg: () => {
                        throw new Error("no wildcards");
                    }
                }
            });

            ctx.vfs.AddFile("C:\\foo.txt");
            const file = new File(ctx, "C:\\foo.txt");
            assert.throws(() => file.copy("*.txt"), "no wildcards");
        });

        it("should throw if the inputs are invalid", () => {

            const ctx = make_ctx({
                exceptions: {
                    throw_invalid_fn_arg: () => {
                        throw new Error("invalid arg");
                    }
                }
            });

            ctx.vfs.AddFile("C:\\foo.txt");

            const file   = new File(ctx, "C:\\foo.txt"),
                  params = [
                      ""
                  ];

            params.forEach(p => assert.throws(() => file.Copy(p), "invalid arg"));
        });

        it("should copy to the CWD if no path is given", () => {

            const ctx  = make_ctx(),
                  srcpath = `${ctx.get_env("path")}\\foo.txt`,
                  dstpath = `${ctx.get_env("path")}\\bar.txt`;

            ctx.vfs.AddFile(srcpath, "hello");

            const file = new File(ctx, srcpath);;

            assert.isTrue(ctx.vfs.FileExists(srcpath));
            assert.isFalse(ctx.vfs.FileExists(dstpath));

            assert.doesNotThrow(() => file.Copy("bar.txt"));

            assert.isTrue(ctx.vfs.FileExists(dstpath));
        });

        it("should copy to the CWD if only 'C:<filename>' is given", () => {

            const ctx  = make_ctx(),
                  srcpath = `${ctx.get_env("path")}\\foo.txt`,
                  dstpath = `${ctx.get_env("path")}\\bar.txt`;

            ctx.vfs.AddFile(srcpath, "hello");

            const file = new File(ctx, srcpath);;

            assert.isTrue(ctx.vfs.FileExists(srcpath));
            assert.isFalse(ctx.vfs.FileExists(dstpath));

            assert.doesNotThrow(() => file.Copy("C:bar.txt"));

            assert.isTrue(ctx.vfs.FileExists(dstpath));
        });

        it("should correctly overwrite the dest file by default", () => {

            const ctx = make_ctx(),
                  src = "C:\\RootOne\\foo.txt",
                  dst = "C:\\RootOne\\bar.txt";

            ctx.vfs.AddFile(src, "hello");
            ctx.vfs.AddFile(dst, "world");

            const file = new File(ctx, src);

            assert.deepEqual(ctx.vfs.ReadFileContents(src).toString(), "hello");
            assert.deepEqual(ctx.vfs.ReadFileContents(dst).toString(), "world");

            file.copy("C:\\RootOne\\bar.txt");

            assert.deepEqual(ctx.vfs.ReadFileContents(src).toString(), "hello");
            assert.deepEqual(ctx.vfs.ReadFileContents(dst).toString(), "hello");
        });


        it("should not overwrite the file is overwrite=false and file exists", () => {

            const ctx = make_ctx({
                exceptions: {
                    throw_file_already_exists: () => {
                        throw new Error("file exists");
                    }
                }
            });

            ctx.vfs.AddFile("C:\\RootOne\\foo.txt");
            ctx.vfs.AddFile("C:\\RootOne\\bar.txt");

            const file = new File(ctx, "C:\\RootOne\\foo.txt");

            assert.isTrue(ctx.vfs.FileExists("C:\\RootOne\\bar.txt"));
            assert.throws(() => file.Copy("C:\\RootOne\\bar.txt", false), "file exists");
        });

        it("should copy to one folder up if '../filename' is used", () => {

            const ctx = make_ctx(),
                  src = `C:\\Users\\Construct\\foo.txt`,
                  dst = `C:\\Users\\bar.txt`;

            ctx.vfs.AddFile(src);

            const file = new File(ctx, src);

            assert.isFalse(ctx.vfs.FileExists(dst));
            assert.doesNotThrow(() => file.Copy("..\\bar.txt"));

            assert.isTrue(ctx.vfs.FileExists(dst));
        });

        it("should copy the filename if the path is '../'", () => {

            const ctx = make_ctx(),
                  src = "C:\\Users\\Construct\\foo.txt",
                  dst = "C:\\Users\\foo.txt";

            ctx.vfs.AddFile(src);

            const file = new File(ctx, src);

            assert.isFalse(ctx.vfs.FileExists(dst));
            assert.doesNotThrow(() => file.Copy("../"));
            assert.isTrue(ctx.vfs.FileExists(dst));
        });

        it("should throw if destination contains a folder name matching dest filename", () => {

            const ctx = make_ctx({
                exceptions: {
                    throw_permission_denied: () => {
                        throw new Error("filename not uniq");
                    }
                }
            });

            ctx.vfs.AddFolder("C:\\RootOne\\bar");
            ctx.vfs.AddFile("C:\\RootOne\\foo.txt");

            const file = new File(ctx, "C:\\RootOne\\foo.txt");

            assert.throws(() => file.Copy("C:\\RootOne\\bar"), "filename not uniq");
        });

        it("should copy shortpaths", () => {

            const ctx = make_ctx();

            ctx.vfs.AddFile("C:\\FooBarBaz\\helloworld.txt");

            const file = new File(ctx, "C:\\FooBarBaz\\helloworld.txt");

            assert.isFalse(ctx.vfs.FileExists("C:\\FooBarBaz\\bar.txt"));
            file.Copy("C:\\FOOBAR~1\\bar.txt");
            assert.isTrue(ctx.vfs.FileExists("C:\\FooBarBaz\\bar.txt"));
        });
    });

    describe("#Delete", () => {

        it("should allow the file to be deleted", () => {

            const ctx = make_ctx();
            ctx.vfs.AddFile("C:\\foo.txt");
            assert.isTrue(ctx.vfs.FileExists("C:\\foo.txt"));

            const file = new File(ctx, "C:\\foo.txt");

            assert.doesNotThrow(() => file.Delete());
            assert.isFalse(ctx.vfs.FileExists("C:\\foo.txt"));

            assert.throws(() => file.name, "throw_file_not_found");
            assert.throws(() => file.path, "throw_file_not_found");
            assert.throws(() => file.type, "throw_file_not_found");
        });
    });

    describe("#Move", () => {

        it("should successfully move a file", () => {

            const ctx = make_ctx();
            ctx.vfs.AddFile("C:\\foo.txt");

            const file = new File(ctx, "C:\\foo.txt");
            assert.isFalse(ctx.vfs.FileExists("C:\\bar.txt"));

            assert.doesNotThrow(() => file.Move("C:\\bar.txt"));

            assert.isFalse(ctx.vfs.FileExists("C:\\foo.txt"));
            assert.isTrue(ctx.vfs.FileExists("C:\\bar.txt"));

            assert.equal(file.Name, "bar.txt");
        });

        it("should not throw when moving a file", () => {

            const ctx = make_ctx();
            ctx.vfs.AddFile("C:\\foo.txt");

            const file = new File(ctx, "C:\\foo.txt");

            assert.doesNotThrow(() => file.Move("C:\\foo.txt"));
            assert.isTrue(ctx.vfs.FileExists("C:\\foo.txt"));
        });

        it("should move a file if the move destination is '../'", () => {

            const ctx = make_ctx();
            ctx.vfs.AddFile("C:\\Users\\Construct\\foo.txt");

            const file = new File(ctx, "C:\\Users\\Construct\\foo.txt");
            assert.isFalse(ctx.vfs.FileExists("C:\\Users\\foo.txt"));

            assert.doesNotThrow(() => file.Move("../"));

            assert.isFalse(ctx.vfs.FileExists("C:\\Users\\Construct\\foo.txt"));
            assert.isTrue(ctx.vfs.FileExists("C:\\Users\\foo.txt"));

        });
    });


    describe("#OpenAsTextStream", () => {

    });
});
