const assert = require("chai").assert;
const TextStream = require("../../src/winapi/TextStream");
const VirtualFileSystem = require("../../src/runtime/virtfs");

// The TextStream most commonly represents a text file, however it can
// also represent any input/output stream, such as stdin or stdout.

var context = null;

const new_vfs = () => new VirtualFileSystem({ register: () => {} });

describe("TextStream", () => {

    // A TextStream can represent either a:
    //
    //   - text file
    //   - input/output stream (such as StdIn, StdOut, and StdErr).
    //

    beforeEach(() => {
        context = {
            epoch: 1234567890,
            emitter: { emit: () => {} },
            exceptions: {
            },
            vfs: {}
        };

        context.vfs = new_vfs();
    });


    describe("Properties", () => {

        describe(".AtEndOfLine", () => {

            it("should return false for a newly opened, populated file", (done) => {

                context.vfs.AddFile("C:\\foo.txt", "aaaabbbbccccdddd");
                let ts = new TextStream(context, "C:\\foo.txt");

                assert.equal(ts.AtEndOfLine, 0);

                done();
            });

            it("should return true when pos is immediately before CRLF", (done) => {

                context.vfs.AddFile("C:\\foo.txt", "aaaa\r\nbbbb\r\ncccc\r\ndddd\r\n");
                let ts = new TextStream(context, "C:\\foo.txt");

                assert.isFalse(ts.AtEndOfLine);
                assert.equal(ts.Read(4), "aaaa");
                assert.isTrue(ts.AtEndOfLine);

                done();
            });

            it("should throw a TypeError if .AtEndOfLine is set", (done) => {

                let ctx = Object.assign({}, context, {
                    exceptions: {
                        throw_wrong_argc_or_invalid_prop_assign: () => {
                            throw new Error("cannot set .AtEndOfLine");
                        }
                    }});

                context.vfs.AddFile("C:\\foo.txt", "aaaa\r\nbbbb\r\ncccc\r\ndddd\r\n");
                let ts = new TextStream(ctx, "C:\\foo.txt");

                assert.throws(() => ts.AtEndOfLine = "hello", "cannot set .AtEndOfLine");

                done();
            });
        });


        describe(".AtEndOfStream", () => {

            it("should return true if the read position is at the EOS", (done) => {

                context.vfs.AddFile("C:\\foo.txt", "aaaa");
                let ts = new TextStream(context, "C:\\foo.txt");

                assert.isFalse(ts.AtEndOfStream);
                assert.equal(ts.Read(4), "aaaa");
                assert.isTrue(ts.AtEndOfStream);

                done();
            });

            it("should throw a TypeError if .AtEndOfStream is set", (done) => {

                let ctx = Object.assign({}, context, {
                    exceptions: {
                        throw_wrong_argc_or_invalid_prop_assign: () => {
                            throw new Error("cannot set .AtEndOfStream");
                        }
                    }});

                context.vfs.AddFile("C:\\foo.txt", "aaaa\r\nbbbb\r\ncccc\r\ndddd\r\n");
                let ts = new TextStream(ctx, "C:\\foo.txt");

                assert.throws(() => ts.AtEndOfStream = "hello", "cannot set .AtEndOfStream");

                done();
            });

        });

        describe(".Column", () => {

            it("should report the column as '1' if the backing file is empty", (done) => {

                context.vfs.AddFile("C:\\empty.txt");
                let ts = new TextStream(context, "C:\\empty.txt");

                assert.equal(ts.Column, 1);
                done();
            });

            it("should correctly report the column for multi-line files", (done) => {

                context.vfs.AddFile("C:\\multiline.txt", "abc\r\ndef");
                let ts = new TextStream(context, "C:\\multiline.txt");

                assert.equal(ts.Column, 1);

                let expected = [
                    { col: 1, chr: "a"  },
                    { col: 2, chr: "b"  },
                    { col: 3, chr: "c"  },
                    { col: 4, chr: "\r" },
                    { col: 5, chr: "\n" },
                    { col: 1, chr: "d"  }
                ];

                expected.forEach((exp) => {
                    assert.equal(ts.Column,  exp.col);
                    assert.equal(ts.Read(1), exp.chr);
                });

                done();
            });

            it("should throw if .Column is assigned-to", (done) => {

                let ctx = Object.assign({}, context, {
                    exceptions: {
                        throw_wrong_argc_or_invalid_prop_assign: () => {
                            throw new Error("cannot set .Column");
                        }
                    }});

                context.vfs.AddFile("C:\\foo.txt", "abc");
                let ts = new TextStream(ctx, "C:\\foo.txt");

                assert.throws(() => ts.Column = 1, "blah");
                done();
            });
        });

        describe(".Line", () => {
        });
    });

    describe("Methods", () => {

        describe("#Close", () => {});
        describe("#Read", () => {

            xit("should return the scalar-num chars requested to be read", (done) => {

                context.vfs.AddFile("C:\\foo.txt", "aaaabbbbccccdddd");
                let ts = new TextStream(context, "C:\\foo.txt");

                assert.equal(ts.Read(4), "aaaa");
                assert.equal(ts.Read(4), "bbbb");
                assert.equal(ts.Read(4), "cccc");
                assert.equal(ts.Read(4), "dddd");

                done();
            });

            // TODO: add tests her for can_read, can_write modes.

        });
        describe("#ReadAll", () => {});
        describe("#ReadLine", () => {});
        describe("#Skip", () => {});
        describe("#SkipLine", () => {});
        describe("#Write", () => {});
        describe("#WriteBlankLines", () => {});
        describe("#WriteLine", () => {});

    });
});
