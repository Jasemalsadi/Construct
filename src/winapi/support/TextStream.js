const Stream = require("./Stream");
const iconv  = require("iconv-lite");

class TextStream extends Stream {

    constructor (context) {

        super(context);

        this.__name__ = "TextStream";
        this.__id__   = context.make_uid();

        this.has_encoding_bytes = false;

        // https://docs.microsoft.com/en-us/sql/ado/reference/ado-api/streamwriteenum
        this.STREAM_WRITE_ENUM = {
            WriteChar: 0, // DEFAULT, writes a string to (as-is) to the buffer.
            WriteLine: 1  // Writes `concat(string, LINE_SEP)' to the buffer.
        };

        this.STREAM_READ_ENUM = {
            ReadAll: -1,
            ReadLine: -2
        };

        this.CHARSETS = {
            "unicode" : { encoding: "utf16-le",      bytes_width: 2 },
            "ascii"   : { encoding: "windows-1252", bytes_width: 1 }
        };

        // https://docs.microsoft.com/en-us/sql/ado/reference/ado-api/lineseparatorsenum
        this.LINE_SEPARATOR_ENUM = {
            CR:   13, // Carriage return
            CRLF: -1, // Default. Carriage return + line feed.
            LF:   10  // Line feed.
        };

        this.LINE_SEPARATORS = {
            CR:   "\r",
            CRLF: "\r\n",
            LF:   "\n"
        };

        this.pos            = 0;
        this.stream_is_open = false;
        this.linesep        = this.LINE_SEPARATOR_ENUM.CRLF;
        this.UTF16LE_BOM    = Buffer.from([0xFF, 0xFE]);
        this._charset_name = "Unicode";
        this._charset = this.CHARSETS.unicode;
    }

    get charset () {
        return this._charset_name;
    }
    set charset (charset) {

        if (this.pos !== 0) {
            throw new Error("Cannot change charset when position is not zero");
        }

        if (Object.keys(this.CHARSETS).includes(charset.toLowerCase())) {
            this._charset_name = charset;
            this._charset = this.CHARSETS[charset.toLowerCase()];
        }
        else {
            throw new Error(`Cannot change charset - unknown charset supplied: ${charset}`);
        }
    }
    _buffer_has_BOM (buf) {

        if (! buf || buf.byteLength <= 1) return false;
        return this.UTF16LE_BOM.equals(buf.slice(0, 2));
    }

    get type () {
        return 2;
    }

    set separator (opt) {

        if (opt !== this.LINE_SEPARATOR_ENUM.CR &&
            opt !== this.LINE_SEPARATOR_ENUM.CRLF &&
            opt !== this.LINE_SEPARATOR_ENUM.LF) {
            throw new Error(`Line separator value "${opt}" is not recognised.`);
        }

        this.linesep = opt;
    }
    get separator () {
        return this.linesep;
    }

    getsep (type) {

        if (type === undefined || type === null) {
            type = this.linesep;
        }

        var linesep;

        switch (type) {
        case this.LINE_SEPARATOR_ENUM.CR:
            linesep = this.LINE_SEPARATORS.CR;
            break;

        case this.LINE_SEPARATOR_ENUM.LF:
            linesep = this.LINE_SEPARATORS.LF;
            break;

        case this.LINE_SEPARATOR_ENUM.CRLF:
            linesep = this.LINE_SEPARATORS.CRLF;
            break;
        }

        return iconv.encode(Buffer.from(linesep), this._charset.encoding);
    }


    skipline (line_sep_val) {

        if (line_sep_val === undefined || line_sep_val === null) {
            line_sep_val = this.linesep;
        }

        let encoded_line_separator = this.getsep(line_sep_val),
            possible_nextline_pos  = this.buffer.indexOf(encoded_line_separator, this.pos);

        if (possible_nextline_pos === -1) {
            // No further newlines were found.
            possible_nextline_pos = this.buffer.byteLength;
        }
        else {
            // Using `buffer.indexOf' will return us the first byte of
            // the separator, where we actually want the first byte
            // AFTER the separator, so we add on the linesep width:
            possible_nextline_pos += encoded_line_separator.byteLength;
        }

        this.pos = possible_nextline_pos;
    }


