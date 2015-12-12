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

                var n = undefined;
                var words = [];
                var list = removeSpaces(line).match(/([a-zA-Z][^a-zA-Z]*)/igm) || [];
                _lodash2.default.each(list, function (word) {
                    var r = word.match(/([a-zA-Z])([^a-zA-Z]*)/) || [];
                    var letter = (r[1] || '').toUpperCase();
                    var argument = _lodash2.default.isNaN(parseFloat(r[2])) ? r[2] : Number(r[2]);

                    if (letter === 'N' && typeof n === 'undefined') {
                        // Line (block) number in program
                        n = Number(argument);
                        return;
                    }

                    words.push([letter, argument]);
                });

                _this2.push({
                    line: line,
                    N: n,
                    words: words
                });
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