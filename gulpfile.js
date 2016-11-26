"use strict";

var fs = require('fs');
var gulp = require('gulp');
var sass = require('gulp-sass');
var sourcemaps = require('gulp-sourcemaps');
var gutil = require('gulp-util');
var rename = require('gulp-rename');
var del = require('del');
var zip = require('gulp-zip');

const zipFilename = 'Darkness-CWS-latest.zip';
const chromeDevelopmentDir = 'chrome-extension';
const chromeProductionDir = 'chrome-production';
const chromeZipsDir = 'chrome-zips';
var manifestJson = JSON.parse(fs.readFileSync(chromeDevelopmentDir + '/manifest.json'));

//----------------------------------------------------------------------------------------------------------------------------------------------------
// Helper methods
//----------------------------------------------------------------------------------------------------------------------------------------------------
function fileExists(filePath) {
	try {
		return fs.statSync(filePath).isFile();
	} catch (err) {
		return false;
	}
}

//----------------------------------------------------------------------------------------------------------------------------------------------------
// Preapre a ZIP that is uploaded to Chrome Web Store:
// https://chrome.google.com/webstore/detail/darkness-beautiful-dark-t/imilbobhamcfahccagbncamhpnbkaenm
//----------------------------------------------------------------------------------------------------------------------------------------------------

// Replicate dev to production
gulp.task('cws:replicate', function() {
	gutil.log("Replicate started");
	// Delete any existing production dir
	var deletedFiles = del.sync([chromeProductionDir, chromeZipsDir + '/' + zipFilename], { force: true, dryRun: false });
	for (var i in deletedFiles) gutil.log("Deleted: ", deletedFiles[i]);
	// Copy dev dir recursively to production dir
	return gulp.src([chromeDevelopmentDir + '/**/*']).pipe(gulp.dest(chromeProductionDir));
});

// Clean up unnecessary files
gulp.task('cws:cleanup', ['cws:replicate'], function() {
	gutil.log("Cleanup started");
	var deletedFiles = del.sync(
		[chromeProductionDir + '/themes',
			chromeProductionDir + '/style'
		], { force: true, dryRun: false });
	for (var i in deletedFiles) gutil.log("Deleted directory: ", deletedFiles[i]);

	deletedFiles = del.sync(
		[chromeProductionDir + '/**/*.scss',
			chromeProductionDir + '/**/*.map'
		], { force: true, dryRun: false });
	for (var i in deletedFiles) gutil.log("Deleted file: ", deletedFiles[i]);
});

// Zip the production directory
gulp.task('cws:zip', ['cws:cleanup'], function() {
	gutil.log("Zipping...");
	// Create a zip file
	return gulp.src(chromeProductionDir + '/**/*')
		.pipe(zip(zipFilename))
		.pipe(gulp.dest(chromeZipsDir));
});

// Zip the production directory
gulp.task('cws:archive', ['cws:zip'], function() {
	var archiveFilename = 'Darkness-CWS-v' + manifestJson.version + '_(' + (new Date()).toISOString().slice(0, 19).replace('T', '__').replace(/:/g, '-') + ').zip';
	gutil.log("Copying to archive: " + archiveFilename);
	// Copy to archive
	return gulp.src(chromeZipsDir + '/' + zipFilename).pipe(rename(archiveFilename)).pipe(gulp.dest(chromeZipsDir));
});

gulp.task('cws', ['cws:replicate', 'cws:cleanup', 'cws:zip', 'cws:archive']);

//----------------------------------------------------------------------------------------------------------------------------------------------------
// SASS compilation
//----------------------------------------------------------------------------------------------------------------------------------------------------

// Clean up all existing (complied) CSS files
gulp.task('sass:cleanup', function() {
	gutil.log("Cleaning up .css and .css.map files");
	var deletedFiles = del.sync([
		chromeDevelopmentDir + '/themes/**/*.css',
		chromeDevelopmentDir + '/themes/**/*.css.map',
		chromeDevelopmentDir + '/themes-css',
		chromeDevelopmentDir + '/style/**/*.css',
		chromeDevelopmentDir + '/style/**/*.css.map',
		chromeDevelopmentDir + '/style-css'
	], { force: true, dryRun: false });
	for (var i in deletedFiles) gutil.log("Deleted: ", deletedFiles[i]);
});

