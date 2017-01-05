import _ from 'lodash';
import events from 'events';
import fs from 'fs';
import timers from 'timers';
import stream, { Transform } from 'stream';

const noop = () => {};

const streamify = (text) => {
    let s = new stream.Readable();
    s.push(text);
    s.push(null);
    return s;
};

const stripComments = (s) => {
    const re1 = /\s*[%#;].*/g; // Strip everything after %, #, or ; to the end of the line, including preceding spaces
    const re2 = /\s*\(.*\)/g; // Remove anything inside the parentheses
    return s.replace(re1, '').replace(re2, '');
};

const removeSpaces = (s) => {
    return s.replace(/\s+/g, '');
};

const containsNewline = (s) => {
    return !!s.match(/.*(?:\r\n|\r|\n)/g);
};

// http://reprap.org/wiki/G-code#Special_fields
// The checksum "cs" for a GCode string "cmd" (including its line number) is computed
// by exor-ing the bytes in the string up to and not including the * character.
const computeChecksum = (s) => {
    s = s || '';
    if (s.lastIndexOf('*') >= 0) {
        s = s.substr(0, s.lastIndexOf('*'));
    }

    let cs = 0;
    for (let i = 0; i < s.length; ++i) {
        let c = s[i].charCodeAt(0);
        cs = cs ^ c;
    }
    return cs;
};

// @param {array} arr The array to iterate over
// @param {object} opts The options object
// @param {function} iteratee The iteratee invoked per element
// @param {function} done The done invoked after the loop has finished
const iterateArray = (arr = [], opts = {}, iteratee = noop, done = noop) => {
    if (typeof opts === 'function') {
        done = iteratee;
        iteratee = opts;
        opts = {};
    }

    opts.batchSize = opts.batchSize || 1;

    const loop = (i = 0) => {
        for (let count = 0; i < arr.length && count < opts.batchSize; ++i, ++count) {
            iteratee(arr[i], i, arr);
        }
        if (i < arr.length) {
            timers.setImmediate(() => loop(i));
            return;
        }
        done();
    };
    loop();
};

// @param {string} line The G-code line
const parseLine = (line, options) => {
    options = options || {};
    options.lineOnly = options.lineOnly || false;

    const result = {
        line: line
    };

    if (!options.lineOnly) {
        let n; // Line number
        let cs; // Checksum
        const words = [];
        const list = removeSpaces(stripComments(line))
            .match(/([a-zA-Z][0-9\+\-\.]*)|(\*[0-9]+)/igm) || [];
        _.each(list, (word) => {
            let letter = word[0].toUpperCase();
            let argument = word.substr(1);

            argument = _.isNaN(parseFloat(argument)) ? argument : Number(argument);

            //
            // Special fields
            //

            { // N: Line number
                if (letter === 'N' && _.isUndefined(n)) {
                    // Line (block) number in program
                    n = Number(argument);
                    return;
                }
            }

            { // *: Checksum
                if (letter === '*' && _.isUndefined(cs)) {
                    cs = Number(argument);
                    return;
                }
            }

            words.push([letter, argument]);
        });

        result.words = words;

        (typeof(n) !== 'undefined') && (result.N = n); // Line number
        (typeof(cs) !== 'undefined') && (result.cs = cs); // Checksum
        if (result.cs && (computeChecksum(line) !== result.cs)) {
            result.err = true; // checksum failed
        }
    }

    return result;
};

// @param {object} stream The G-code line stream
// @param {options} options The options object
// @param {function} callback The callback function
const parseStream = (stream, options, callback = noop) => {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }

    const emitter = new events.EventEmitter();

    try {
        let results = [];
        stream
            .pipe(new GCodeLineStream(options))
            .on('data', (data) => {
                emitter.emit('data', data);
                results.push(data);
            })
            .on('end', () => {
                emitter.emit('end', results);
                callback && callback(null, results);
            })
            .on('error', callback);
    }
    catch(err) {
        callback(err);
    }

    return emitter;
};

// @param {string} file The G-code path name
// @param {options} options The options object
// @param {function} callback The callback function
const parseFile = (file, options, callback = noop) => {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }
    file = file || '';
    let s = fs.createReadStream(file, { encoding: 'utf8' });
    s.on('error', callback);
    return parseStream(s, options, callback);
};

// @param {string} str The G-code text string
// @param {options} options The options object
// @param {function} callback The callback function
const parseString = (str, options, callback = noop) => {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }
    let s = streamify(str);
    return parseStream(s, options, callback);
};

class GCodeLineStream extends Transform {
    state = {
        lineCount: 0,
        lastChunkEndedWithCR: false,
    };
    options = {
        batchSize: 1000,
        lineOnly: false
    };
    lineBuffer = '';

    // @param {object} [options] The options object
    // @param {number} [options.batchSize] The batch size.
    // @param {boolean} [options.lineOnly] True to contain only lines, false otherwise.
    constructor(options = {}) {
        super({ objectMode: true });

        this.options = {
            ...this.options,
            ...options
        };
    }

    _transform(chunk, encoding, next) {
        // decode binary chunks as UTF-8
        encoding = encoding || 'utf8';

        if (Buffer.isBuffer(chunk)) {
            if (encoding === 'buffer') {
                encoding = 'utf8';
            }
            chunk = chunk.toString(encoding);
        }

        this.lineBuffer += chunk;

        if (!containsNewline(chunk)) {
            next();
            return;
        }

        let lines = this.lineBuffer.match(/.*(?:\r\n|\r|\n)|.+$/g);
        if (!lines || lines.length === 0) {
            next();
            return;
        }

        // Do not split CRLF which spans chunks
        if (this.state.lastChunkEndedWithCR && lines[0] === '\n') {
            lines.shift();
        }

        this.state.lastChunkEndedWithCR = _.endsWith(this.lineBuffer, '\r');

        if (_.endsWith(this.lineBuffer, '\r') || _.endsWith(this.lineBuffer, '\n')) {
            this.lineBuffer = '';
        } else {
            let line = lines.pop(lines) || '';
            this.lineBuffer = line;
        }

        iterateArray(lines, { batchSize: this.options.batchSize }, (line, key) => {
            line = _.trimEnd(line);
            if (line.length > 0) {
                const result = parseLine(line, { lineOnly: this.options.lineOnly });
                this.push(result);
            }
        }, next);
    }
    _flush(done) {
        if (this.lineBuffer) {
            const line = _.trimEnd(this.lineBuffer);
            if (line.length > 0) {
                const result = parseLine(line, { lineOnly: this.options.lineOnly });
                this.push(result);
            }

            this.lineBuffer = '';
            this.state.lastChunkEndedWithCR = false;
        }

        done();
    }
}

export {
    GCodeLineStream,
    parseLine,
    parseStream,
    parseFile,
    parseString
};
