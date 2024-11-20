import fs from 'fs';
import path from 'path';
import {
  parseLine,
  parseStream,
  parseString,
  parseStringSync,
  parseFile,
  parseFileSync
} from '..';

describe('Pass a null value as the first argument', () => {
  it('should call parseString\'s callback.', (done) => {
    parseString(null, (err, results) => {
      expect(err).toBeNull();
      expect(results.length).toBe(0);
      done();
    });
  });
  it('should call parseFile\'s callback.', (done) => {
    parseFile(null, (err, results) => {
      expect(!!err).toBeTruthy();
      expect(results).toBeUndefined();
      done();
    });
  });
  it('should call parseStream\'s callback.', (done) => {
    parseStream(null, (err, results) => {
      expect(!!err).toBeTruthy();
      expect(results).toBeUndefined();
      done();
    });
  });
});

describe('Pass an empty text as the first argument', () => {
  it('should get empty results.', (done) => {
    const inputText = '';
    parseString(inputText, (err, results) => {
      expect(err).toBeNull();
      expect(results.length).toBe(0);
      done();
    });
  });
});

describe('Invalid G-code words', () => {
  it('should ignore invalid g-code words', () => {
    const data = parseLine('messed up');
    expect(typeof data).toBe('object');
    expect(data.line).toBe('messed up');
    expect(data.words).toHaveLength(0);
  });
});

describe('The `lineMode` option', () => {
  it('should retain the line exactly as is, including comments and whitespace for `lineMode="original"`', () => {
    const line = 'M6 (tool change;) T1 ; comment';
    const result = parseLine(line, { lineMode: 'original' });
    expect(result.line).toBe('M6 (tool change;) T1 ; comment');
    expect(result.words).toEqual([['M', 6], ['T', 1]]);
  });

  it('should remove comments, trims leading and trailing whitespace (spaces and tabs), but keeps the inner whitespace between code elements for `lineMode="stripped"`', () => {
    const line = 'M6 (tool change;) T1 ; comment';
    const result = parseLine(line, { lineMode: 'stripped' });
    expect(result.line).toBe('M6  T1');
    expect(result.words).toEqual([['M', 6], ['T', 1]]);
  });

  it('should remove both comments and all whitespace characters for `lineMode="compact"`', () => {
    const line = 'M6 (tool change;) T1 ; comment';
    const result = parseLine(line, { lineMode: 'compact' });
    expect(result.line).toBe('M6T1');
    expect(result.words).toEqual([['M', 6], ['T', 1]]);
  });
});

describe('Commands', () => {
  it('should be able to parse $ command (e.g. Grbl).', () => {
    const data = parseLine('$H $C');
    expect(typeof data).toBe('object');
    expect(typeof data.line).toBe('string');
    expect(data.words).toHaveLength(0);
    expect(data.cmds).toEqual(['$H', '$C']);
  });

  it('should be able to parse JSON command (e.g. TinyG, g2core).', () => {
    { // {sr:{spe:t,spd,sps:t}}
      const data = parseLine('{sr:{spe:t,spd:t,sps:t}}');
      expect(typeof data).toBe('object');
      expect(typeof data.line).toBe('string');
      expect(data.words).toHaveLength(0);
      expect(data.cmds).toEqual(['{sr:{spe:t,spd:t,sps:t}}']);
    }
    { // Request Motor Timeout: {mt:n}
      const data = parseLine('{mt:n}');
      expect(typeof data).toBe('object');
      expect(typeof data.line).toBe('string');
      expect(data.words).toHaveLength(0);
      expect(data.cmds).toEqual(['{mt:n}']);
    }
  });

  it('should be able to parse % command (e.g. bCNC, CNCjs).', () => {
    { // %wait
      const data = parseLine('%wait');
      expect(typeof data).toBe('object');
      expect(typeof data.line).toBe('string');
      expect(data.words).toHaveLength(0);
      expect(data.cmds).toEqual(['%wait']);
    }

    { // %wait ; Wait for the planner queue to empty
      const data = parseLine('%wait ; Wait for the planner queue to empty');
      expect(typeof data).toBe('object');
      expect(typeof data.line).toBe('string');
      expect(data.words).toHaveLength(0);
      expect(data.cmds).toEqual(['%wait ; Wait for the planner queue to empty']);
    }

    { // %msg Restart spindle
      const data = parseLine('%msg Restart spindle');
      expect(typeof data).toBe('object');
      expect(typeof data.line).toBe('string');
      expect(data.words).toHaveLength(0);
      expect(data.cmds).toEqual(['%msg Restart spindle']);
    }

    { // %zsafe=10
      const data = parseLine('%zsafe=10');
      expect(typeof data).toBe('object');
      expect(typeof data.line).toBe('string');
      expect(data.words).toHaveLength(0);
      expect(data.cmds).toEqual(['%zsafe=10']);
    }

    { // %x0=posx,y0=posy,z0=posz
      const data = parseLine('%x0=posx,y0=posy,z0=posz');
      expect(typeof data).toBe('object');
      expect(typeof data.line).toBe('string');
      expect(data.words).toHaveLength(0);
      expect(data.cmds).toEqual(['%x0=posx,y0=posy,z0=posz']);
    }
  });
});

