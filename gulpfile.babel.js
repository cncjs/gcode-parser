'use strict';

import gulp from 'gulp';
import babel from 'gulp-babel';

gulp.task('default', () => {
    return gulp.src([
            'index.js'
        ])
        .pipe(babel({
            presets: ['es2015', 'stage-0']
        }))
        .pipe(gulp.dest('dist'));
});