// Compile all SCSS files to CSS & map files
gulp.task('sass:compile', function() {
	gulp.src(chromeDevelopmentDir + '/style/*.scss')
		.pipe(sourcemaps.init())
		.pipe(sass().on('error', sass.logError))
		.pipe(sourcemaps.write("./"))
		.pipe(gulp.dest(chromeDevelopmentDir + '/style-css'));

	gulp.src(chromeDevelopmentDir + '/themes/*.scss')
		.pipe(sourcemaps.init())
		.pipe(sass().on('error', sass.logError))
		.pipe(sourcemaps.write("./"))
		.pipe(gulp.dest(chromeDevelopmentDir + '/themes-css'));
});

// Compile all SCSS files to CSS & map files + keep watching them
gulp.task('sass:watch', function() {
	gutil.log("Watching for changes in .scss files");
	gulp.start('sass:compile');
	gulp.watch(chromeDevelopmentDir + '/themes/**/*.scss', ['sass:compile']);
	gulp.watch(chromeDevelopmentDir + '/style/**/*.scss', ['sass:compile']);
});

//----------------------------------------------------------------------------------------------------------------------------------------------------
// Installation
//----------------------------------------------------------------------------------------------------------------------------------------------------

// Compile all SCSS files to CSS & map files + keep watching them
gulp.task('install', function() {
	gulp.start('sass:cleanup');
	gulp.start('sass:compile');
	gutil.log("\nInstallation complete!\n" +
		"You may use the following commands:\n" +
		"$ gulp sass:compile    compile all .scss files to .css and .css.map\n" +
		"$ gulp sass:cleanup    delete all compiled .css and .css.map files\n" +
		"$ gulp sass:watch      watch all .scss files and compile when changed (recommended)\n");
});

//----------------------------------------------------------------------------------------------------------------------------------------------------
// New Skin
//----------------------------------------------------------------------------------------------------------------------------------------------------

// Create a new skin for Darkness
// Example: gulp skin:create --name=stackoverflow
gulp.task('skin:create', function() {
	var argv = require('yargs').argv;
	var replace = require('gulp-replace');
	var skinKey = argv.key;
	var errors = [];
	if (!skinKey || skinKey.length == 0) errors.push("ERROR: [KEY] must be specified and cannot be empty, aborting...");
	else if (!skinKey.match(/^[a-z0-9]+$/)) errors.push("ERROR: [KEY] must be all lowercase, no special characters allowed, aborting...");
	else if (fileExists(chromeDevelopmentDir + '/themes/websites/' + skinKey + '.scss')) errors.push("ERROR: a skin named '" + skinKey + "' already exists, aborting...");

	if (errors.length > 0) {
		console.log("Usage: gulp skin:create --key=[KEY]\n" +
			"This script creates a boilerplate for a new Darkness skin.\n" +
			"[KEY] = a unique key for the website. Must be alphanumeric, all lowercase, no spaces or special characters are allowed.\n" +
			"        Good examples: stackoverflow, cnn, 4chan, nytimes, googledrive\n" +
			"        Bad examples: stack-overflow, CNN, 4Chan, NY_Times, Google Drive\n");
		console.log("\n" + errors.join("\n") + "\n");
		return;
	}
	// Duplicating WEBSITE-TEMPLATE.scss
	gulp.src(chromeDevelopmentDir + '/themes/websites/WEBSITE-TEMPLATE.scss')
		.pipe(rename({ basename: skinKey }))
		.pipe(gulp.dest(chromeDevelopmentDir + '/themes/websites/'));

	// Copying and modifying [SITE]-iceberg.scss .scss file for skin
	gulp.src(chromeDevelopmentDir + '/themes/google-*.scss')
		.pipe(rename(function(path) {
			var res = path.basename.replace("google", skinKey);
			path.basename = res;
			return path;
		}))
		.pipe(replace('google', skinKey))
		.pipe(gulp.dest(chromeDevelopmentDir + '/themes/'));

	console.log("Skin '" + skinKey + "' successfully created!");
	console.log("1. Please edit 'js/background/config.js' and add '" + skinKey + "' to CONFIG.sites, use '" + skinKey + "' as key");
	console.log("2. Browse to chrome://extensions/ and reload the Darkness extension");
	console.log("3. Edit your new skin: " + chromeDevelopmentDir + '/themes/websites/' + skinKey + '.scss');
	console.log("4. To continuously compile the .scss during development, run: gulp sass:watch");

});