describe('Stripping comments', () => {
  it('should correctly parse a semicolon comment before parentheses', () => {
    const line = 'M6 ; comment (tool change) T1';
    const data = parseLine(line, { lineMode: 'stripped' });
    expect(data.line).toBe('M6');
    expect(data.comments).toEqual([
      'comment (tool change) T1',
    ]);
  });

  it('should correctly parse nested parentheses containing a semicolon', () => {
    const line = 'M6 (outer (inner;)) T1 ; comment';
    const data = parseLine(line, { lineMode: 'stripped' });
    expect(data.line).toBe('M6  T1');
    expect(data.comments).toEqual([
      'outer (inner;)',
      'comment',
    ]);
  });

  it('should correctly parse multiple comments in a line', () => {
    const line = 'M6 (first comment) T1 ; second comment';
    const data = parseLine(line, { lineMode: 'stripped' });
    expect(data.line).toBe('M6  T1');
    expect(data.comments).toEqual([
      'first comment',
      'second comment',
    ]);
  });

  it('should strip everything after a semi-colon to the end of the loine including preceding spaces.', (done) => {
    const inputText = [
      '  %  ',
      '  #',
      '; Operation:    0',
      '; Name:',
      '; Type:         Pocket',
      '; Paths:        3',
      '; Direction:    Conventional',
      '; Cut Depth:    3.175',
      '; Pass Depth:   1.9999999999999998',
      '; Plunge rate:  127',
      '; Cut rate:     1016',
      '  ' // empty line
    ].join('\n');

    parseString(inputText, { lineMode: 'stripped' }, (err, results) => {
      expect(results).toEqual([
        { line: '%', words: [], cmds: [ '%' ] },
        { line: '#', words: [] },
        { line: '', words: [], comments: [ 'Operation:    0' ] },
        { line: '', words: [], comments: [ 'Name:' ] },
        { line: '', words: [], comments: [ 'Type:         Pocket' ] },
        { line: '', words: [], comments: [ 'Paths:        3' ] },
        { line: '', words: [], comments: [ 'Direction:    Conventional' ] },
        { line: '', words: [], comments: [ 'Cut Depth:    3.175' ] },
        { line: '', words: [], comments: [ 'Pass Depth:   1.9999999999999998' ] },
        { line: '', words: [], comments: [ 'Plunge rate:  127' ] },
        { line: '', words: [], comments: [ 'Cut rate:     1016' ] }
      ]);
      done();
    });
  });

  it('should remove anything inside parentheses.', (done) => {
    const inputText = [
      '(Generated with: DXF2GCODE, Version: Py3.4.4 PyQt5.4.1, Date: $Date: Sun Apr 17 16:32:22 2016 +0200 $)',
      '(Created from file: G:/Dropbox/Konstruktionen/20161022 - MicroCopter 180/complete.dxf)',
      '(Time: Sun Oct 23 12:30:46 2016)',
      'G21 (Units in millimeters)  G90 (Absolute programming)',
      '$H',
      'F1000',
      '(*** LAYER: 0 ***)',
      'T5 M06',
      'S200',
      '(* SHAPE Nr: 0 *)',
      'G0 X 180.327 Y 137.080',
      'M03'
    ].join('\n');
    const expectedResults = [
      {
        line: '',
        comments: ['Generated with: DXF2GCODE, Version: Py3.4.4 PyQt5.4.1, Date: $Date: Sun Apr 17 16:32:22 2016 +0200 $'],
      },
      {
        line: '',
        comments: ['Created from file: G:/Dropbox/Konstruktionen/20161022 - MicroCopter 180/complete.dxf'],
      },
      {
        line: '',
        comments: ['Time: Sun Oct 23 12:30:46 2016'],
      },
      {
        line: 'G21G90',
        comments: ['Units in millimeters', 'Absolute programming'],
      },
      {
        line: '$H',
        comments: undefined,
      },
      {
        line: 'F1000',
        comments: undefined,
      },
      {
        line: '',
        comments: ['*** LAYER: 0 ***'],
      },
      {
        line: 'T5M06',
        comments: undefined,
      },
      {
        line: 'S200',
        comments: undefined,
      },
      {
        line: '',
        comments: ['* SHAPE Nr: 0 *'],
      },
      {
        line: 'G0X180.327Y137.080',
        comments: undefined,
      },
      {
        line: 'M03',
        comments: undefined,
      },
    ];

    parseString(inputText, { lineMode: 'compact' }, (err, results) => {
      results = results.map(result => ({
        line: result.line,
        comments: result.comments,
      }));
      expect(results).toEqual(expectedResults);
      done();
    });
  });
});

