/*
 * grunt-module-traversal
 * https://github.com/ginano/grunt-module-traversal
 *
 * Copyright (c) 2013 ginano
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {
  var path = require('path');
  var URL = require('url');
  var http = require('http');
  var Module = require('./lib/module');
  var Util = require('./lib/util');
  var File = grunt.file;

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks

  grunt.registerMultiTask('moduleTraversal', 'traverse all html file, to find all the modules', function() {
    // Merge task-specific and/or target-specific options with these defaults.
    var options = this.options({
      test:1
    });
    var Alldone = this.async();
    var allDoneStamp= false;
    var _v = Date.now();
    var log = Util.log;
    var define = Module.define;
    var allHtmlFiles={};

    function checkAllHtmlDone(){
      Util.checkAllDone(allHtmlFiles, function(){
        Alldone();
      });
    }
    /**
     * 拿到所有的文件
     * @param  {[type]} f [description]
     * @return {[type]}   [description]
     */
    this.files.forEach(function(f){
      allHtmlFiles[f.src[0]]={
        isDone:false
      };
    });
    // Iterate over all specified file groups.
    this.files.forEach(function(f) {
      var opt = {
        test: f.test || options.test
      };
      var filepath = f.src[0];

      //just support one file
      var src =File.read(filepath);
      var filesDone=[];
      //引用所有的模块
      var moduleList= Module.getModules();
      /**
       * 清除注释内容
       * @param  {[type]} str [description]
       * @return {[type]}     [description]
       */
      function clearComment(str){
        return str;
        //return str.replace(/\/\*[^\*\/]*\*\//ig, '').replace(/\/\/[^\n]*\n/ig,'');
      }
      /**
       * 得到module字符串
       * @param  {[type]} data [description]
       * @return {[type]}      [description]
       */
      function processSourceCode(data){
        var len1,  _modules;
         // 去除注释内容
          data = clearComment(data);
          //如果是核心文件
          if(/core_file_load_success/i.test(data)){
            return true;
          }
          //如果是util
          if(!/define\s*\([^\)]+\)/i.test(data)){
            return;
          }
          var len1 = moduleList.index.length;
          eval(data);
          return moduleList.index.slice(len1);
      }
      /**
       * [removeTheSameValueOfArray description]
       * @param  {[type]} array [description]
       * @return {[type]}       [description]
       */
      function removeTheSameValueOfArray(array){
        var obj={},
            r=[],
            i,len, temp;
        for(i=0,len=array.length; i<len; i++){
          temp = array[i].toString();
          if(obj[temp]){
            continue;
          }
          r.push(array[i]);
          obj[temp]=true;
        }
        return r;
      }
      function processTheUrlList(urls){
        var i,temp,len = filesDone.length,
            url,
            outputPath,
            html=[];
        urls = removeTheSameValueOfArray(urls);
        outputPath = filepath.replace(/\.html/i,'_all.html');
        log(filepath+', it dependenes the fllowing files:');
        log(urls);
        //找出核心文件的地方
        while(len--){
          if(filesDone[len].isCore){
            temp = filesDone[len].content;
          }
        }
        len= urls.length;
        while(len--){
          url = urls[len];
          url = Util.getRelativePath(outputPath, url);
          if(/\.css([\?#]\S+)?$/i.test(url)){
            html.push('<link rel="stylesheet" type="text/css"  href="'+url+'" />');
          }else{
            html.push('<script type="text/javascript" src="'+url+'"></script>');
          }
        }
        src =src.replace(temp, temp +'\n<!--merged by module traversal-->\n'+ html.join('\n')+'\n<!--merged end-->');
        File.write(outputPath, src);
        log('\nthe merged html file--------'+ outputPath);
        allHtmlFiles[filepath].isDone= true;
        checkAllHtmlDone();
      }
      /**
       * 遍历第一遍所有代码处理完成
       * @return {[type]} [description]
       */
      function checkFirstAlldone(){
        Util.checkAllDone(filesDone, function(){
            startTraversal();
        });
      }
      /** 开始遍历 */
      function startTraversal(callback){
        var _list = moduleList.list,
            _index =moduleList.index;
        var i,len, entryList=[], filesList=[];
        function checkAllDependenceDone(){
          Util.checkAllDone(entryList, function(){
            processTheUrlList(filesList);
          });
        }
        for(i=0,len =_index.length; i<len; i++){
          //如果是入口
          if(_list[_index[i]].isEntry){
            entryList.push({moduleName:_index[i], isDone:false});
          }
        }
        //开始从入口寻找依赖
        for(i=0, len = entryList.length; i<len;i++){
          (function(j){
            getAllDependences(_list[entryList[j].moduleName], function(urlList){
              entryList[j].isDone = true;
              filesList = filesList.concat(urlList);
              checkAllDependenceDone();
            });
          })(i);
        }
      }
      /**
       * [getAllDependences description]
       * @param  {[type]}   module     [description]
       * @param  {[type]}   entryIndex [description]
       * @param  {Function} callback   [description]
       * @return {[type]}              [description]
       */
      function getAllDependences(module,callback){
        var moduleName = module.moduleName,
            dependences = module.dependences || [];
        var i,len,temp;
        var realModuleName,
            dependMods=[],
            urlList=[],
            _url;
        //本模块的加载完成了
        function checkThisDone(){
            Util.checkAllDone(dependMods, function(){
              //回调传入依赖文件列表，但是应当倒序
              callback(urlList);
            });
        }
        //如果不依赖任何模块
        if(!dependences || dependences.length<1){
          callback([]);
          return;
        }

        //遍历所有的模块
        for(i=0, len = dependences.length; i<len; i++){
          realModuleName =Module.getModuleRealName(moduleName, dependences[i]);
          //如果已经存在了直接跳过
          if(moduleList.list[dependences[i]]){
            continue;
          }
          _url = Module.getPathByModuleName(realModuleName);
          _url = Module.getModuleRealName(filepath, _url);
          //如果是css文件直接传入url即可
          urlList.push(_url);
          //css文件不需要去分析它的依赖了，直接跳过
          if(Util.checkPathExtensionName('css', realModuleName)){
            // log(realModuleName + '--------'+ _url +'--------' +filepath);
            continue;
          }
          dependMods.push({moduleName:realModuleName, url:_url, isDone:false});
        }
        // log(moduleName+'\n--'+JSON.stringify(urlList)+'\n--'+JSON.stringify(dependMods));
        // 检查一下是否有完成的情况。
        checkThisDone();
        //加载模块内容，然后去加载依赖
        for(i=0, len = dependMods.length; i<len; i++){
          temp = dependMods[i];
          (function(mod,j){
            Util.getContent(mod.url, function(data){
              var theModuleList = processSourceCode(data);
              //这个模块被加载过了
              if(theModuleList.length<1){
                // log('["'+ mod.moduleName+'"] has been defined!!');
                dependMods[j].isDone = true;
                checkThisDone();
                return;
              }
              // theModuleList.forEach(function(mi){
              // 目前强制要求自动依赖加载的模块只允许一个模块声明对应一个文件
                getAllDependences(moduleList.list[theModuleList[0]], function(ul){
                  urlList =urlList.concat(ul);
                  dependMods[j].isDone = true;
                  checkThisDone();
                });
              // });

            });
          })(temp,i);
        }
      }

      var scripts = src.match(/<script[^>]*>(?:[\s\S]*?)<\/script\s*>/ig) || [];
      //增加初始化标示
      scripts.forEach(function(content, index){
        filesDone[index]={isDone:false, content:content};
      });
      scripts.forEach(function(content, index){
        var href = content.match(/^<script[^>]+src=(?:"|')\s*(\S+)\s*(?:"|')/i);
        var path, iscore;
        //如果是外联引入
        if(href && href[1]){
          path = Util.getAbsolutePath(filepath, href[1]);
          Util.getContent(path, function(data){
            var isCore = processSourceCode(data);
            filesDone[index].isDone =true;
            filesDone[index].isCore = (isCore === true);
            checkFirstAlldone();
          });
        }else{
          iscore = processSourceCode(content.replace(/<(\/)?script(\s+[^>]+)*>/ig,''));
          filesDone[index].isDone =true;
          filesDone[index].isCore = (iscore === true);
          checkFirstAlldone();
        }
      });
    });
  });

};
