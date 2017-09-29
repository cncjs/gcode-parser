# gcode-parser [![build status](https://travis-ci.org/cncjs/gcode-parser.svg?branch=master)](https://travis-ci.org/cncjs/gcode-parser) [![Coverage Status](https://coveralls.io/repos/cncjs/gcode-parser/badge.svg?branch=master&service=github)](https://coveralls.io/github/cncjs/gcode-parser?branch=master)

[![NPM](https://nodei.co/npm/gcode-parser.png?downloads=true&stars=true)](https://www.npmjs.com/package/gcode-parser)

## Install

`npm install --save gcode-parser`

## Usage
```js
var fs = require('fs');
var parser = require('gcode-parser');

// parseLine
parser.parseLine('G0 X0 Y0');
// => { line: 'G0 X0 Y0', words: [ [ 'G', 0 ], [ 'X', 0 ], [ 'Y', 0 ] ] }

// parseLine (flatten mode)
parser.parseLine('G0 X0 Y0', { flatten: true });
// => { line: 'G0 X0 Y0', words: [ 'G0', 'X0', 'Y0' ] }

// parseFile
var file = 'example.nc';
parser.parseFile(file, function(err, results) {
    console.log(results);
});

// Synchronous version of parseFile.
results = parser.parseFileSync(file);

// parseStream
var stream = fs.createReadStream(file, { encoding: 'utf8' });
parser.parseStream(stream, function(err, results) {
    console.log(results);
});

// parseString
var str = fs.readFileSync(file, 'utf8');
parser.parseString(str, function(err, results) {
    console.log(results);
});

// Synchronous version of parseString.
results = parser.parseStringSync(file);
```

## Advanced Usage
```js
var _ = require('lodash');
var parser = require('gcode-parser');

parser.parseFile('example.nc', function(err, results) {
    if (err) {
        console.error(err);
        return;
    }

    // Compose G-code
    var list = _(results)
        .map('words')
        .map(function(words) {
            return _.map(words, function(word) {
                return word[0] + word[1];
            }).join(' ');
        })
        .value();

    console.log(list);
})
.on('data', function(data) {
    console.log(data);
})
.on('end', function(results) {
    console.log(results);
})
```

## Options

### batchSize

Type: `Number`
Default: `1000`

The batch size.

### flatten

Type: `Boolean`
Default: `false`

True to flatten the array, false otherwise.

```js
parser.parseLine('G0 X0 Y0');
// => { line: 'G0 X0 Y0', words: [ [ 'G', 0 ], [ 'X', 0 ], [ 'Y', 0 ] ] }

parser.parseLine('G0 X0 Y0', { flatten: true });
// => { line: 'G0 X0 Y0', words: [ 'G0', 'X0', 'Y0' ] }
```

### noParseLine

Type: `Boolean`
Default: `false`

True to not parse line, false otherwise.

```js
parser.parseFile('/path/to/file', { noParseLine: true }, function(err, results) {
});
```

## G-code Interpreter
https://github.com/cncjs/gcode-interpreter

## G-code Toolpath
https://github.com/cncjs/gcode-toolpath

## G-code Toolpath Visualizer
Check out the source code at https://github.com/cncjs/cncjs/blob/master/src/web/widgets/Visualizer/GCodeVisualizer.js

## License

MIT