describe('File not found exception', () => {
  it('should fail the callback if a file is not present.', (done) => {
    const filepath = path.resolve(__dirname, 'fixtures/NO_FILE_ERROR');
    parseFile(filepath, (err, results) => {
      expect(err).not.toBeNull();
      expect(err.code).toBe('ENOENT');
      expect(results).toBeUndefined();
      done();
    });
  });
});

describe('Event listeners', () => {
  it('should call event listeners when loading G-code from file.', (done) => {
    const filepath = path.resolve(__dirname, 'fixtures/circle.gcode');
    parseFile(filepath, (err, results) => {
      expect(results).toHaveLength(7);
      done();
    })
      .on('data', (data) => {
        expect(typeof data).toBe('object');
      })
      .on('end', (results) => {
        expect(results).toHaveLength(7);
      });
  });
  it('should call event listeners when loading G-code from stream.', (done) => {
    const filepath = path.resolve(__dirname, 'fixtures/circle.gcode');
    const stream = fs.createReadStream(filepath, { encoding: 'utf8' });
    parseStream(stream, (err, results) => {
      expect(results).toHaveLength(7);
      done();
    })
      .on('data', (data) => {
        expect(typeof data).toBe('object');
      })
      .on('end', (results) => {
        expect(results).toHaveLength(7);
      });
  });
  it('should call event listeners when loading G-code from string.', (done) => {
    const filepath = path.resolve(__dirname, 'fixtures/circle.gcode');
    const string = fs.readFileSync(filepath, 'utf8');
    parseString(string, (err, results) => {
      expect(results).toHaveLength(7);
      done();
    })
      .on('data', (data) => {
        expect(typeof data).toBe('object');
      })
      .on('end', (results) => {
        expect(results).toHaveLength(7);
      });
  });
});

describe('parseLine()', () => {
  it('should return expected results.', () => {
    expect(parseLine('G0 X0 Y0')).toEqual({
      line: 'G0 X0 Y0',
      words: [['G', 0], ['X', 0], ['Y', 0]]
    });
    expect(parseLine('G0 X0 Y0', { flatten: true })).toEqual({
      line: 'G0 X0 Y0',
      words: ['G0', 'X0', 'Y0']
    });
  });
});

describe('parseStream()', () => {
  const expectedResults = [
    {
      line: 'G0 X-5 Y0 Z0 F200',
      words: [['G', 0], ['X', -5], ['Y', 0], ['Z', 0], ['F', 200]]
    },
    {
      line: 'G2 X0 Y5 I5 J0 F200',
      words: [['G', 2], ['X', 0], ['Y', 5], ['I', 5], ['J', 0], ['F', 200]]
    },
    {
      line: 'G02 X5 Y0 I0 J-5',
      words: [['G', 2], ['X', 5], ['Y', 0], ['I', 0], ['J', -5]]
    },
    {
      line: 'G02 X0 Y-5 I-5 J0',
      words: [['G', 2], ['X', 0], ['Y', -5], ['I', -5], ['J', 0]]
    },
    {
      line: 'G02 X-5 Y0 I0 J5',
      words: [['G', 2], ['X', -5], ['Y', 0], ['I', 0], ['J', 5]]
    },
    {
      line: 'G01 Z1 F500',
      words: [['G', 1], ['Z', 1], ['F', 500]]
    },
    {
      line: 'G00 X0 Y0 Z5',
      words: [['G', 0], ['X', 0], ['Y', 0], ['Z', 5]]
    }
  ];

  it('should get expected results in the callback.', (done) => {
    const filepath = path.resolve(__dirname, 'fixtures/circle.gcode');
    const stream = fs.createReadStream(filepath, { encoding: 'utf8' });
    parseStream(stream, (err, results) => {
      expect(results).toEqual(expectedResults);
      done();
    });
  });
});

