// https://docs.microsoft.com/en-us/previous-versions/windows/internet-explorer/ie-developer/windows-scripting/z9ty6h50(v=vs.84)

const Component     = require("../Component");
const proxify       = require("../proxify2");
const FSOHelper     = require("../absFileSystemObject");
const JS_TextStream = require("./TextStream");
const win32path     = require("path").win32;


class JS_FileSystemObject extends Component {

    constructor (context) {

	super(context, "FileSystemObject");
        this.context = context;

        // Shortcuts...
        this.ee  = this.context.emitter;
        this.vfs = this.context.vfs;
    }

    //
    // PROPERTIES
    // ==========
    //

    // Returns a Drives collection consisting of all Drive objects
    // available on the local machine.
    get drives () {}
    set drives (_) {}

    //
    // METHODS
    // =======
    //

    // Appends a name to an existing path.  It's really just a string
    // concatenation method, rather than a filesystem method.  It does
    // not check that either path exists, or if the path is valid.
    //
    buildpath (existing_path, new_path_part) {
        this.ee.emit("FileSystemObject::BuildPath", existing_path, new_path_part);
        return this.vfs.BuildPath(existing_path, new_path_part);
    }

    // Copies one or more files from one location to another.
    copyfile (source, destination, overwrite_files) {

        this.ee.emit("FileSystemObject::CopyFile", source, destination, overwrite_files);

        //
        // TODO:
        //
        //  - Add something like `vfs.ExpandFilespec' here to return
        //  - an array of paths for wildcarding.
        //

        try {
            this.vfs.CopyFile(source, destination);
        }
        catch (e) {

            if (e.message.includes("destination name is ambiguous")) {
                this.context.exceptions.throw_permission_denied(
                    "Scripting.FileSystemObject",
                    "Cannot copy to destination because the destination filename is ambiguous.",
                    "This error indicates that a file-copy operation has not succeeded due to " +
                        "a name-collision in the destination.  For example, if the destination " +
                        "of a copy is the filename 'foo', yet a folder exists in the same location " +
                        "also named 'foo', this error is thrown."
                );
            }
            else if (e.message.includes("Source file not found")) {
                this.context.exceptions.throw_file_not_found(
                    "Scripting.FileSystemObject",
                    "Unable to find src file.",
                    "The CopyFile operation was not completely successful because the " +
                        `file: ${source} could not be found.`
                );
            }
            else if (e.message.includes("Destination folder not found")) {
                this.context.exceptions.throw_path_not_found(
                    "Scripting.FileSystemObject",
                    "Unable to find destination folder.",
                    "The CopyFile operation was not completely successful because the " +
                        `destination folder: ${destination} could not be found.`
                );
            }

            throw e;
        }
    }

    // Recursively copies a folder from one location to another.
    copyfolder () {
        // TODO: Blocked on wildcard implementation.
    }

    // Creates a single new folder in the `path' specified and returns
    // its Folder object.
    createfolder (path) {

        // Does this path already exist?
        try {
            if (this.vfs.GetFolder(path)) {
                this.context.exceptions.throw_file_already_exists(
                    "Scripting.FileSystemObject",
                    "snake",
                    "plane"
                );
            }

        }
        catch (e) {

            if (e.message.includes("Unknown volume")) {
                this.context.exceptions.throw_path_not_found(
                    "Scripting.FileSystemObject",
                    "Volume could not be found.",
                    "CreateFolder was called with a volume in a path which does " +
                        "not exist."
                );
            }

            if (e.message.includes("Path contains invalid characters.")) {
                this.context.exceptions.throw_bad_filename_or_number(
                    "Scripting.FileSystemObject",
                    "Cannot create folder -- path is invalid.",
                    "Unable to create the folder requested because some part of the " +
                        "path string is invalid."
                );
            }

            throw e;
        }

        return this.vfs.AddFolder(path);
    }

