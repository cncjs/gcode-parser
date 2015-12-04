# gcode-parser [![build status](https://travis-ci.org/cheton/gcode-parser.svg?branch=master)](https://travis-ci.org/cheton/gcode-parser) [![Coverage Status](https://coveralls.io/repos/cheton/gcode-parser/badge.svg?branch=master&service=github)](https://coveralls.io/github/cheton/gcode-parser?branch=master)
[![NPM](https://nodei.co/npm/gcode-parser.png?downloads=true&stars=true)](https://nodei.co/npm/gcode-parser/)

## Usage
```js
var fs = require('fs');
var parser = require('gcode-parser');

// Parse from file
var file = 'example.nc';
parser.parseFile(file, function(err, data) {
    console.log(data);
});

// Parse from stream
var stream = fs.createReadStream(file, { encoding: 'utf8' });
parser.parseStream(stream, function(err, data) {
    console.log(data);
});

// Parse from text string
var text = fs.readFileSync(file, 'utf8');
parser.parseText(text, function(err, data) {
    console.log(data);
});
```