    fetch_line () {

        if (! this.buffer || this.buffer.byteLength === 0 || this.pos === this.buffer.byteLength) {
            return "";
        }

        // Skip line will set POS to be the first byte AFTER the
        // lineseparator.
        let start_pos = this.pos;
        this.skipline();

        let outbuf  = this.buffer.slice(start_pos, this.pos),
            linesep = this.getsep();

        // We strip any trailing newline chars from outbuf before
        // decoding it...
        let outbuf_newline_index = outbuf.indexOf(linesep);

        if (outbuf_newline_index === 0) {
            return "";
        }
        else if (outbuf_newline_index > 0) {
            outbuf = outbuf.slice(0, outbuf_newline_index);
        }

        return iconv.decode(outbuf, this._charset.encoding);
    }


    fetch_all (opts) {

        opts = opts || { as_buffer: false };

        if (this.buffer.byteLength === 0) {
            return 0;
        }

        let buf = this._fetch_all();

        if (opts.as_buffer) {
            return buf;
        }

        return iconv.decode(buf, this._charset.encoding);
    }


    fetch_n_chars (n_chars) {

        if (n_chars === undefined || n_chars === null) {
            n_chars = this.buffer.byteLength;
        }

        // Windows will automatically advance the position when ALL of
        // the following conditions are true:
        let advance_pos = (this._buffer_has_BOM(this.buffer) &&
                           this._charset.encoding === "utf16-le" &&
                           this.buffer.byteLength >= 2 &&
                           this.position === 0);

        if (advance_pos) {
            this.pos = 2;
        }

        let buf = this._fetch_n_bytes(n_chars * this._charset.bytes_width);
        return iconv.decode(buf, this._charset.encoding);
    }


    _stream_requires_BOM () {

        // Looks as though Windows only adds the Byte Order Mark (BOM)
        // under the following conditions:
        //
        //  - the stream's charset is "Unicode", and
        //  - the stream's size is zero.
        //
        // A good example test of this is adding an empty string ("")
        // to an ADODB.Stream in text mode (2):
        //
        //   var ado = new ActiveXObject("ADODB.Stream");
        //   ado.open();
        //   ado.type    = 2;
        //   ado.charset = "Unicode";
        //   WScript.Echo(ado.size, ado.position); // prints=> "0, 0"
        //   ado.WriteText("");
        //   WScript.Echo(ado.size, ado.position); // prints=> "2, 2".
        //
        let has_utf16_charset = this._charset.encoding === "utf16-le",
            has_empty_buffer  = this.buffer.byteLength === 0;

        return has_utf16_charset && has_empty_buffer;
    }


    put (data, options) {

        if (data === null) {
            throw new Error("Type mismatch - cannot write null data to this stream.");
        }

        if (!this.stream_is_open) {
            throw new Error("Stream is not open for writing.");
        }

        if (data === undefined || data === []) {
            data = "";
        }
        else if (Buffer.isBuffer(data)) {
            // Leave a buffer as-is.
        }
        else if (typeof data === "object") {
            data = data.toString();
        }

        if (typeof data === "string") {
            data = iconv.encode(
                data,
                this._charset.encoding, { addBOM: this._stream_requires_BOM() }
            );
        }

        if (this._charset.encoding === "utf16-le" && this.pos === 0 && this.buffer.byteLength >= 2) {
            this.pos = 2;
        }

        // Options handling
        // ================
        //
        // Only two options are supported, both are defined in the
        // `StreamWriteEnum' as:
        //
        // | Value | Description                                                        |
        // |-------|--------------------------------------------------------------------|
        // |   0   | Default. Writes the text specified by `data' in to the stream buf. |
        // |   1   | Writes `data' + the current `this.linesep' value.                  |
        //
        // The different line separators are defined in the
        // `LineSeparatorsEnum', with values:
        //
        // | Value | Description                                          |
        // |-------|------------------------------------------------------|
        // |  13   | Carriage return (CR).                                |
        // |  -1   | Default. Indicates carriage return line feed (CRLF). |
        // |  10   | Line feed (LF).                                      |
        //
        // https://docs.microsoft.com/en-us/sql/ado/reference/ado-api/lineseparatorsenum?view=sql-server-2017
        //
        if (options === undefined || options === null) {
            options = 0; // Default - do not add a linesep.
        }

        if (options === 1) {

            var sep;

            // Calling-code indicates that it wants us to append a
            // line separator to `data'...
            if (this.linesep === this.LINE_SEPARATOR_ENUM.CR) {
                sep = this.LINE_SEPARATORS.CR;
            }
            else if (this.linesep === this.LINE_SEPARATOR_ENUM.LF) {
                sep = this.LINE_SEPARATORS.LF;
            }
            else if (this.linesep === this.LINE_SEPARATOR_ENUM.CRLF) {
                sep = this.LINE_SEPARATORS.CRLF;
            }

            data = Buffer.concat([data, iconv.encode(sep, this._charset.encoding)]);
        }
        else if (options !== 0) {
            throw new Error("Unknown option value to #put -- only '0' and '1' are allowed.");
        }

        this.put_buf(data);
    }

