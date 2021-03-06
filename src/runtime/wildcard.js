const path = require("path").win32;

function translate_pattern (pattern, options) {

    options = options || {};
    options = Object.assign({ skip_qmark: false }, options);

    let normpat  = normalise(pattern),
        transpat = normpat
            .replace(/\.\?/g, '"?')
            .replace(/\.\*/g, '"*')
            .replace(/[?]/g, ">");

    if (/[*]$/.test(transpat) && /[.]$/.test(pattern)) {
        transpat = transpat.replace(/\*$/, "<");
    }

    return transpat;
}

function normalise (str) {
    return path.normalize(str).replace(/[.\s]+$/g, "");
}

// is_lexed_pattern_literal
// ========================
//
// Given a pattern outputted from the lexer, figure out if the pattern
// contains only "LITERAL" elements -- useful when trying to optimise
// matches.
//
function is_lexed_pattern_literal (lexed_pattern) {
    return lexed_pattern.every(tok => tok.type === "LITERAL");
}

function is_filename_shortname (filename) {

    if (filename.length <= 8) {
        return true;
    }

    if ((filename.match(/\./g) || []).length > 1) {
        // Shortnames may only have a single dot in their name --
        // any more than that and this isn't a shortname.
        return false;
    }

    if (filename.includes(".")) {

        let name_and_ext_parts = filename.split("."),
            namepart           = name_and_ext_parts[0],
            extpart            = name_and_ext_parts[1];

        if (namepart.length > 0 && namepart.length <= 8) {
            if (extpart.length <= 3) { // Extensions are optional.
                // .TODO1
                // Need to finish the shortname checks...
                // .TODO2
                return true;
            }
        }
    }

    return false;
}

function lex_pattern (pattern) {

    let token_list = pattern.split("").map((ch, i, arr) => {

        let token = { pos: i, type: "symbol" };

        switch (ch) {
        case "*":
            token.value = "ASTERISK";
            break;
        case "?":
            token.value = "QMARK";
            break;
        case "<":
            token.value = "DOS_STAR";
            break;
        case ">":
            token.value = "DOS_QM";
            break;
        case '"':
            token.value = "DOS_DOT";
            break;
        default:
            token.type  = "literal";
            token.value = ch;
        }

        return token;
    });

    return token_list;
}


function lex_filename (filename) {

    const last_dot_pos = filename.lastIndexOf(".");
    const is_shortname = is_filename_shortname(filename);

    return filename.split("").map((tok, i) => {
        return {
            pos: i,
            type: "literal",
            value: tok,
            is_last_dot: (last_dot_pos === i),
            is_after_last_dot: (last_dot_pos < i),
            is_before_last_dot: (last_dot_pos > i),
            sfn: is_shortname
        };
    });
}

// matcher_helper
// ==============
//
// Helps set-up a match be ensuring that patterns and files are
// correctly normalised and optimised ready for matching.
//
function matcher_helper (files, pattern, options) {

    options = options || { skip_qmark: false };

    pattern = translate_pattern(pattern.toLowerCase());

    const lpattern = lex_pattern(pattern),
          pattern_is_literal = is_lexed_pattern_literal(lpattern);

    if (pattern_is_literal) {
        return files.filter(f => f.toLowerCase() === pattern.toLowerCase());
    }

    let matches = files.filter(f => matcher(lex_filename(normalise(f)), lpattern));

    return matches;
}

// matcher
// =======
//
// A recursive matcher which tries to emulate the Windows wildcard
// patterns.  Both arguments are expected to be list of tokens
// as-generated by either `lex_pattern' or `lex_filename'.
//
// Supported match symbols and their behaviours:
//
//   ASTERISK(*)
//   -----------
//   Greedily matches zero or more characters.
//
//
//   QMARK(?)
//   --------
//   Matches exactly one character.
//
//
//   DOS_STAR(<)
//   -----------
//
//   Greedily matches zero or more chars.  Has special-case handling
//   for the last DOT appearing in a filename, which is greedily
//   matched.
//
//
//   DOS_QM(>)
//   ---------
//
//   Matches exactly one or zero characters.  Conditions for a
//   zero-char match are:
//
//     1. DOS_QM appears to the left of a DOT.
//     2. DOS_QM appears at the end of the pattern string.
//     3. DOS_QM appears contiguous to other DOS_QMs, in positions #1 or #2.
//
//
//   DOS_DOT
//   -------
//   Matches a literal DOT.  Matches zero chars if DOS_DOT appears at
//   the end of the pattern string.
//
function matcher (filename, pattern) {

    if (filename.length === 0 && pattern.length === 0) return true;
    if (filename.length >   0 && pattern.length === 0) return false;

    const tok_filename = filename[0],
          tok_pattern  = pattern[0];

    if (tok_pattern.type === "literal") {

        if (tok_filename && tok_pattern.value.toLowerCase() === tok_filename.value.toLowerCase()) {
            let match = matcher(filename.slice(1), pattern.slice(1));
            return match;
        }

        return false;
    }

    if (tok_pattern.value === "ASTERISK" /* * */) {

        if (filename.length === 0) {
            return matcher(filename, pattern.slice(1));
        }

        if (matcher(filename.slice(1), pattern) === false) {
            return matcher(filename, pattern.slice(1));
        }

        return matcher(filename.slice(1), pattern);
    }
    else if (tok_pattern.value === "QMARK" /* ? */) {
        let match = matcher(filename.slice(1), pattern.slice(1));
        return match;
    }
    else if (tok_pattern.value === "DOS_STAR" /* < */) {

        if (tok_filename === undefined) {
            return true;
        }

        if (tok_filename.value === ".") {

            if (tok_filename.is_last_dot) {
                if (matcher(filename.slice(1), pattern.slice(1)) === false) {
                    return matcher(filename, pattern.slice(1));
                }
            }

            if (matcher(filename.slice(1), pattern) === true) {
                return true;
            }

            return matcher(filename.slice(1), pattern.slice(1));
        }

        // Explore the greedy branch which tries to match filename
        // chars without giving up any pattern chars.
        var match = matcher(filename.slice(1), pattern);
        return match;
    }
    else if (tok_pattern.value === "DOS_QM" /* > */) {

        // Matches zero if:
        //
        //  - appears to the left of a dot
        //  - appears at the end of the string
        //  - appears contiguous to other DOS_QM that are in either of the above positions.
        //
        if (tok_filename === undefined) {
            return matcher(filename, pattern.slice(1));
        }
        else if (tok_filename.value === ".") {
            return matcher(filename, pattern.slice(1));
        }

        // Match any single character.
        return matcher(filename.slice(1), pattern.slice(1));
    }
    else if (tok_pattern.value === "DOS_DOT" /* " */) {
        //
        // Matches a dot or zero characters at the end of the
        // string.
        //
        if (filename.length === 0) return true;

        if (tok_filename.value === ".") {
            return matcher(filename.slice(1), pattern.slice(1));
        }
    }

    return false;
}

module.exports = {
    match       : matcher_helper,
    is_shortname: is_filename_shortname
};