    // Creates a specified file name and returns a TextStream object
    // that can be used to read from or write to the file.
    createtextfile (filespec, overwrite, unicode) {

        if (overwrite === undefined || overwrite === null) {
            overwrite = false;
        }

        if (unicode === undefined || unicode === null) {
            unicode = false;
        }

        try {

            let file_parts = FSOHelper.Parse(filespec),
                cwd        = this.context.get_env("Path");

            if (file_parts.dir === "") {
                file_parts = FSOHelper.Parse(`${cwd}\\${file_parts.base}`);
            }
            else if (file_parts.root === "") {

                // This is a relative path...
                let relative_path = win32path.join(cwd, filespec);
                file_parts = FSOHelper.Parse(relative_path);
            }

            FSOHelper.ThrowIfInvalidPath(file_parts.base, { file: true });
            FSOHelper.ThrowIfInvalidPath(file_parts.orig_path);

            // TODO: there is code missing here -- need overwrite mode stuff.
            //
            // This will throw if auto-vivification is disabled:

            if (overwrite === false && this.context.vfs.FileExists(file_parts.orig_path)) {
                this.context.exceptions.throw_file_already_exists(
                    "Scripting.FileSystemObject",
                    "Cannot create file while Overwrite is false",
                    "Unable to create a textfile which already exists on " +
                        "disk while the Overwrite property is set to false."
                );
            }

            let file = this.context.vfs.AddFile(file_parts.orig_path);

            return new JS_TextStream(
                this.context,
                file.Path,
                false, // CAN READ?   No.
                1,
                unicode
            );
        }
        catch (e) {

            if (e.message.includes("contains invalid characters")) {
                this.context.exceptions.throw_bad_filename_or_number(
                    "Scripting.FileSystemObject",
                    "Cannot create file -- illegal chars in filename.",
                    "The file cannot be created because it contains illegal characters " +
                        "which are forbidden in Windows filenames."
                );
            }
            else if (e.message.includes("path does not exist and autovivify disabled")) {
                this.context.exceptions.throw_path_not_found(
                    "Scripting.FileSystemObject",
                    "Cannot create the requested file because the parent path does not exist.",
                    "By default, Construct allows path 'autovivification' which will auto-create " +
                        "folder paths if they do not exist.  This error is seen because a path " +
                        "create event was attempted, but the path does not exist and autovivify " +
                        "is disabled."
                );
            }

            throw e;
        }
    }

    // Deletes a specified file.
    deletefile () {

    }

    // Deletes a specified folder and its contents.
    deletefolder () {

    }

    // Returns true if the specified drive exists; false if it does
    // not.
    driveexists () {

    }

    // Returns true if a specified file exists; false if it does not.
    fileexists () {

    }

    // Returns true if a specified folder exists; false if it does
    // not.
    folderexists (pathspec) {
        return (this.vfs.GetFolder(pathspec)) ? true : false;
    }

    // Returns a complete and unambiguous path from a provided path
    // specification.
    getabsolutepathname () {

    }

    // Returns a string containing the base name of the last
    // component, less any file extension, in a path.
    getbasename () {

    }

    // Returns a Drive object corresponding to the drive in a
    // specified path.
    getdrive () {

    }

    // Returns a string containing the name of the drive for a
    // specified path.
    getdrivename () {

    }

    // Returns a string containing the extension for the last
    // component in a path.
    getextensionname () {

    }

    // Returns a File object corresponding to the file in a specified
    // path.
    getfile () {

    }

    // Returns the last component of specified path that is not part
    // of the drive specification.
    getfilename () {

    }

    // Returns a Folder object corresponding to the folder in a
    // specified path.
    getfolder (path) {

    }

    // Returns a string containing the name of the parent folder of
    // the last component in a specified path.
    getparentfoldername () {

    }

    // Returns the special folder object specified.
    getspecialfolder () {

    }

    // Returns a randomly generated temporary file or folder name that
    // is useful for performing operations that require a temporary
    // file or folder.
    gettempname () {

    }

    // Moves one or more files from one location to another.
    movefile () {

    }

    // Moves one or more folders from one location to another.
    movefolder () {

    }

    // Opens a specified file and returns a TextStream object that can
    // be used to read from, write to, or append to the file.
    opentextfile () {

    }
}


module.exports = function create(context) {
    let fso = new JS_FileSystemObject(context);
    return proxify(context, fso);
};
