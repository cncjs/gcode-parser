import events from 'events';
import fs from 'fs';
import timers from 'timers';
import stream, { Transform } from 'stream';

const LINE_MODES = [
  // Retains the line exactly as is, including comments and whitespace.
  // This is the default when `lineMode` is not specified.
  'original',

  // Removes comments, trims leading and trailing whitespace (spaces and tabs), but keeps the inner whitespace between code elements.
  'stripped',

  // Removes both comments and all whitespace characters.
  'compact',
];

const DEFAULT_BATCH_SIZE = 1000;
const DEFAULT_FLATTEN = false;
const DEFAULT_LINE_MODE = LINE_MODES[0];

const noop = () => {};

const streamify = (text) => {
  const s = new stream.Readable();
  s.push(text);
  s.push(null);
  return s;
};

const containsLineEnd = (() => {
  const re = new RegExp(/.*(?:\r\n|\r|\n)/g);

  return (s => !!s.match(re));
})();

// @param {array} arr The array to iterate over.
// @param {object} opts The options object.
// @param {function} iteratee The iteratee invoked per element.
// @param {function} done The done invoked after the loop has finished.
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
    const c = s[i].charCodeAt(0);
    cs ^= c;
  }
  return cs;
};

// Strips comments from a G-code line and returns stripped line and comments.
const stripCommentsEx = (line) => {
  // http://linuxcnc.org/docs/html/gcode/overview.html#gcode:comments
  // Comments can be included in a line using either parentheses "()" or a semicolon ";" to mark the rest of the line.
  // If a semicolon is enclosed within parentheses, it is not interpreted as the start of a comment.
  let strippedLine = '';
  let currentComment = '';
  let comments = [];
  let openParens = 0;

  // Detect semicolon comments before parentheses
  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === ';' && openParens === 0) {
      // Start semicolon comment outside parentheses
      comments.push(line.slice(i + 1).trim());
      openParens = 0; // Reset parentheses counter
      break; // Stop further processing after a semicolon comment
    }

    if (char === '(') {
      // Start parentheses comment
      if (openParens === 0) {
        currentComment = '';
      } else if (openParens > 0) {
        currentComment += char;
      }
      openParens = Math.min(openParens + 1, Number.MAX_SAFE_INTEGER);
    } else if (char === ')') {
      // End parentheses comment
      openParens = Math.max(0, openParens - 1);
      if (openParens === 0) {
        comments.push(currentComment.trim());
        currentComment = '';
      } else if (openParens > 0) {
        currentComment += char;
      }
    } else if (openParens > 0) {
      // Inside parentheses comment
      currentComment += char;
    } else {
      // Normal text outside comments
      strippedLine += char;
    }
  }

  strippedLine = strippedLine.trim();

  return [strippedLine, comments];
};

// Returns the stripped line without comments.
const stripComments = (line) => stripCommentsEx(line)[0];

// Removes whitespace characters.
const stripWhitespace = (line) => {
  const re = new RegExp(/\s+/g);
  return line.replace(re, '');
};