    copy_to (dest_stream, num_chars) {

        var stream_contents;

        if (num_chars === undefined || num_chars === null || num_chars === -1) {
            let is_binary_stream = dest_stream.constructor.name === "BinaryStream";
            stream_contents = this.fetch_all({ as_buffer: is_binary_stream });
        }
        else {
            stream_contents = this.fetch_n_chars(num_chars);
        }

        dest_stream.put(stream_contents);
    }

    load_into_stream (stream_contents) {
        this.buffer = Buffer.from(stream_contents);
    }

    load_from_file (path, decode_contents) {

        if (decode_contents === undefined || decode_contents === null) {
            decode_contents = true;
        }

        let file_contents = this._load_from_file(path);

        if (decode_contents) {
            this.buffer = Buffer.alloc(0);
            this.put(iconv.decode(file_contents, this._charset.encoding));
        }
        else {
            this.buffer = Buffer.from(file_contents);
        }

        this.pos = 0;
    }

    to_binary_stream () {

        const BinaryStream = require("./BinaryStream");

        let bs = new BinaryStream(this.context);

        bs.open();
        bs.put(this.buffer);
        bs.position = this.pos; // TODO: int division?

        if (!this.stream_is_open) {
            bs.close();
        }

        return bs;
    }

    // Allows the looking ahead from the current pos to see if the
    // following buffer bytes matches that passed as an argument.
    // Does not alter the position, or alter the object's internal
    // state in any way.  Will return True if the next bytes exactly
    // match `buf', or False otherwise.
    pos_lookahead_matches (buf, pos) {

        if (pos === undefined || pos === null) {
            pos = this.pos;
        }

        if (buf.byteLength === 0) return false;

        let existing_buf = this.buffer.slice(pos, pos + buf.byteLength);
        return buf.equals(existing_buf);
    }

    // The `column' method returns the current column within the
    // TextStream that `pos' is pointing-at.  Columns end with the
    // stream's line separator.  The first column is always column 0.
    column () {

        if (this.buffer.byteLength === 0) return 1;

        //
        // What follows is not a very elegant algorithm for finding
        // the current column, however I am more concerned with
        // correctness and over grace at this time.
        //
        let curr_column    = 1,
            curr_position  = 0,
            line_separator = Buffer.from(this.getsep()),
            column_vector  = [];

        if (this.pos === 0) return curr_column;

        while (curr_position < this.buffer.byteLength) {

            if (this.pos_lookahead_matches(line_separator, curr_position)) {
                //
                // We now know that `line_separator.byteLength' ahead
                // of us is a new line, so we can fill in column
                // fields all the way to the new line.
                //
                // |"A"|"B"|"C"|CR|LF|"D"|"E"|...
                //           ^
                //           |
                //   From here, we know CR and LF follow,
                //   so we can fill-in the column info in our array,
                //   and advance the PTR forward to "D".
                //
                for (let i = 0; i < line_separator.byteLength; i++) {
                    column_vector[curr_position++] = curr_column++;
                }

                curr_column = 1;
                continue;
            }

            column_vector[curr_position++] = curr_column++;
        }

        return column_vector[this.pos];
    }

    line () {

        if (this.buffer.byteLength === 0 || this.pos === 0) return 1;

        let curr_line      = 1,
            curr_position  = 0,
            line_separator = Buffer.from(this.getsep()),
            line_vector    = [],
            eol_exit       = true;

        while (curr_position < this.buffer.byteLength) {

            eol_exit = false;

            if (this.pos_lookahead_matches(line_separator, curr_position)) {

                // See #column() for algorithm.

                for (let i = 0; i < line_separator.byteLength; i++) {
                    line_vector[curr_position++] = curr_line;
                }

                curr_line++;
                eol_exit = true;
                continue;
            }

            line_vector[curr_position++] = curr_line;
        }

        if (this.pos === this.buffer.byteLength) return curr_line++;

        return line_vector[this.pos];
    }

    skip_n_chars (n_chars) {

        const buffer_length = this.buffer.byteLength,
              skip_distance = this.pos + (n_chars * this._charset.bytes_width);

        if (skip_distance > buffer_length) {
            throw new Error("Cannot skip beyond buffer length");
        }

        this.pos = skip_distance;
    }

    buffer_length_bytes () {
        return this.buffer.byteLength;
    }
}

module.exports = TextStream;
