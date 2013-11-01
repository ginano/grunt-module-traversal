# grunt-module-traversal

> It's a tool for dolphinjs to traverse the modules of one html file.

## Getting Started
This plugin requires Grunt `~0.4.1`

If you haven't used [Grunt](http://gruntjs.com/) before, be sure to check out the [Getting Started](http://gruntjs.com/getting-started) guide, as it explains how to create a [Gruntfile](http://gruntjs.com/sample-gruntfile) as well as install and use Grunt plugins. Once you're familiar with that process, you may install this plugin with this command:

```shell
npm install grunt-module-traversal --save-dev
```

Once the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

```js
grunt.loadNpmTasks('grunt-module-traversal');
```

You can run the testcase. change you path to ./node_modeules/grunt-module-traversal/, and run grunt. You could see the result file ./test/test_new.html was created! The ./Gruntfile.js has the base function of this task, so you could use it as that. If you have any question, you can contact me at sina weibo: http://weibo.com/ginano
## The "moduleTraversal" task

### Overview
In your project's Gruntfile, add a section named `moduleTraversal` to the data object passed into `grunt.initConfig()`.

```js
grunt.initConfig({
  moduleTraversal: {
    your_target: {
      // Target-specific file lists and/or options go here.
    },
  },
})
```

