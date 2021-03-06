/*
 * XXXXXXXXXXXXXXXXX
 * C O N S T R U C T
 * XXXXXXXXXXXXXXXXX
 *
 */

const VirtualFileSystem = require("../../src/runtime/virtfs");
const vorpal            = require("vorpal")();
const vorpal_autocomp   = require("vorpal-autocomplete-fs");
const sprintf           = require("sprintf-js").sprintf;

const vfs = make_vfs();
vfs.AddFolder("C:\\Users\\Construct");
vfs.AddFile("C:\\Users\\Construct\\hello.txt", "Hello, World!");
vfs.AddFolder("C:\\Users\\Construct\\HelloWorld");

var cwd_path = "C:\\Users\\Construct";

vorpal
    .delimiter(`${cwd_path}> `)
    .show();

//
// DIR command
// ===========
//
function command_dir (args, callback) {

    const xtended_view = args.options.x || false;

    // The columns displayed are:
    //
    // 2018-05-23  10:32    <DIR>          HELLOW~1     HelloWorld
    //
    vfs.FolderListContents(cwd_path).forEach(item => {

        const path = `${cwd_path}\\${item}`;

        let short_filename = vfs.GetShortName(path),
            file_type      = (vfs.IsFolder(path)) ? "<DIR>" : "";

        if (xtended_view) {
            console.log(sprintf(" %-12s %-8s %-13s %-12s %s", "2018-03-12", "11:23", file_type, short_filename, item));
        }
        else {
            console.log(sprintf(" %-12s %-8s %-13s %s", "2018-03-12", "11:23", file_type, item));
        }
    });

    callback();
}

vorpal
    .command("dir")
    .autocomplete(vorpal_autocomp())
    .option("-x", "This displays the short names generated for non-8dot3 file names.")
    .description("Displays a list of files and subdirectories within a directory.")
    .action(command_dir);

//
// MKDIR command
// =============
//
function command_mkdir (args, callback) {

    if (!args.hasOwnProperty("dir")) {
        console.log("NO ARG GIVEN TO MKDIR\n");
        return callback();
    }

    const new_folder_path = vfs.Resolve(`${cwd_path}\\${args.dir}`);

    if (vfs.FolderExists(new_folder_path)) {
        console.log("DIR ALREADY EXISTS\n");
        return callback();
    }

    if (vfs.IsFile(new_folder_path)) {
        console.log("FILE EXISTS WITH THIS NAME\n");
        return callback();
    }

    vfs.AddFolder(new_folder_path);
    callback();
}

vorpal
    .command("mkdir [dir]")
    .autocomplete(vorpal_autocomp())
    .description("Displays the name of or changes the current directory.")
    .action(command_mkdir);


//
// DIR command
// ===========
//
function command_cd (args, callback) {

    if (!args.hasOwnProperty("path")) {
        console.log(cwd_path);
        console.log("");
        return callback();
    }

    const path = vfs.Resolve(`${cwd_path}\\${args.path}`);

    if (vfs.IsFolder(path) === false) {
        console.log("The system cannot find the path specified.");
        console.log("");
        return callback();
    }

    if (vfs.IsFile(path)) {
        console.log("The directory name is invalid.");
        console.log("");
        return callback();
    }

    // Still here? Means we can CD to this location!
    cwd_path = path;

    vorpal.delimiter(`${cwd_path}> `);
    callback();
}

vorpal
    .command("cd [path]")
    .autocomplete(vorpal_autocomp())
    .description("Displays the name of or changes the current directory.")
    .action(command_cd);


function make_vfs (opts) {

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

    return new VirtualFileSystem(new_ctx);
}
