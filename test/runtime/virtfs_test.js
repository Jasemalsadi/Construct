const assert = require("chai").assert;
const VirtualFileSystem = require("../../src/runtime/virtfs");

let any_date_will_do = new Date(1234567890);

let mock_date = {
    getTime: () => any_date_will_do.getTime()
};

var CONFIG = {
    autovivify: true
};

let mock_context = {
    date: mock_date,
    get_cfg: (v) => CONFIG[v],
    register: () => {}
};

describe("VirtualFileSystem Module", function () {

    /*xdescribe("Registration", () => {

	it("Should register itself.", (done) => {
	    new VirtualFileSystem({
		register: (name) => {
		    assert.equal(name, "VirtualFileSystem", "VFS registered!");
		    done();
		}
	    });
	});
    });*/

    describe("Volumes", () => {

	it("Should be created with a volume: 'C:'.", (done) => {

	    let vfs = new VirtualFileSystem({
		register: () => {}
	    });

	    assert.equal(vfs.VolumeExists("C:"), true);
	    done();
	});

	it("Should allow volumes to be fetched.", (done) => {

	    let vfs = new VirtualFileSystem(mock_context),
		vol = vfs.GetVolume("C:");

	    assert.equal(vol.constructor.name, "FolderObject");
	    assert.equal(vol.Type, "File Folder");
	    done();
	});
    });

    describe("Files", () => {

	describe("Adding", () => {

	    it("Should support adding a new file.", (done) => {

		let vfs  = new VirtualFileSystem(mock_context),
		    newf = vfs.AddFile("C:\\foo.txt", "And did those feet in ancient times...");

		assert.equal(newf.contents, "And did those feet in ancient times...");
		assert.equal(newf.Name, "foo.txt");
		assert.equal(newf.constructor.name, "FileObject");
		done();
	    });

            it("should fail to add a folder path if auto-vivification is not enabled", (done) => {

                let ctx = Object.assign({}, mock_context, {
                    get_cfg: (v) => {
                        if (v === "autovivify") return false;
                        return CONFIG[v];
                    }
                });

                let vfs = new VirtualFileSystem(ctx);

                assert.throws(
                    () => vfs.AddFile("C:\\do\\not\\auto\\create\\dirs"),
                    "path does not exist and autovivify disabled."
                );

                done();
            });
	});

	describe("Getting", () => {

	    it("Should support getting a file if it exists.", (done) => {

		let vfs = new VirtualFileSystem(mock_context),
		    file = vfs.AddFile("C:\\a\\b.txt", "Bring me my charoit of fire.");

		const the_file = vfs.GetFile("C:\\a\\b.txt");

		assert.equal(file, the_file);
		assert.equal(file.Name, the_file.Name);
		assert.equal(file.contents, the_file.contents);
		done();
	    });
	});

	describe("Deleting", () => {

	    it("Should support file deletion.", (done) => {

		let vfs  = new VirtualFileSystem(mock_context);
		var file = vfs.AddFile("C:\\a.txt", "Bring me my bow of burning gold.");
		assert.equal(file.Name,  "a.txt");

		var success = vfs.DeleteFile("C:\\a.txt");

		assert.equal(success, true);

		var no_file_here = vfs.GetFile("C:\\a.txt");
		assert.equal(no_file_here, false);
		done();
	    });
	});


	describe("Copying", () => {

	    it("Should support copying a file.", (done) => {

		let src_path = "C:\\foo\\bar\\baz\\test.txt",
		    dst_path = "C:\\destination\\filedir";

		let vfs = new VirtualFileSystem(mock_context),
		    src = vfs.AddFile(src_path, "Bring me my bow of burning gold."),
		    dst_dir = vfs.AddFolder(dst_path);

		let copied_file = vfs.CopyFileToFolder(src_path, dst_path);

		assert.equal(copied_file.constructor.name, "FileObject");
		assert.equal(src.Name, copied_file.Name);
		assert.equal(copied_file.Path, "c:\\destination\\filedir\\test.txt");

		done();
	    });

	    it("Should overwrite an existing file if configured.", (done) => {

		let vfs = new VirtualFileSystem(mock_context),

		    // Copy this...
		    fl1 = vfs.AddFile("C:\\foo\\bar.txt",
				      "Walk upon England's mountains green..."),

		    // And overwrite this:
		    fl2 = vfs.AddFile("C:\\baz\\bar.txt",
				      "...among those dark satanic mills?"),

		    res = vfs.CopyFileToFolder("C:\\foo\\bar.txt",
					       "C:\\baz",
					       { overwrite: true });

		assert.equal(res.contents, "Walk upon England's mountains green...");
		assert.equal(res.ParentFolder.Path, "c:\\baz");

		done();
	    });

	    it("Should fail when trying to overwrite an existing file.", (done) => {

		let vfs = new VirtualFileSystem(mock_context),
		    fl1 = vfs.AddFile("C:\\foo\\bar.txt"),
		    fl2 = vfs.AddFile("C:\\baz\\bar.txt"),
		    res = vfs.CopyFileToFolder("C:\\foo\\bar.txt",
					       "C:\\baz",
					       { overwrite: false });

		assert.equal(res, false);
		done();
	    });
	});
    });

    describe("Folders", () => {

	describe("Adding", () => {

	    it("Should support adding a new folder.", (done) => {

		let vfs = new VirtualFileSystem(mock_context),
		    fld = vfs.AddFolder("C:\\foo\\bar\\baz");

		assert.equal(fld.Type, "File Folder");
		assert.equal(fld.Name, "baz");

		assert.equal(fld.ParentFolder.Type, "File Folder");
		assert.equal(fld.ParentFolder.Name, "bar");

		assert.equal(fld.ParentFolder.ParentFolder.Type, "File Folder");
		assert.equal(fld.ParentFolder.ParentFolder.Name, "foo");

		assert.equal(
		    fld.ParentFolder.ParentFolder.ParentFolder.IsRootFolder, true
		);

		assert.equal(fld.constructor.name, "FolderObject");

		done();
	    });
	});

	describe("Getting", () => {

	    it("Should support getting an existing folder.", (done) => {

		let vfs = new VirtualFileSystem(mock_context),
		    fld = vfs.AddFolder("C:\\testing\\foo\\bar");

		let get_folder = vfs.GetFolder("C:\\testing\\foo");

		assert.equal(get_folder.Name, fld.ParentFolder.Name);
		done();
	    });
	});

	describe("Deleting", () => {

	    it("Should support folder deletion.", (done) => {

		let vfs = new VirtualFileSystem(mock_context);

		vfs.AddFolder("C:\\foo\\bar\\baz\\b0rk\\bark");
		vfs.AddFolder("C:\\foo\\bar\\a\\b\\c\\d");

		// We're going to delete folder 'baz' and all of its children.
		let result = vfs.DeleteFolder("C:\\foo\\bar\\baz");

		assert.equal(result, true);
		assert.equal(vfs.GetFolder("C:\\foo\\bar").Name, "bar");
		assert.equal(vfs.GetFolder("C:\\foo\\bar\\baz"), false);

		done();
	    });
	});

	describe("Copying", () => {

	    it("Should support copying a folder.", (done) => {

		let vfs = new VirtualFileSystem(mock_context);

		// Let's create our folder that we'll copy, and put some files
		// and subfolders inside of it.
		let src_folder_path = "C:\\foo\\bar\\baz\\folderA";

		vfs.AddFolder(src_folder_path);
		vfs.AddFile(`${src_folder_path}\\foo.txt`, "Bring me my spear...");
		vfs.AddFile(`${src_folder_path}\\things\\baz.txt`, "o clouds unfold");

		const src_folder = vfs.GetFolder(src_folder_path);

		let dst_folder_path = "C:\\dstfolder",
		    dst_folder      = vfs.AddFolder(dst_folder_path),
		    copy_result     = vfs.CopyFolderInToFolder(src_folder_path,
							     dst_folder_path);

		assert.equal(dst_folder.SubFolders.length, 1);
		assert.equal(dst_folder.SubFolders[0].Name, "foldera");
		assert.equal(dst_folder.SubFolders[0].ParentFolder, dst_folder);
		assert.equal(dst_folder.SubFolders[0].Files.length, 1);
		assert.equal(dst_folder.SubFolders[0].Files[0].Name, "foo.txt");
		assert.equal(dst_folder.SubFolders[0].Files[0].contents,
			     "Bring me my spear...");
		done();
	    });

	    it("Should not overwrite elements if any file or folder names clash.", (done) => {

		let vfs = new VirtualFileSystem(mock_context);

		// Source.
		vfs.AddFolder("C:\\alpha\\bravo");
		vfs.AddFile("C:\\alpha\\bravo\\foo.txt");
		vfs.AddFile("C:\\alpha\\bravo\\charlie\\bar.txt");

		// Destination.
		let dst_root = vfs.AddFolder("C:\\trycopy");
		vfs.AddFolder("C:\\trycopy\\bravo");
		vfs.AddFile("C:\\trycopy\\bravo\\blah.txt", "test");

		let result = vfs.CopyFolderInToFolder(
		    "C:\\alpha\\bravo", // We copy the folder 'bravo'...
		    "C:\\trycopy",      // in to 'trycopy'.
		    { overwrite: false });

		assert.equal(result, false);
		assert.equal(vfs.GetFile("C:\\trycopy\\bravo\\foo.txt"), false);
		assert.equal(vfs.GetFile("C:\\trycopy\\bravo\\charlie\\bar.txt"), false);
		assert.equal(vfs.GetFolder("C:\\trycopy\\bravo\\charlie"), false);
		done();
	    });


	    it("Should overwrite existing destination files if overwrite:true.", (done) => {

		let vfs = new VirtualFileSystem(mock_context);

		// Source folder.
		vfs.AddFolder("C:\\stage\\src");
		vfs.AddFile("C:\\stage\\src\\alpha.txt", "src:alpha contents");
		vfs.AddFile("C:\\stage\\src\\charlie.txt", "src:charlie contents");
		vfs.AddFile("C:\\stage\\src\\blah\\test.txt", "src:blah-test.txt");

		// Dest folder
		vfs.AddFolder("C:\\stage\\dst");
		vfs.AddFile("C:\\stage\\dst\\alpha.txt", "dst:alpha contents");
		vfs.AddFile("C:\\stage\\dst\\bravo.txt", "dst:bravo contents");
		vfs.AddFile("C:\\stage\\dst\\charlie.txt", "dst:charlie contents");

		vfs.CopyFolderContentsToFolder(
		    "C:\\stage\\src",
		    "C:\\stage\\dst",
		    { overwrite: true }
		);


		assert.equal(
		    vfs.GetFile("C:\\stage\\dst\\alpha.txt").__contents,
		    "src:alpha contents"
		);

		assert.equal(
		    vfs.GetFile("C:\\stage\\dst\\bravo.txt").__contents,
		    "dst:bravo contents"
		);

		assert.equal(
		    vfs.GetFile("C:\\stage\\dst\\charlie.txt").__contents,
		    "src:charlie contents"
		);

		assert.equal(
		    vfs.GetFile("C:\\stage\\dst\\blah\\test.txt").__contents,
		    "src:blah-test.txt"
		);

		done();
	    });

	    //
	    // TODO
	    // ====
	    //
	    // Need to check that we can copy in to the root volume.
	    //
	    //



	    it("should support copying in to the root volume.", (done) => {

		let vfs = new VirtualFileSystem(mock_context);

		// Create some files/folders which will serve as our 'src'.
		vfs.AddFolder("C:\\foo\\bar\\baz\\byte\\b0rk");
		vfs.AddFolder("C:\\foo\\hand\\chair\\welcome");
		vfs.AddFolder("C:\\foo\\boom\\seven\\seventy");
		vfs.AddFile("C:\\foo\\boom\\seven\\seventy\\x.txt", "test");
		vfs.AddFile("C:\\foo\\hand\\excel.txt", "formula");

		assert.equal(vfs.GetFolder("C:\\bar"), false);
		assert.equal(vfs.GetFile("C:\\hand\\excel.txt"), false);

		// Now we do the copy...
		vfs.CopyFolderContentsToFolder("C:\\foo", "C:");

		assert.equal(vfs.GetFolder("C:\\bar").Name, "bar");
		assert.equal(vfs.GetFolder("C:\\hand").Name, "hand");
		assert.equal(vfs.GetFolder("C:\\boom").Name, "boom");

		assert.equal(vfs.GetFile("C:\\hand\\excel.txt").__contents, "formula");

		done();
	    });
	});
    });

    xdescribe("Wildcards", () => {

        describe("#NormaliseFilename", () => {

            it("should change all '?' to '>'", (done) => {

                let vfs   = new VirtualFileSystem(mock_context),
                    tests = [
                        { path: "f??.txt", exp: "f>>.txt" },
                        { path: "foo.txt", exp: "foo.txt" },
                        { path: "???.txt", exp: ">>>.txt" }
                    ];

                tests.forEach((t) => assert.equal(vfs._NormaliseFilename(t.path), t.exp));
                done();
            });

            it(`should change all '.*' or '.?' in to '"'`, (done) => {

                let vfs   = new VirtualFileSystem(mock_context),
                    tests = [
                        { path: "f.*.txt", exp: `f".txt` },
                    ];

                tests.forEach((t) => assert.equal(vfs._NormaliseFilename(t.path), t.exp));
                done();

            });

        });

        xdescribe("#GetFileList", () => {

            it("should return a single file when no wildcard is used", (done) => {

                let vfs = new VirtualFileSystem(mock_context);
                vfs.AddFile("C:\\temp\\test.txt");
                assert.deepEqual(vfs.GetFileList("C:\\temp\\test.txt"), ["C:\\temp\\test.txt"]);
                done();
            });

            it("should return a normalized path", (done) => {
                let vfs = new VirtualFileSystem(mock_context);
                vfs.AddFile("C:\\foo\\bar\\baz.txt", "hello");
                assert.deepEqual(vfs.GetFileList("C:\\foo\\bar\\..\\bar\\baz.txt"), ["C:\\foo\\bar\\baz.txt"]);
                done();
            });

            it("should throw if the path contains a wildcard", (done) => {

                let vfs = new VirtualFileSystem(mock_context);
                assert.throws(() => vfs.GetFileList("C:\\foo\\*\\bar\\baz.txt"), "Path contains invalid characters.");
                done();
            });

            it("should return [] if the filepath cannot be found", (done) => {

                let vfs = new VirtualFileSystem(mock_context);
                vfs.AddFile("C:\\Users\\Testing\\hello.txt");

                assert.deepEqual(vfs.GetFileList("C:\\Users\\DoesNotExist\\hello.txt"), []);
                done();
            });

        });
    });
});
