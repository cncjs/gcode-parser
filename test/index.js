import chai from 'chai';
import fs from 'fs';
import { GCodeParser, parseFile, parseText, parseStream } from '../dist/';
import _ from 'lodash';

const expect = chai.expect;
const should = chai.should();

describe('G-code Parser', (done) => {
	describe('Pass a null value as the first argument', (done) => {
		it('should call parseText\'s callback.', (done) => {
            parseText(null, (err, results) => {
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
            parseText(sampleText, (err, results) => {
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
            parseText(sampleText, (err, results) => {
                expect(results.length).to.be.empty;
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

	describe('parseStream / parseText / parseFile', (done) => {
        let expectedResults = [
            {
                line: 'G0 X-5 Y0 Z0 F200',
                N: undefined,
                words: [['G', 0], ['X', -5], ['Y', 0], ['Z', 0], ['F', 200]]
            },
            {
                line: 'G2 X0 Y5 I5 J0 F200',
                N: undefined,
                words: [['G', 2], ['X', 0], ['Y', 5], ['I', 5], ['J', 0], ['F', 200]]
            },
            {
                line: 'G02 X5 Y0 I0 J-5',
                N: undefined,
                words: [['G', 2], ['X', 5], ['Y', 0], ['I', 0], ['J', -5]]
            },
            {
                line: 'G02 X0 Y-5 I-5 J0',
                N: undefined,
                words: [['G', 2], ['X', 0], ['Y',-5], ['I', -5], ['J', 0]]
            },
            {
                line: 'G02 X-5 Y0 I0 J5',
                N: undefined,
                words: [['G', 2], ['X', -5], ['Y', 0], ['I', 0], ['J', 5]]
            },
            {
                line: 'G01 Z1 F500',
                N: undefined,
                words: [['G', 1], ['Z', 1], ['F', 500]]
            },
            {
                line: 'G00 X0 Y0 Z5',
                N: undefined,
                words: [['G', 0], ['X', 0], ['Y', 0], ['Z', 5]]
            }
        ];

        it('should get the expected results in the parseFile\'s callback.', (done) => {
            parseFile('test/fixtures/circle.nc', (err, results) => {
                expect(results).to.deep.equal(expectedResults);
                done();
            });
		});

        it('should get the expected results in the parseText\'s callback.', (done) => {
            let text = fs.readFileSync('test/fixtures/circle.nc', 'utf8');
            parseText(text, (err, results) => {
                expect(results).to.deep.equal(expectedResults);
                done();
            });
		});

        it('should get the expected results in the parseStream\'s callback.', (done) => {
            let stream = fs.createReadStream('test/fixtures/circle.nc', { encoding: 'utf8' });
            parseStream(stream, (err, results) => {
                expect(results).to.deep.equal(expectedResults);
                done();
            });
		});
	});

	describe('More G-code Examples', (done) => {
		it('should contain the line number.', (done) => {
            parseFile('test/fixtures/circle-inch.nc', (err, list) => {
                expect(err).to.be.null;
                list.forEach((data) => {
                    let { N } = data;
                    expect(N).to.exist;
                });
                done();
            });
        });
	});
});
