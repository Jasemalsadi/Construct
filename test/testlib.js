const VirtualFileSystem = require("../src/runtime/virtfs"),
      VirtualRegistry   = require("../src/runtime/virtreg"),
      win32path         = require("path").win32;

var ctx = null;
function make_context (opts) {

    const NOOP = () => {};

    opts = opts || {};

    opts.exceptions  = opts.exceptions  || {};
    opts.environment = opts.environment || {};
    opts.config      = opts.config      || {};
    opts.streams     = opts.streams     || {};

    var default_env = {
        path: "C:\\Users\\Construct"
    };

    var default_cfg = {
        "autovivify": true
    };

    var default_streams = {
        stdin: NOOP,
        stdout: NOOP,
        stderr: NOOP
    };

    let env     = Object.assign({}, default_env,     opts.ENVIRONMENT),
        cfg     = Object.assign({}, default_cfg,     opts.config),
        streams = Object.assign({}, default_streams, opts.streams),
        epoch   = 1234567890;

    var default_assoc = {
        "txt": "Text Document",
        "jpg": "JPEG image"
    };

    function get_file_assoc (f) {

        const extname = win32path
                  .extname(win32path.basename(f))
                  .toLowerCase()
                  .replace(".", "");

        if (default_assoc.hasOwnProperty(extname)) {
            return default_assoc[extname];
        }

        return `${extname} File`;
    }

    let context = {
        epoch: epoch,
        ENVIRONMENT: env,
        CONFIG: cfg,
        emitter: { emit: () => {} },
        exceptions: {},
        vfs: {},
        vreg: {},
        skew_time_ahead_by: (n) => { this.epoch++ },
        streams: streams,
        get_env: (e) => env[e],
        get_cfg: (c) => cfg[c],
        make_uid: () => 1,
        get_hook: () => {},
        get_file_association: f => get_file_assoc(f),
        get_instance_by_id: () => {},
        add_instance: () => undefined,
        allow_event_tracking: () => true,
        disable_event_tracking: () => true,
        enable_event_tracking: () => true,
    };

    let new_ctx = Object.assign({}, context, opts);

    let vfs = new VirtualFileSystem(new_ctx);
    new_ctx.vfs = vfs;

    let vreg = new VirtualRegistry(new_ctx);
    new_ctx.vreg = vreg;
    vreg.write(
        "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\\bad",
        "calc.exe"
    );

    vreg.write(
        "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\\hello",
        "world.exe"
    );

    // We set this just so code outside of this function can access
    // the created context object should it need to.
    ctx = new_ctx;
    vfs.AddFolder(ctx.get_env("path"));

    return ctx;
}

module.exports = make_context;
