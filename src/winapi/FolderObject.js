/*
 * "Provides access to all the properties of a folder."
 *  - https://msdn.microsoft.com/en-us/library/1c87day3(v=vs.84).aspx
 *
 */

const Component         = require("../Component");
const proxify           = require("../proxify2");
const win32path         = require("path").win32;
const Drive             = require("./DriveObject");
const FilesCollection   = require("./FilesCollection");
const FoldersCollection = require("./FoldersCollection");

class JS_FolderObject extends Component {

    constructor(context, path) {

	super(context, "Folder");

	this.context = context;
        this.ee      = this.context.emitter;
        this.vfs     = this.context.vfs;
        this._path   = path;

        if (path.toLowerCase() === "c:") {
            this._path = this.context.get_env("path");
        }

        this._assert_exists = () => {

            if (this.vfs.FolderExists(this._path)) return;

            this.context.exceptions.throw_path_not_found(
                "FolderObject",
                "The backing folder is not available.",
                "The folder which backed this object instance is " +
                    "no longer present on the filesystem (it may " +
                    "have been deleted)."
            );
        };
    }

    get attributes () {}

    // DateCreated
    // ===========
    //
    // Returns a the date and time the folder was created.
    //
    get datecreated () {
        this.ee.emit("Folder.DateCreated");

        const stats = this.vfs.Stats(this._path),
                 dt = new Date(stats.ctime);

        return dt;
    }

    // DateLastAccessed
    // ================
    //
    // Returns the date and time that the folder was last accessed.
    //
    get datelastaccessed () {
        this.ee.emit("Folder.DateLastAccessed");

        const stats = this.vfs.Stats(this._path),
                 dt = new Date(stats.atime);

        return dt;
    }

    // DateLastModified
    // ================
    //
    // Returns the date and time the folder was last modified.
    //
    get datelastmodified () {
        this.ee.emit("Folder.DateLastModified");

        const stats = this.vfs.Stats(this._path),
                 dt = new Date(stats.mtime);

        return dt;
    }

    // Drive
    // =====
    //
    // Returns a read-only Drive object, which contains about the
    // drive upon which this folder exists.  As we don't support
    // multiple drives, the Drive is always C:\.
    //
    get drive () {
        this.ee.emit("Folder.Drive");
        return new Drive(this.context);
    }

    // Files
    // =====
    //
    // Returns a read-only FilesCollection object which contains all
    // of the files contained within the backing folder.
    //
    get files () {
        this.ee.emit("Folder.Files");
        return new FilesCollection(this.context, this._path);
    }

    // IsRootFolder
    // ============
    //
    // Returns TRUE if this folder is the root of the filesystem, or
    // FALSE otherwise.
    //
    get isrootfolder () {
        this.ee.emit("Folder.IsRootFolder");
        return this._path.toLowerCase() === "c:\\";
    }

    // Name
    // ====
    //
    // Returns the folder name.
    //
    get name () {

        this._assert_exists();

        if (this._path.toLowerCase() === "c:\\") return this._path;

        // From analysing this on a Win7 machine, it seems that it
        // just returns the basename of this folder's backing path.
        return win32path.basename(this._path);
    }

    // ParentFolder
    // ============
    //
    // Returns a Folder object representing the folder that the parent
    // of the current folder.  Returns undefined if this folder is
    // already the root.
    //
    get parentfolder () {

        this._assert_exists();

        if (this._path.toLowerCase() === "c:\\") {
            return undefined;
        }

        const dirname = win32path.dirname(this._path);
        return new JS_FolderObject(this.context, dirname);
    }

    // Path
    // ====
    //
    // Returns the full path which backs this Folder object, including
    // the drive designator.
    //
    get path () {
        this.ee.emit("Folder.Path");
        this._assert_exists();
        return this._path;
    }

    // ShortName
    // =========
    //
    // Returns a DOS 8.3 folder name without the folders path.
    //
    get shortname () {
        this.ee.emit("Folder.ShortName");
        this._assert_exists();

        return this.vfs.GetShortName(this._path);
    }

    // ShortPath
    // =========
    //
    // Returns the complete path to a folder in DOS 8.3 format
    // (shortnames).
    //
    get shortpath () {
        this.ee.emit("Folder.ShortPath");
        this._assert_exists();

        const shortpath = this.vfs.ShortPath(this._path);

        if (shortpath.toLowerCase() === this._path.toLowerCase()) {
            return this._path;
        }

        return shortpath;
    }

    // Size
    // ====
    //
    // Returns the total size of all files, subfolders, and their
    // contents in the folder structure, starting with the backing
    // folder.
    //
    // Throws a 'permission denied' error if the folder is the root
    // folder.
    //
    get size () {
        this.ee.emit("Folder.Size");
        this._assert_exists();

        if (this._path.toLowerCase() === "c:\\") {
            this.context.exceptions.throw_permission_denied(
                "FolderObject",
                "Cannot get .Size of root folder.",
                "The current folder is the file system's root, and it is " +
                    "not possible to request the .Size of this folder."
            );
        }

        return this.vfs.FolderContentsSize(this._path);
    }

    // SubFolders
    // ==========
    //
    // Returns a FoldersCollection instance which contains a realtime
    // view of the VFS.  Files which are deleted are no longer
    // accessible from the SubFolders instance.
    //
    get subfolders () {
        this.ee.emit("Folder.SubFolders");
        this._assert_exists();

        return new FoldersCollection(this.context, this._path);
    }

    // Type
    // ====
    //
    // For FolderObject instances, always returns 'File folder'.
    //
    get type () {
        this.ee.emit("Folder.Type");
        this._assert_exists();
        return "File folder";
    }

    // ###########
    // # Methods #
    // ###########

    // Copy
    // ====
    //
    // Recursively copies the backing folder, and all of its sub files
    // and folders to `destination'.  If `overwrite_files' is set to TRUE,
    // files which already exist in `destination' will be overwritten.
    //
    // The destination path is not relative to `this._path' but rather
    // the CWD of the [cw]script process which launched it.
    //
    copy (destination, overwrite_files) {
        this.ee.emit("Folder.Copy");
        this._assert_exists();

        if (this.vfs.IsWildcard(destination)) {
            this.context.exceptions.throw_invalid_fn_arg(
                "FolderObject",
                "Destination cannot contain wildcard characters.",
                "The destination folder cannot contain wildcard characters."
            );
        }

        // Unlike FSO.Copy, there is no difference with this Copy
        // method if destination ends with or without a trailing
        // separator, so strip it.
        destination = destination.replace(/[\\/]*$/, "");

        if (this.vfs.PathIsRelative(destination)) {
            destination = win32path.join(this.context.get_env("path"), destination);
        }

        if (! this.vfs.FolderExists(destination)) {
            this.vfs.AddFolder(destination);
        }

        try {
            this.vfs.CopyFolder(`${this._path}\\`, destination, overwrite_files);
        }
        catch (e) {

            if (e.message.includes("destination file already exists")) {
                this.context.exceptions.throw_file_already_exists(
                    "FolderObject",
                    "Copy cannot overwrite existing file when overwrite = false.",
                    "Unable to overwrite existing file because the overwrite_files " +
                        "flag is set to FALSE.  Either change the flag to TRUE or " +
                        "remove the existing file."
                );
            }

            throw e;
        }

    }


    createtextfile () {}

    // Delete
    // ======
    //
    // Deletes this folder from disk.
    //
    delete () {
        this.vfs.Delete(this._path);
    }
    move () {}
}

module.exports = function create(context, path) {
    let folder = new JS_FolderObject(context, path);
    return proxify(context, folder);
};
