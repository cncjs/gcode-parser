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
            line = _.trim(stripComments(line)) || '';
            if (line.length === 0) {
                return;
            }

            let n;
            let words = [];
            let list = line.match(/([a-zA-Z][^\s]*)/igm) || [];
            _.each(list, (word) => {
                let r = word.match(/([a-zA-Z])([^\s]*)/) || [];
                let letter = (r[1] || '').toUpperCase();
                let argument = _.isNaN(parseFloat(r[2])) ? r[2] : Number(r[2]);

                if (letter === 'N' && (typeof n === 'undefined')) {
                    // Line (block) number in program
                    n = Number(argument);
                    return;
                }

                words.push([letter, argument]);
            });

            this.push({
                line: line,
                N: n,
                words: words
            });
        });

        next();
    }
    _flush(done) {
        done();
    }
}

const parseStream = (stream, callback) => {
    let results = [];
    callback = callback || (() => {});
    return stream.pipe(new GCodeParser())
        .on('data', (data) => {
            results.push(data);
        })
        .on('end', () => {
            callback(null, results);
        })
        .on('error', callback);
};

const parseFile = (file, callback) => {
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