// @param {string} line The G-code line
const parseLine = (() => {
  // eslint-disable-next-line no-useless-escape
  const re = /(%.*)|({.*)|((?:\$\$)|(?:\$[a-zA-Z0-9#]*))|([a-zA-Z][0-9\+\-\.]+)|(\*[0-9]+)/igm;

  return (line, options = {}) => {
    const flatten = !!(options?.flatten ?? DEFAULT_FLATTEN);
    let lineMode = options?.lineMode ?? DEFAULT_LINE_MODE;
    if (!LINE_MODES.includes(options?.lineMode)) {
      lineMode = DEFAULT_LINE_MODE;
    }

    const result = {
      line: '',
      words: [],
    };

    let ln; // Line number
    let cs; // Checksum
    const originalLine = line;
    const [strippedLine, comments] = stripCommentsEx(line);
    const compactLine = stripWhitespace(strippedLine);

    if (lineMode === 'compact') {
      result.line = compactLine;
    } else if (lineMode === 'stripped') {
      result.line = strippedLine;
    } else {
      result.line = originalLine;
    }

    const words = compactLine.match(re) || [];

    if (comments.length > 0) {
      result.comments = comments;
    }

    for (let i = 0; i < words.length; ++i) {
      const word = words[i];
      const letter = word[0].toUpperCase();
      const argument = word.slice(1);

      // Parse % commands for bCNC and CNCjs
      // - %wait Wait until the planner queue is empty
      if (letter === '%') {
        result.cmds = (result.cmds || []).concat(line.trim());
        continue;
      }

      // Parse JSON commands for TinyG and g2core
      if (letter === '{') {
        result.cmds = (result.cmds || []).concat(line.trim());
        continue;
      }

      // Parse $ commands for Grbl
      // - $C Check gcode mode
      // - $H Run homing cycle
      if (letter === '$') {
        result.cmds = (result.cmds || []).concat(`${letter}${argument}`);
        continue;
      }

      // N: Line number
      if (letter === 'N' && typeof ln === 'undefined') {
        // Line (block) number in program
        ln = Number(argument);
        continue;
      }

      // *: Checksum
      if (letter === '*' && typeof cs === 'undefined') {
        cs = Number(argument);
        continue;
      }

      let value = Number(argument);
      if (Number.isNaN(value)) {
        value = argument;
      }

      if (flatten) {
        result.words.push(letter + value);
      } else {
        result.words.push([letter, value]);
      }
    }

    // Line number
    (typeof (ln) !== 'undefined') && (result.ln = ln);

    // Checksum
    (typeof (cs) !== 'undefined') && (result.cs = cs);
    if (result.cs && (computeChecksum(line) !== result.cs)) {
      result.err = true; // checksum failed
    }

    return result;
  };
})();

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
    const results = [];
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
  } catch (err) {
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
  return parseStream(streamify(str), options, callback);
};

const parseStringSync = (str, options) => {
  const results = [];
  const lines = str.split('\n');

  for (let i = 0; i < lines.length; ++i) {
    const line = lines[i].trim();
    if (line.length === 0) {
      continue;
    }
    const result = parseLine(line, options);
    results.push(result);
  }

  return results;
};

const parseFileSync = (file, options) => {
  return parseStringSync(fs.readFileSync(file, 'utf8'), options);
};

// @param {string} str The G-code text string
// @param {options} options The options object
class GCodeLineStream extends Transform {
  state = {
    lineCount: 0,
    lastChunkEndedWithCR: false
  };

  options = {
    batchSize: DEFAULT_BATCH_SIZE,
    flatten: DEFAULT_FLATTEN,
    lineMode: DEFAULT_LINE_MODE,
  };

  lineBuffer = '';

  re = new RegExp(/.*(?:\r\n|\r|\n)|.+$/g);

  // @param {object} [options] The options object
  // @param {number} [options.batchSize] The batch size.
  // @param {boolean} [options.flatten] True to flatten the array, false otherwise.
  // @param {number} [options.lineMode] The line mode.
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

    if (!containsLineEnd(chunk)) {
      next();
      return;
    }

    const lines = this.lineBuffer.match(this.re);
    if (!lines || lines.length === 0) {
      next();
      return;
    }

    // Do not split CRLF which spans chunks
    if (this.state.lastChunkEndedWithCR && lines[0] === '\n') {
      lines.shift();
    }

    this.state.lastChunkEndedWithCR = (this.lineBuffer[this.lineBuffer.length - 1] === '\r');

    if ((this.lineBuffer[this.lineBuffer.length - 1] === '\r') ||
      (this.lineBuffer[this.lineBuffer.length - 1] === '\n')) {
      this.lineBuffer = '';
    } else {
      const line = lines.pop() || '';
      this.lineBuffer = line;
    }

    iterateArray(lines, { batchSize: this.options.batchSize }, (line) => {
      line = line.trim();
      if (line.length > 0) {
        const result = parseLine(line, this.options);
        this.push(result);
      }
    }, next);
  }

  _flush(done) {
    if (this.lineBuffer) {
      const line = this.lineBuffer.trim();
      if (line.length > 0) {
        const result = parseLine(line, this.options);
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
  parseFile,
  parseFileSync,
  parseLine,
  parseStream,
  parseString,
  parseStringSync,
  stripComments,
};