describe('parseString()', () => {
  const expectedResults = [
    {
      line: 'G0 X-5 Y0 Z0 F200',
      words: [['G', 0], ['X', -5], ['Y', 0], ['Z', 0], ['F', 200]]
    },
    {
      line: 'G2 X0 Y5 I5 J0 F200',
      words: [['G', 2], ['X', 0], ['Y', 5], ['I', 5], ['J', 0], ['F', 200]]
    },
    {
      line: 'G02 X5 Y0 I0 J-5',
      words: [['G', 2], ['X', 5], ['Y', 0], ['I', 0], ['J', -5]]
    },
    {
      line: 'G02 X0 Y-5 I-5 J0',
      words: [['G', 2], ['X', 0], ['Y', -5], ['I', -5], ['J', 0]]
    },
    {
      line: 'G02 X-5 Y0 I0 J5',
      words: [['G', 2], ['X', -5], ['Y', 0], ['I', 0], ['J', 5]]
    },
    {
      line: 'G01 Z1 F500',
      words: [['G', 1], ['Z', 1], ['F', 500]]
    },
    {
      line: 'G00 X0 Y0 Z5',
      words: [['G', 0], ['X', 0], ['Y', 0], ['Z', 5]]
    }
  ];

  it('should get expected results in the callback.', (done) => {
    const filepath = path.resolve(__dirname, 'fixtures/circle.gcode');
    const str = fs.readFileSync(filepath, 'utf8');
    parseString(str, (err, results) => {
      expect(results).toEqual(expectedResults);
      done();
    });
  });
});

describe('parseStringSync()', () => {
  const expectedResults = [
    {
      line: 'G0 X-5 Y0 Z0 F200',
      words: [['G', 0], ['X', -5], ['Y', 0], ['Z', 0], ['F', 200]]
    },
    {
      line: 'G2 X0 Y5 I5 J0 F200',
      words: [['G', 2], ['X', 0], ['Y', 5], ['I', 5], ['J', 0], ['F', 200]]
    },
    {
      line: 'G02 X5 Y0 I0 J-5',
      words: [['G', 2], ['X', 5], ['Y', 0], ['I', 0], ['J', -5]]
    },
    {
      line: 'G02 X0 Y-5 I-5 J0',
      words: [['G', 2], ['X', 0], ['Y', -5], ['I', -5], ['J', 0]]
    },
    {
      line: 'G02 X-5 Y0 I0 J5',
      words: [['G', 2], ['X', -5], ['Y', 0], ['I', 0], ['J', 5]]
    },
    {
      line: 'G01 Z1 F500',
      words: [['G', 1], ['Z', 1], ['F', 500]]
    },
    {
      line: 'G00 X0 Y0 Z5',
      words: [['G', 0], ['X', 0], ['Y', 0], ['Z', 5]]
    }
  ];

  it('should return expected results.', () => {
    const filepath = path.resolve(__dirname, 'fixtures/circle.gcode');
    const str = fs.readFileSync(filepath, 'utf8');
    const results = parseStringSync(str);
    expect(results).toEqual(expectedResults);
  });
});

describe('parseFile()', () => {
  const expectedResults = [
    {
      line: 'G0 X-5 Y0 Z0 F200',
      words: [['G', 0], ['X', -5], ['Y', 0], ['Z', 0], ['F', 200]]
    },
    {
      line: 'G2 X0 Y5 I5 J0 F200',
      words: [['G', 2], ['X', 0], ['Y', 5], ['I', 5], ['J', 0], ['F', 200]]
    },
    {
      line: 'G02 X5 Y0 I0 J-5',
      words: [['G', 2], ['X', 5], ['Y', 0], ['I', 0], ['J', -5]]
    },
    {
      line: 'G02 X0 Y-5 I-5 J0',
      words: [['G', 2], ['X', 0], ['Y', -5], ['I', -5], ['J', 0]]
    },
    {
      line: 'G02 X-5 Y0 I0 J5',
      words: [['G', 2], ['X', -5], ['Y', 0], ['I', 0], ['J', 5]]
    },
    {
      line: 'G01 Z1 F500',
      words: [['G', 1], ['Z', 1], ['F', 500]]
    },
    {
      line: 'G00 X0 Y0 Z5',
      words: [['G', 0], ['X', 0], ['Y', 0], ['Z', 5]]
    }
  ];

  it('should get expected results in the callback.', (done) => {
    const filepath = path.resolve(__dirname, 'fixtures/circle.gcode',);
    parseFile(filepath, (err, results) => {
      expect(results).toEqual(expectedResults);
      done();
    });
  });
});

