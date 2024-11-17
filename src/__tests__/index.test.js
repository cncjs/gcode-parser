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
    const sampleText = '';
    parseString(sampleText, (err, results) => {
      expect(results.length).toBe(0);
      done();
    });
  });
});

describe('Contains only lines', () => {
  it('should not parse G-code commands.', (done) => {
    const filepath = path.resolve(__dirname, 'fixtures/circle.gcode');
    parseFile(filepath, { noParseLine: true }, (err, results) => {
      expect(results.length).toBe(7);
      done();
    })
      .on('data', (data) => {
        expect(typeof data).toBe('object');
        expect(typeof data.line).toBe('string');
        expect(data.words).toBe(undefined);
      })
      .on('end', (results) => {
        expect(results.length).toBe(7);
      });
  });
});

describe('Invalid G-code words', () => {
  it('should ignore invalid g-code words', (done) => {
    const data = parseLine('messed up');
    expect(typeof data).toBe('object');
    expect(data.line).toBe('messed up');
    expect(data.words).toHaveLength(0);
    done();
  });
});

describe('Commands', () => {
  it('should be able to parse $ command (e.g. Grbl).', (done) => {
    const data = parseLine('$H $C');
    expect(typeof data).toBe('object');
    expect(typeof data.line).toBe('string');
    expect(data.words).toHaveLength(0);
    expect(data.cmds).toEqual(['$H', '$C']);
    done();
  });
  it('should be able to parse JSON command (e.g. TinyG, g2core).', (done) => {
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

    done();
  });
  it('should be able to parse % command (e.g. bCNC, CNCjs).', (done) => {
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

    done();
  });
});

describe('Comments', () => {
  it('should strip everything after a semi-colon to the end of the loine including preceding spaces.', (done) => {
    const sampleText = [
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

    parseString(sampleText, (err, results) => {
      results = results.filter(result => result.length > 0);
      expect(results.length).toBe(0);
      done();
    });
  });
});

describe('Parentheses', () => {
  it('should remove anything inside parentheses.', (done) => {
    const sampleText = [
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
        gcode: '',
        cmds: undefined,
        comments: ['Generated with: DXF2GCODE, Version: Py3.4.4 PyQt5.4.1, Date: $Date: Sun Apr 17 16:32:22 2016 +0200 $'],
      },
      {
        gcode: '',
        cmds: undefined,
        comments: ['Created from file: G:/Dropbox/Konstruktionen/20161022 - MicroCopter 180/complete.dxf'],
      },
      {
        gcode: '',
        cmds: undefined,
        comments: ['Time: Sun Oct 23 12:30:46 2016'],
      },
      {
        gcode: 'G21G90',
        cmds: undefined,
        comments: ['Units in millimeters', 'Absolute programming'],
      },
      {
        gcode: '',
        cmds: ['$H'],
        comments: undefined,
      },
      {
        gcode: 'F1000',
        cmds: undefined,
        comments: undefined,
      },
      {
        gcode: '',
        cmds: undefined,
        comments: ['*** LAYER: 0 ***'],
      },
      {
        gcode: 'T5M6',
        cmds: undefined,
        comments: undefined,
      },
      {
        gcode: 'S200',
        cmds: undefined,
        comments: undefined,
      },
      {
        gcode: '',
        cmds: undefined,
        comments: ['* SHAPE Nr: 0 *'],
      },
      {
        gcode: 'G0X180.327Y137.08',
        cmds: undefined,
        comments: undefined,
      },
      {
        gcode: 'M3',
        cmds: undefined,
        comments: undefined,
      },
    ];

    parseString(sampleText, (err, results) => {
      results = results.map(result => {
        const gcode = result.words.map(word => {
          return word.join('');
        }).join('');
        const cmds = result.cmds;
        const comments = result.comments;
        return {
          gcode,
          cmds,
          comments,
        };
      });
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
  it('should return expected results.', (done) => {
    expect(parseLine('G0 X0 Y0')).toEqual({
      line: 'G0 X0 Y0',
      words: [['G', 0], ['X', 0], ['Y', 0]]
    });
    expect(parseLine('G0 X0 Y0', { flatten: true })).toEqual({
      line: 'G0 X0 Y0',
      words: ['G0', 'X0', 'Y0']
    });
    done();
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

  it('should return expected results.', (done) => {
    const filepath = path.resolve(__dirname, 'fixtures/circle.gcode');
    const str = fs.readFileSync(filepath, 'utf8');
    const results = parseStringSync(str);
    expect(results).toEqual(expectedResults);
    done();
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
