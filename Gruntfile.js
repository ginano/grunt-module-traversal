/*
 * grunt-module-traversal
 * https://github.com/ginano/grunt-module-traversal
 *
 * Copyright (c) 2013 ginano
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    // Configuration to be run (and then tested).
    moduleTraversal: {
      test: {
        src: ['../../../module/src/*.html']
      }
    }
  });

  // Actually load this plugin's task(s).
  grunt.loadTasks('tasks');

  // By default, lint and run all tests.
  grunt.registerTask('default', ['moduleTraversal']);
};
