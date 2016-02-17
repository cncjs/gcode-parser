import _ from 'lodash';
import events from 'events';
import fs from 'fs';
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
}

// http://reprap.org/wiki/G-code#Special_fields
// The checksum "cs" for a GCode string "cmd" (including its line number) is computed
// by exor-ing the bytes in the string up to and not including the * character.
const computeChecksum = (s) => {
    let cs = 0;
    s = s || '';
    for (let i = 0; i < s.length; ++i) {
        let c = s[i].charCodeAt(0);
        cs = cs ^ c;
    }
    return cs;
};

class GCodeParser extends Transform {
    constructor(options) {
        super(_.extend({}, options, { objectMode: true }));
        this.options = options || {};
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

        const lines = _(chunk.split(/\r\n|\r|\n/g))
            .map((s) => {
                // Removes leading and trailing whitespace
                return _.trim(s);
            })
            .filter() // Removes empty strings from array
            .value();

        this.emit('progress', {
            current: 0, // current progress value
            total: lines.length // total progress value
        });

        _.each(lines, (line, index) => {
            const list = removeSpaces(stripComments(line))
                .match(/([a-zA-Z][0-9\+\-\.]*)|(\*[0-9]+)/igm) || [];

            let n; // Line number
            let cs; // Checksum
            let words = [];

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

            // Exclude * (Checksum) from the line
            if (line.lastIndexOf('*') >= 0) {
                line = line.substr(0, line.lastIndexOf('*'));
            }

            let obj = {};
            obj.line = line;
            obj.words = words;
            (typeof(n) !== 'undefined') && (obj.N = n); // Line number
            (typeof(cs) !== 'undefined') && (obj.cs = cs); // Checksum
            if (obj.cs && (computeChecksum(line) !== obj.cs)) {
                obj.err = true; // checksum failed
            }

            this.emit('progress', {
                current: index + 1, // current progress value
                total: lines.length // total progress value
            });

            this.push(obj);
        });

        next();
    }
    _flush(done) {
        done();
    }
}

const parseStream = (stream, callback = noop) => {
    const emitter = new events.EventEmitter();

    try {
        let results = [];
        stream.pipe(new GCodeParser())
            .on('data', (data) => {
                emitter.emit('data', data);
                results.push(data);
            })
            .on('progress', ({ current, total }) => {
                emitter.emit('progress', { current, total });
            })
            .on('end', () => {
                emitter.emit('end', results);
                callback && callback(null, results);
            })
            .on('error', callback);
    }
    catch(err) {
        callback(err);
        return;
    }

    return emitter;
};

const parseFile = (file, callback = noop) => {
    file = file || '';
    let s = fs.createReadStream(file, { encoding: 'utf8' });
    s.on('error', callback);
    return parseStream(s, callback);
};

const parseString = (str, callback = noop) => {
    let s = streamify(str);
    return parseStream(s, callback);
};

export {
    GCodeParser,
    parseStream,
    parseFile,
    parseString
};
