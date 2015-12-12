'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.parseText = exports.parseFile = exports.parseStream = exports.GCodeParser = undefined;

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _stream = require('stream');

var _stream2 = _interopRequireDefault(_stream);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var streamify = function streamify(text) {
    var s = new _stream2.default.Readable();
    s.push(text);
    s.push(null);
    return s;
};

var stripComments = function stripComments(s) {
    var re1 = /^\s+|\s+$/g; // Strip leading and trailing spaces
    var re2 = /\s*[#;].*$/g; // Strip everything after # or ; to the end of the line, including preceding spaces
    return s.replace(re1, '').replace(re2, '');
};

var removeSpaces = function removeSpaces(s) {
    return s.replace(/\s+/g, '');
};

// http://reprap.org/wiki/G-code#Special_fields
// The checksum "cs" for a GCode string "cmd" (including its line number) is computed
// by exor-ing the bytes in the string up to and not including the * character.
var computeChecksum = function computeChecksum(s) {
    var cs = 0;
    s = s || '';
    for (var i = 0; i < s.length; ++i) {
        var c = s[i].charCodeAt(0);
        cs = cs ^ c;
    }
    return cs;
};

var GCodeParser = (function (_Transform) {
    _inherits(GCodeParser, _Transform);

    function GCodeParser(options) {
        _classCallCheck(this, GCodeParser);

        var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(GCodeParser).call(this, _lodash2.default.extend({}, options, { objectMode: true })));

        _this.options = options || {};
        return _this;
    }

    _createClass(GCodeParser, [{
        key: '_transform',
        value: function _transform(chunk, encoding, next) {
            var _this2 = this;

            // decode binary chunks as UTF-8
            encoding = encoding || 'utf8';

            if (Buffer.isBuffer(chunk)) {
                if (encoding === 'buffer') {
                    encoding = 'utf8';
                }
                chunk = chunk.toString(encoding);
            }

            var lines = chunk.split(/\r\n|\r|\n/g);
            _lodash2.default.each(lines, function (line) {
                line = _lodash2.default.trim(stripComments(line));
                if (line.length === 0) {
                    return;
                }

                var n = undefined; // Line number
                var cs = undefined; // Checksum
                var words = [];
                var list = removeSpaces(line).match(/([a-zA-Z][0-9\+\-\.]*)|(\*[0-9]+)/igm) || [];

                _lodash2.default.each(list, function (word) {
                    var letter = word[0].toUpperCase();
                    var argument = word.substr(1);

                    argument = _lodash2.default.isNaN(parseFloat(argument)) ? argument : Number(argument);

                    //
                    // Special fields
                    //

                    {
                        // N: Line number
                        if (letter === 'N' && _lodash2.default.isUndefined(n)) {
                            // Line (block) number in program
                            n = Number(argument);
                            return;
                        }
                    }

                    {
                        // *: Checksum
                        if (letter === '*' && _lodash2.default.isUndefined(cs)) {
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

                var obj = {};
                obj.line = line;
                obj.words = words;
                typeof n !== 'undefined' && (obj.N = n); // Line number
                typeof cs !== 'undefined' && (obj.cs = cs); // Checksum
                if (obj.cs && computeChecksum(line) !== obj.cs) {
                    obj.err = true; // checksum failed
                }

                _this2.push(obj);
            });

            next();
        }
    }, {
        key: '_flush',
        value: function _flush(done) {
            done();
        }
    }]);

    return GCodeParser;
})(_stream.Transform);

var parseStream = function parseStream(stream, callback) {
    callback = callback || function (err) {};

    try {
        (function () {
            var results = [];
            stream.pipe(new GCodeParser()).on('data', function (data) {
                results.push(data);
            }).on('end', function () {
                callback(null, results);
            }).on('error', callback);
        })();
    } catch (err) {
        callback(err);
        return;
    }

    return stream;
};

var parseFile = function parseFile(file, callback) {
    file = file || '';
    var s = _fs2.default.createReadStream(file, { encoding: 'utf8' });
    s.on('error', callback);
    return parseStream(s, callback);
};

var parseText = function parseText(text, callback) {
    var s = streamify(text);
    return parseStream(s, callback);
};

exports.GCodeParser = GCodeParser;
exports.parseStream = parseStream;
exports.parseFile = parseFile;
exports.parseText = parseText;