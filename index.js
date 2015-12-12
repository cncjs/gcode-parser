import _ from 'lodash';
import fs from 'fs';
import stream, { Transform } from 'stream';

const streamify = (text) => {
    let s = new stream.Readable();
    s.push(text);
    s.push(null);
    return s;
};

const stripComments = (s) => {
    let re1 = /^\s+|\s+$/g; // Strip leading and trailing spaces
    let re2 = /\s*[#;].*$/g; // Strip everything after # or ; to the end of the line, including preceding spaces
    return s.replace(re1, '').replace(re2, '');
};

const removeSpaces = (s) => {
    return s.replace(/\s+/g, '');
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

        let lines = chunk.split(/\r\n|\r|\n/g);
        _.each(lines, (line) => {
            line = _.trim(stripComments(line));
            if (line.length === 0) {
                return;
            }

            let n;
            let checksum;
            let words = [];
            let list = removeSpaces(line)
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
                    if (letter === '*' && _.isUndefined(checksum)) {
                        checksum = Number(argument);
                        return;
                    }
                }

                words.push([letter, argument]);
            });

            let obj = {};
            obj.line = line;
            obj.words = words;
            (typeof(n) !== 'undefined') && (obj.N = n); // N: Line number
            (typeof(checksum) !== 'undefined') && (obj.checksum = checksum); // *: Checksum

            this.push(obj);
        });

        next();
    }
    _flush(done) {
        done();
    }
}

const parseStream = (stream, callback) => {
    callback = callback || ((err) => {});

    try {
        let results = [];
        stream.pipe(new GCodeParser())
            .on('data', (data) => {
                results.push(data);
            })
            .on('end', () => {
                callback(null, results);
            })
            .on('error', callback);
    }
    catch(err) {
        callback(err);
        return;
    }

    return stream;
};

const parseFile = (file, callback) => {
    file = file || '';
    let s = fs.createReadStream(file, { encoding: 'utf8' });
    s.on('error', callback);
    return parseStream(s, callback);
};

const parseText = (text, callback) => {
    let s = streamify(text);
    return parseStream(s, callback);
};

export {
    GCodeParser,
    parseStream,
    parseFile,
    parseText
};
