
const detect_globals = require("acorn-globals");
const fs             = require("fs");
const istanbul       = require("istanbul");
const EventEmitter2  = require("eventemitter2").EventEmitter2;
const CWScript       = require("../winapi/WScript");
const CActiveXObject = require("../winapi/ActiveXObject");
const CDate          = require("../Date");
const vm = require("vm");



var instrumenter = new istanbul.Instrumenter(),
    cover_utils  = istanbul.utils,
    collector    = new istanbul.Collector();


function Runtime (options) {
    options = options || {};

    this.events = [];
    this.progress_cb    = options.progress || (() => {});
    this.emitter        = options.emitter  || new EventEmitter2({ wildcard: true });
    this.epoch          = options.epoch    || new Date().getTime(),
    this.assembled_code = null;

    return this;
}


Runtime.prototype.load = function(path_to_file, options) {

    options = options || {};

    this.file_path         = path_to_file;
    this.instrumented_code = null;

    try {
        this.file_contents = fs.readFileSync(path_to_file).toString();
    }
    catch (e) {
        throw e;
    }

    this._instrument_code(this.file_contents);
    this._assemble_runnable();

    // We now have `this.assembled_code`, which holds code that's ready to run, but
    // in order to do so, it needs its support scaffolding (the real magic).  Let's
    // add all of that now...
    return this._make_runnable();
}


Runtime.prototype._make_runnable = function () {

    let events            = this.events,
        assembled_code    = this.assembled_code,
        completed_fn_name = this.instrumented_code.completed_fn_name,
        epoch             = this.epoch,
        ee                = this.emitter;

     ee.on("**", function (x) {

        if (this.event.startsWith("DEBUG") || this.event.startsWith("Report")) {
            return;
        }

        events.push({ 
            event: this.event, 
            args: x, 
            t: new Date().getTime() 
        });
    });

    var self = this;

    return function (done) {

        let date      = new CDate({ emitter: ee, epoch: epoch }),
            date_inst = date();

        // Create the context -- shared by all JScript APIs.
        let context = { 
            emitter: ee,
            date:    date_inst
        };

        let WScript       = new CWScript(context);
            ActiveXObject = new CActiveXObject(context);

        function script_finished(x) {

            collector.add(x);

            let key = collector.files()[0];

            let coverage_report = {
                filename: key,
                report: cover_utils.summarizeFileCoverage(collector.fileCoverageFor(key))
            };

            self.coverage = coverage_report;
            done();
        }

        var sandbox = {
            Date: date,
            WScript: WScript,
            ActiveXObject: ActiveXObject,
        };
        sandbox[completed_fn_name] = script_finished;

        vm.createContext(sandbox);
        vm.runInContext(assembled_code, sandbox);

        /*let fn = new Function("Array", "Date", "WScript", "ActiveXObject", completed_fn_name, assembled_code);
        fn(Array, date, WScript, ActiveXObject, script_finished);*/
    };
}


Runtime.prototype._instrument_code = function (code_file_contents) {

    let covered_code         = this._instrument_inject_coverage(code_file_contents),
        hoisted_globals_code = this._instrument_hoist_global_defs(covered_code);

    this.instrumented_code = {
        covered_code      : covered_code,
        hoisted_globals   : hoisted_globals_code,
        completed_fn_name : `___cstruct_completed_${new Date().getTime()}` // Needs thought.
    };
}


Runtime.prototype._assemble_runnable = function () {

    let inscode = this.instrumented_code;

    // The outline of the code we run should look like this:
    //
    // +------------------+
    // |                  |
    // |  var foo;        | Hoisted globals, detected
    // |  var bar;        | and added by the instrumenter.
    // |                  |
    // |  debugger;       | Debugger statement, injected
    // |                  | for use with the debugger.
    // |                  |
    // |  <<code>>        | Code, as loaded from disk with
    // |                  | all coverage info added.
    // |                  |
    // |  done(coverage); | Added by us to be called at
    // |                  | the end of script-exec so we
    // +------------------+ can capture coverage information.
    //
    // Let's assemble the code we'll eventually run, starting
    // with globals.
    let assembled_code = inscode.hoisted_globals;
    //
    // Now let's add in the debugger...
    //
    assembled_code += `\n\ndebugger;\n\n`;
    //
    // ...and now our heavily instrumented coveraged code...
    //
    assembled_code += inscode.covered_code;
    //
    // ...finally, the function call we use to grab coverage
    // info and bring it back to something we can analyse.
    assembled_code += `\n\n${inscode.completed_fn_name}(__coverage__);`;

    this.assembled_code = assembled_code;
}




Runtime.prototype._instrument_hoist_global_defs = function(code) {

    // JScript treats these variables as global (non-strict JS).  As
    // we always run in strict mode, we clean-up these globals, and
    // declare them at the top-level using `var`.
    const reserved_globals = [
        "Function",
        "ActiveXObject",
        "eval",
        "this",
        "String",
        "parseInt",
        "RegExp",
        "Array",
        "Date",
        "WScript"
    ];

    let reserved_globals_RE     = new RegExp("^(?:" + reserved_globals.join("|") + ")$"),
        list_of_all_globals     = detect_globals(code),
        unreserved_globals      = [];

    list_of_all_globals
        .filter((g) => !reserved_globals_RE.test(g.name))          // Filter out reserved globals...
        .map((g) => unreserved_globals.push(`var ${g.name};`)); // Anything that's left gets var'd.

    return unreserved_globals.join("\n");
}




Runtime.prototype._instrument_inject_coverage = function (code, options) {
    options = options || {};

    let covered_code = instrumenter.instrumentSync(code, this.file_path);

    return covered_code;
}


module.exports = Runtime;