describe('parseFileSync()', () => {
  const expectedResults = [
    {
      line: 'G0 X-5 Y0 Z0 F200',
      words: [['G', 0], ['X', -5], ['Y', 0], ['Z', 0], ['F', 200]]
    },
    {
      line: 'G2 X0 Y5 I5 J0 F200',
      words: [['G', 2], ['X', 0], ['Y', 5], ['I', 5], ['J', 0], ['F', 200]]
    },
    {
      line: 'G02 X5 Y0 I0 J-5',
      words: [['G', 2], ['X', 5], ['Y', 0], ['I', 0], ['J', -5]]
    },
    {
      line: 'G02 X0 Y-5 I-5 J0',
      words: [['G', 2], ['X', 0], ['Y', -5], ['I', -5], ['J', 0]]
    },
    {
      line: 'G02 X-5 Y0 I0 J5',
      words: [['G', 2], ['X', -5], ['Y', 0], ['I', 0], ['J', 5]]
    },
    {
      line: 'G01 Z1 F500',
      words: [['G', 1], ['Z', 1], ['F', 500]]
    },
    {
      line: 'G00 X0 Y0 Z5',
      words: [['G', 0], ['X', 0], ['Y', 0], ['Z', 5]]
    }
  ];

  it('should return expected results.', (done) => {
    const filepath = path.resolve(__dirname, 'fixtures/circle.gcode',);
    const results = parseFileSync(filepath);
    expect(results).toEqual(expectedResults);
    done();
  });
});

describe('More examples', () => {
  it('should contain the line number.', (done) => {
    const filepath = path.resolve(__dirname, 'fixtures/circle-inch.gcode');
    parseFile(filepath, (err, list) => {
      expect(err).toBeNull();
      list.forEach((data) => {
        const { ln } = data;
        expect(ln).not.toBe(undefined);
      });
      done();
    });
  });

  it('should get the expected results for special fields.', (done) => {
    const expectedResults = [
      {
        ln: 1,
        line: 'N1 G20 (inches)',
        comments: ['inches'],
        words: [['G', 20]]
      },
      {
        ln: 2,
        line: 'N2 G90 (absolute)',
        comments: ['absolute'],
        words: [['G', 90]]
      },
      {
        ln: 3,
        cs: 57,
        line: 'N3 T0*57',
        words: [['T', 0]]
      },
      {
        ln: 4,
        cs: 67,
        line: 'N4 G92 E0*67',
        words: [['G', 92], ['E', 0]]
      },
      {
        ln: 5,
        cs: 22,
        line: 'N5 G28*22',
        words: [['G', 28]]
      },
      {
        ln: 6,
        cs: 82,
        line: 'N6 G1 F1500.0*82',
        words: [['G', 1], ['F', 1500]]
      },
      {
        ln: 7,
        cs: 85,
        line: 'N7 G1 X2.0 Y2.0 F3000.0*85',
        words: [['G', 1], ['X', 2], ['Y', 2], ['F', 3000]]
      },
      {
        err: true, // checksum failed
        ln: 8,
        cs: 30, // invalid checksum
        line: 'N8 G1 X3.0 Y3.0*30 ; checksum failed',
        comments: ['checksum failed'],
        words: [['G', 1], ['X', 3], ['Y', 3]]
      }
    ];
    const filepath = path.resolve(__dirname, 'fixtures/special-fields.gcode');
    parseFile(filepath, (err, results) => {
      expect(results).toEqual(expectedResults);
      done();
    });
  });

  it('should allow spaces between commands.', (done) => {
    const expectedResults = [
      {
        line: 'G0X-5Y0Z0F200',
        words: [['G', 0], ['X', -5], ['Y', 0], ['Z', 0], ['F', 200]]
      },
      {
        line: 'G0 X-5 Y0 Z0 F200',
        words: [['G', 0], ['X', -5], ['Y', 0], ['Z', 0], ['F', 200]]
      },
      {
        line: 'G0 X -5 Y 0 Z 0 F 200',
        words: [['G', 0], ['X', -5], ['Y', 0], ['Z', 0], ['F', 200]]
      }
    ];
    const filepath = path.resolve(__dirname, 'fixtures/spaces.gcode');
    parseFile(filepath, (err, results) => {
      expect(results).toEqual(expectedResults);
      done();
    });
  });
});
