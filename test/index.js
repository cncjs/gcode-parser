import chai from 'chai';
import fs from 'fs';
import { GCodeParser, parseFile, parseString, parseStream } from '../dist/';
import _ from 'lodash';

const expect = chai.expect;
const should = chai.should();

describe('G-code Parser', (done) => {
    describe('Pass a null value as the first argument', (done) => {
        it('should call parseString\'s callback.', (done) => {
            parseString(null, (err, results) => {
                expect(err).to.be.okay;
                done();
            });
        });
        it('should call parseFile\'s callback.', (done) => {
            parseFile(null, (err, results) => {
                expect(err).to.be.okay;
                done();
            });
        });
        it('should call parseStream\'s callback.', (done) => {
            parseStream(null, (err, results) => {
                expect(err).to.be.okay;
                done();
            });
        });
    });

    describe('Pass an empty text as the first argument', (done) => {
        it('should get empty results.', (done) => {
            let sampleText = '';
            parseString(sampleText, (err, results) => {
                expect(results.length).to.be.empty;
                done();
            });
        });
    });

    describe('Contains only comments', (done) => {
        it('should get empty results.', (done) => {
            let sampleText = [
                ';',
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
                expect(results.length).to.be.equal(10);
                done();
            });
        });
    });

    describe('File not found exception', (done) => {
        it('should fail the callback if a file is not present.', (done) => {
            parseFile('test/fixtures/NO_FILE_ERROR', (err, results) => {
                expect(err).to.not.be.null;
                expect(err.code).to.equal('ENOENT');
                done();
            });
        });
    });

    describe('EventEmitter', (done) => {
        it('should call event listeners.', (done) => {
            let index = 0;
            const stream = fs.createReadStream('test/fixtures/circle.gcode', { encoding: 'utf8' });

            parseStream(stream, (err, results) => {
                expect(results.length).to.be.equal(7);
                done();
            })
            .on('data', (data) => {
                expect(data).to.be.an('object');
            })
            .on('progress', ({ current, total }) => {
                expect(current).to.be.equal(index);
                expect(total).to.be.equal(7);
                ++index;
            })
            .on('end', (results) => {
                expect(results).to.be.an('array');
            });
        });
    });

    describe('parseFile / parseStream / parseString', (done) => {
        let expectedResults = [
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
                words: [['G', 2], ['X', 0], ['Y',-5], ['I', -5], ['J', 0]]
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

        it('should get the expected results in the parseFile\'s callback.', (done) => {
            parseFile('test/fixtures/circle.gcode', (err, results) => {
                expect(results).to.deep.equal(expectedResults);
                done();
            });
        });

        it('should get the expected results in the parseStream\'s callback.', (done) => {
            const stream = fs.createReadStream('test/fixtures/circle.gcode', { encoding: 'utf8' });
            parseStream(stream, (err, results) => {
                expect(results).to.deep.equal(expectedResults);
                done();
            });
        });

        it('should get the expected results in the parseString\'s callback.', (done) => {
            const str = fs.readFileSync('test/fixtures/circle.gcode', 'utf8');
            parseString(str, (err, results) => {
                expect(results).to.deep.equal(expectedResults);
                done();
            });
        });
    });

    describe('More examples', (done) => {
        it('should contain the line number.', (done) => {
            parseFile('test/fixtures/circle-inch.gcode', (err, list) => {
                expect(err).to.be.null;
                list.forEach((data) => {
                    let { N } = data;
                    expect(N).to.exist;
                });
                done();
            });
        });

        it('should get the expected results for special fields.', (done) => {
            let expectedResults = [
                {
                    N: 1,
                    line: 'N1 G20 (inches)',
                    words: [['G', 20]]
                },
                {
                    N: 2,
                    line: 'N2 G90 (absolute)',
                    words: [['G', 90]]
                },
                {
                    N: 3,
                    cs: 57,
                    line: 'N3 T0',
                    words: [['T', 0]]
                },
                {
                    N: 4,
                    cs: 67,
                    line: 'N4 G92 E0',
                    words: [['G', 92], ['E', 0]]
                },
                {
                    N: 5,
                    cs: 22,
                    line: 'N5 G28',
                    words: [['G', 28]]
                },
                {
                    N: 6,
                    cs: 82,
                    line: 'N6 G1 F1500.0',
                    words: [['G', 1], ['F', 1500]]
                },
                {
                    N: 7,
                    cs: 85,
                    line: 'N7 G1 X2.0 Y2.0 F3000.0',
                    words: [['G', 1], ['X', 2], ['Y', 2], ['F', 3000]]
                },
                {
                    err: true, // checksum failed
                    N: 8,
                    cs: 30, // invalid checksum
                    line: 'N8 G1 X3.0 Y3.0',
                    words: [['G', 1], ['X', 3], ['Y', 3]]
                }
            ];
            parseFile('test/fixtures/special-fields.gcode', (err, results) => {
                expect(results).to.deep.equal(expectedResults);
                done();
            });
        });

        it('should allow spaces between commands.', (done) => {
            let expectedResults = [
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

            parseFile('test/fixtures/spaces.gcode', (err, results) => {
                expect(results).to.deep.equal(expectedResults);
                done();
            })
        });
    });
});
