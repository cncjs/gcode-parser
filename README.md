# gcode-parser [![codecov](https://codecov.io/gh/cncjs/gcode-parser/graph/badge.svg?token=T1D2XQJRXC)](https://codecov.io/gh/cncjs/gcode-parser)

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
Default: 1000

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

### lineMode

Type: `String`  
Default: `'original'`

The `lineMode` option specifies how the parsed line should be formatted. The following values are supported:
- `'original'`: Keeps the line unchanged, including comments and whitespace. (Default)
- `'minimal'`: Removes comments, trims leading and trailing whitespace, but preserves inner whitespace.
- `'compact'`: Removes both comments and all whitespace.

Example usage:

```js
parser.parseLine('G0 X0 Y0 ; comment', { lineMode: 'original' });
// => { line: 'G0 X0 Y0 ; comment', words: [ [ 'G', 0 ], [ 'X', 0 ], [ 'Y', 0 ] ] }

parser.parseLine('G0 X0 Y0 ; comment', { lineMode: 'minimal' });
// => { line: 'G0 X0 Y0', words: [ [ 'G', 0 ], [ 'X', 0 ], [ 'Y', 0 ] ] }

parser.parseLine('G0 X0 Y0 ; comment', { lineMode: 'compact' });
// => { line: 'G0X0Y0', words: [ [ 'G', 0 ], [ 'X', 0 ], [ 'Y', 0 ] ] }
```

## G-code Interpreter
https://github.com/cncjs/gcode-interpreter

## G-code Toolpath
https://github.com/cncjs/gcode-toolpath

## G-code Toolpath Visualizer
Check out the source code at https://github.com/cncjs/cncjs/blob/master/src/web/widgets/Visualizer/GCodeVisualizer.js

## License

MIT
