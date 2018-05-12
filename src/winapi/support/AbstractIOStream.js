const SupportTextStream = require("./TextStream");

//
// Abstract Input/Output Stream
// ============================
//
// Unfortunately, there are two TextStreams within this project.
// There's the support TextStream, and the WINAPI TextStream.  The
// support version is intended to support the ADODB Stream's
// text-mode, while the WINAPI TextStream is the WINAPI TextStream
// which represents either a file or an IO stream.
//
// The purpose of this AbstractIOStream is to focus entirely upon the
// specifics of stream-to-file operations, suh as:
//
//   - closing a stream
//   - skipping lines
//   - writing to a stream
//   - etc.
//
// However, the AbstractIOStream does NOT attempt to match any of
// Window's expected behaviour (like detailed exception messages), nor
// does it support any kind of eventing.  Instead, all of these
// details are handled upstream by the WINAPI TextStream.
//
// Given that the support TextStream does provide much of the
// implementation detail we require for this class (such as file
// save/loading, and writing to a stream), the AbstractIOStream will
// make *heavy* use of this support class.
//
class AbstractIOStream {

    constructor (context, filespec, can_read, can_write, encoding) {

        if (can_read  === undefined || can_read  === null) can_read  = true;
        if (can_write === undefined || can_write === null) can_write = false;

        this.stream = new SupportTextStream(context);

        this.backed_by = filespec;
        this.can_read  = can_read;
        this.can_write = can_write;
        this.encoding  = encoding;

        this.stream = new SupportTextStream(context);
        this.stream.charset = encoding;
        this.stream.open();

        // Let's load the contents of `filepath' in to our stream:
        //
        // TODO: Look at 'filespec' and add in Std{In,Out,Err} stuff here...
        //

        if (context.vfs.GetFile(filespec) === false) {
            context.vfs.AddFile(filespec);
        }

        this.stream.load_from_file(filespec);
    }

    //
    // PROPERTIES
    // ==========

    // Returns True if the end-of-a-line marker has been reached, or
    // False if not.
    get AtEndOfLine () {
        let stream_eol_sep = this.stream.getsep();
        return this.stream.pos_lookahead_matches(stream_eol_sep);
    }

    // Returns True if the end of a stream has been reached, or False
    // if not.
    get AtEndOfStream () {
        return this.stream.is_pos_EOS();
    }

    // Returns the current column number of the current character
    // position within the stream.
    get Column ( ) {
        return this.stream.column();
    }

    // Read-only property that returns the current line number in a
    // TextStream file.
    get Line ( ) {
        return this.stream.line();
    }

    // Read-Only - this throws.
    set line (_) {}

    //
    // Utility Methods
    // ===============
    _throw_if_read_forbidden () {

        if (this.can_read === false) {
            throw new Error("Reading is forbidden");
        }
    }

    //
    // WIN METHODS
    // ===========

    // Closes the stream.
    Close () {
        this.stream.close();
    }

    // Reads a specified number of characters from a TextStream file
    // and returns the resulting string.
    Read (n_chars) {

        this._throw_if_read_forbidden();

        return this.stream.fetch_n_chars(n_chars);
    }

    // Reads an entire TextStream file and returns the resulting
    // string.
    ReadAll () {

        this._throw_if_read_forbidden();

        let file_contents = this.stream.fetch_all();

        if (file_contents === 0) {
            throw new Error("Cannot call ReadAll on an empty file");
        }

        return file_contents;
    }

    // Reads an entire line (up to, but not including, the newline
    // character) from a TextStream file and returns the resulting
    // string.
    readline () {}

    // Skips a specified number of characters when reading a
    // TextStream file.
    skip () {}

    // Skips the next line when reading a TextStream file.
    skipline () {}

    // Writes a specified string to a TextStream file.
    write () {}

    // Writes a specified number of newline characters to a TextStream
    // file.
    writeblanklines () {}

    // Writes a specified string and newline character to a TextStream
    // file.
    writeline () {}

    //
    // OVERRIDES
    // =========
    SerialiseToStream () {}
}

module.exports = AbstractIOStream;
