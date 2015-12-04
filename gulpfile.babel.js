'use strict';

import gulp from 'gulp';
import babel from 'gulp-babel';
import istanbul from 'gulp-istanbul';
import mocha from 'gulp-mocha';

gulp.task('pre-test', () => {
    return gulp.src(['dist/index.js'])
        // Covering files
        .pipe(istanbul())
        // Force `require` to return covered files
        .pipe(istanbul.hookRequire());
});

gulp.task('test', ['pre-test'], () => {
    return gulp.src(['test/*.js'])
        .pipe(mocha())
        // Creating the reports after tests ran
        .pipe(istanbul.writeReports())
        // Checking coverage against minimum acceptable thresholds
        .pipe(istanbul.enforceThresholds({
            thresholds: {
                global: {
                    statements: 90,
                    branches: 60,
                    functions: 90,
                    lines: 90
                }
            }
        }));
});

gulp.task('default', () => {
    return gulp.src([
            'index.js'
        ])
        .pipe(babel({
            presets: ['es2015', 'stage-0']
        }))
        .pipe(gulp.dest('dist'));
});
