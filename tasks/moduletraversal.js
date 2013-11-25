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
  var MODULE = require('./lib/module');
  var Util = require('./lib/util');
  var File = grunt.file;

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks

  grunt.registerMultiTask('moduleTraversal', 'traverse all html file, to find all the modules', function() {
    // Merge task-specific and/or target-specific options with these defaults.
    // 合并获取到的Gruntjs中的moduleTraversal配置options，这里可以设计默认参数
    var options = this.options({
      sharedFilesPercent:1.0,
      sharedFilesName:'shares'
    });
    Util.log(options);
    //将最后完成任务的句柄缓存起来
    var Alldone = this.async();
    //所有完成的标志
    var allDoneStamp= false;
    var _v = Date.now();
    var log = Util.log;
    //所有的html文件的hash索引，主要来标示是否都完成
    var allHtmlFiles={};
    var allHtmlFilesIndex=[];
    /**
     * 获取所有文件的最大共享文件列表,因为都是依赖的模块，不是自执行模块所以应该无序的
     * @return {[Object]} [description]
     */
    function getTheSharedFiles(){
      var fileList={};
      var alldone=0;
      var shares={};
      var len = allHtmlFilesIndex.length;
      var rate = options.sharedFilesPercent;
      //遍历所有的script 和css外联文件，并存储在fileList当中，如果存在就+1，不存在就设为1
      allHtmlFilesIndex.forEach(function(file){
          var _urls = allHtmlFiles[file].moduleList;
          var _len = _urls.length;
          var _temp;
          while(_len--){
            _temp = _urls[_len];
            if(fileList[_temp]){
              fileList[_temp]+=1;
            }else{
              fileList[_temp]=1;
            }
          }
      });
      //找到每个文件都共享的连接
      for(var p in fileList){
        if(fileList[p]>=Math.floor(len*rate)){
          shares[p]=true;
        }
      }
      return shares;
    }
    /**
     * 合并共享文件的所有列表插入到找到的第一个文件那里，然后删除共享文件列表中对应的节点，
     * @return {[type]} [description]
     */
    function processSharedFiles(shares){
      var shareHtmls=[], p,
          sharesname= options.sharedFilesName;
      Util.log('all the html shared the following files:');
      Util.log(shares);
      //共享的都打标
      for(p in shares){
        if(/\.css([\?#]\S+)?$/i.test(p)){
          shareHtmls.push('<link rel="stylesheet"  type="text/css" group="'+sharesname+'.css" href="'+p+'" />');
        }else{
          shareHtmls.push('<script type="text/javascript" group="'+sharesname+'.js" src="'+p+'"></script>');
        }
      }
      //遍历所有的文件
      allHtmlFilesIndex.forEach(function(file){
        var fileInfo = allHtmlFiles[file];
        var urls = fileInfo.moduleList;
        var html=[].concat(shareHtmls);
        var _src;
        urls.forEach(function(url){
          //如果不是共享的文件，直接添加
          if(!shares[url]){
            if(/\.css([\?#]\S+)?$/i.test(url)){
              html.push('<link rel="stylesheet"  type="text/css" href="'+url+'" />');
            }else{
              html.push('<script type="text/javascript" src="'+url+'"></script>');
            }
          }
        });
        _src = fileInfo.sourceCode.replace(/<--!!-->/i, html.join('\n')+'\n<!--merged end-->');
        File.write(fileInfo.outputPath, _src);
      });
    }
    /**
     * 检查是不是所有的html文件都处理完毕
     * @return {[type]} [description]
     */
    function checkAllHtmlDone(){
      Util.checkAllDone(allHtmlFiles, function(){
        var shares =getTheSharedFiles();
        processSharedFiles(shares);
        Alldone();
      });
    }
    /**
     * 拿到所有的源文件文件，先把所有的文件都索引起来
     * 最后才能根据每个文件是否完成了处理来调用grunt的tashdone句柄
     * @param  {[type]} f [description]
     * @return {[type]}   [description]
     */
    this.files.forEach(function(f){
      var _srcs = f.src;
      for(var i =0 ,len =_srcs.length; i< len; i++){
        if( allHtmlFiles[_srcs[i]]){
          continue;
        }
        allHtmlFiles[_srcs[i]] ={
          isDone:false
        };
        allHtmlFilesIndex.push(_srcs[i]);
      }
    });
    log('\n----------the following html files need to be traversed!----------');
    log(allHtmlFilesIndex.join('\n')+'-----------------------------------------\n');
    // Iterate over all specified file groups.
    // 开始循环遍历鄋的html文件
    allHtmlFilesIndex.forEach(function(filepath) {
      //每个文件都要新建一个模块系统，因为每个文件都是一个独立的jsruntime，模块系统都不一样
      var Module = new MODULE();
      /**
       * 因为所有的js代码都是以define(xxx)进行模块化的，那么这边下载下来eval执行之后将需要调用define
       * 由于eval的作用域是当前的环境，但是其中this就是window了。这里的define就采用闭包返回方法的形式保证其中的this只想当前额模块系统
       * @type {[type]}
       */
      var define = Module.getDefine();
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
       * @param  {[type]} data 文件的内容
       * @return {[type]}     如果返回的true就是说明这个是core核心文件，如果返回的是一个数组就表示当前文件内容中包含的模块列表
       */
      function processSourceCode(data){
        var len1,  _modules;
         // 去除注释内容
          data = clearComment(data);
          //如果是核心文件直接返回true
          //因为core文件后面增加了一句话log('core_file_load_success');就是这里用来校验的
          if(/core_file_load_success/i.test(data)){
            return true;
          }
          //如果是util文件，其中没有define任何模块（因为其他文件偶必须  
          if(!/define\s*\([^\)]+\)/i.test(data)){
            return;
          }
          //获取当前模块的数量
          var len1 = moduleList.index.length;
          //执行模块内容，将会调用define方法，从而将模块注册到moduleList当中去
          eval(data);
          //返回上面内容注册的模块列表就可以作为当前文件定义的模块
          return moduleList.index.slice(len1);
      }
      /**
       * [removeTheSameValueOfArray description]
       * 清除重复的列表
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
      /**
       * 根据最后的依赖url列表，生成对应的script或者link节点插入到核心文件之后
       * 因为这些模块都依赖于核心文件，但是执行入口又依赖这些文件，所以放在核心文件core.min.js后面最合适
       * @param  {[type]} urls [description]
       * @return {[type]}      [description]
       */
      function processTheUrlList(urls){
        var i,temp,len = filesDone.length,
            url,
            outputPath,
            insertScript,
            html=[];
        //注入代码设置当前合并后的代码为online线上模式，这样输出log就少了
        insertScript='<script  type="text/javascript">define(["globalSetting"], function(GS){GS.setStatus("online");}).executeit();</script>\n';
        //去重
        urls = removeTheSameValueOfArray(urls);
        //将文件名重命名为*_all.html表示处理后的文件
        outputPath = filepath.replace(/\.html/i,'.mod');
        log(filepath+', it dependenes the fllowing files:');
        log(urls);
        //找出核心文件的地方对应的内容，后面需要在此处插入所有的连接
        while(len--){
          if(filesDone[len].isCore){
            temp = filesDone[len].content;
          }
        }
        //生成连接的url列表字符串
        len= urls.length;
        while(len--){
          url = urls[len];
          urls[len] =  Util.getRelativePath(outputPath, url);
          // if(/\.css([\?#]\S+)?$/i.test(url)){
          //   //标记分组，对这个进行分组，只对这部分内容提取最大公约数的文件合并成
          //   html.push('<link rel="stylesheet"  type="text/css"  href="'+url+'" />');
          // }else{
          //   html.push('<script type="text/javascript"  src="'+url+'"></script>');
          // }
        }
        //插入进去
        // src =src.replace(temp, temp +'\n<!--merged by module traversal-->\n'+ insertScript+ html.join('\n')+'\n<!--merged end-->');
        // File.write(outputPath, src);
        // log('\nthe merged html file--------'+ outputPath);
        //标记当前文件已经处理完毕
        src =src.replace(temp, temp +'\n<!--merged by module traversal-->\n'+ insertScript+ '<--!!-->');
        allHtmlFiles[filepath].isDone= true;
        allHtmlFiles[filepath].outputPath = outputPath;
        allHtmlFiles[filepath].moduleList = urls;
        allHtmlFiles[filepath].sourceCode = src;
        //检查是不是所有html文件都处理完毕了
        checkAllHtmlDone();
      }
      /**
       * 检查当前文件的遍历第一遍所有代码处理完成
       * 因为要先把直接饮用到html文件的js代码进行遍历，才能知道哪些不需要加载，以及分析所有依赖的入口模块时哪个
       * @return {[type]} [description]
       */
      function checkFirstAlldone(){
        Util.checkAllDone(filesDone, function(){
            startTraversal(); //如过完成了就开始遍历
        });
      }
      /** 开始遍历所有的模块，从入口开始 */
      function startTraversal(callback){
        var _list = moduleList.list,
            _index =moduleList.index;
        var i,len, entryList=[], filesList=[];
        //检查是不是所有的入口模块遍历都搞完了
        //如果搞完乐居要开始处理文件写入了
        function checkAllDependenceDone(){
          Util.checkAllDone(entryList, function(){
            processTheUrlList(filesList);
          });
        }
        //找到所有入口的模块
        for(i=0,len =_index.length; i<len; i++){
          //如果是入口
          if(_list[_index[i]].isEntry){
            entryList.push({moduleName:_index[i], isDone:false});
          }
        }
        //开始从入口寻找依赖
        for(i=0, len = entryList.length; i<len;i++){
          //因为最后的i需要使用
          (function(j){
            //获取当前入口模块的依赖列表，获取成功之后执行回调
            getAllDependences(_list[entryList[j].moduleName], function(urlList){
              //标记当前入口文件遍历完成
              entryList[j].isDone = true;
              //将所有的文件url列表增加到当前html文件的依赖文件列表当中
              filesList = filesList.concat(urlList);
              //检查是不是所有的入口文件都遍历完成
              checkAllDependenceDone();
            });
          })(i);
        }
      }
      /**
       * [getAllDependences description]
       * 获取某个模块的依赖文件列表，并执行回调函数
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
        //本模块的依赖加载完成了
        function checkThisDone(){
            Util.checkAllDone(dependMods, function(){
              //回调传入依赖文件列表，但是应当倒序
              callback(urlList);
            });
        }
        //如果不依赖任何模块，就直接执行回调
        if(!dependences || dependences.length<1){
          callback([]);
          return;
        }

        //遍历所有的依赖模块列表
        for(i=0, len = dependences.length; i<len; i++){
          //去除相对路径，转化为该被依赖的模块相对于依赖他的模块对应的真实模块名
          //例如，当前正在遍历widget/dialog/index, 其依赖于./template
          //需要获得为widget/dialog/template
          realModuleName =Module.getModuleRealName(moduleName, dependences[i]);
          //如果已经存在了直接跳过该模块
          if(moduleList.list[dependences[i]]){
            continue;
          }
          //获取当前模块文件地址,主要是根据setPath设定的目录地址
          _url = Module.getPathByModuleName(realModuleName);
          //获取当前模块文件地址相对于当前html文件的地址
          _url = Module.getModuleRealName(filepath, _url);
          //如果是css文件直接传入url即可
          urlList.push(_url);
          //css文件不需要去分析它的依赖了，直接跳过
          if(Util.checkPathExtensionName('css', realModuleName)){
            // log(realModuleName + '--------'+ _url +'--------' +filepath);
            continue;
          }
          //将当前需要依赖的模块信息存储起来
          dependMods.push({moduleName:realModuleName, url:_url, isDone:false});
        }
        // log(moduleName+'\n--'+JSON.stringify(urlList)+'\n--'+JSON.stringify(dependMods));
        // 检查一下是否有完成的情况。比如刚好都是已经存在的模块所以需要先试一下
        checkThisDone();
        //加载模块内容，然后去加载依赖，这些依赖都是没有加载的所以都要去加载
        for(i=0, len = dependMods.length; i<len; i++){
          temp = dependMods[i];
          (function(mod,j){
            //获取文件内容，并执行回调
            Util.getContent(mod.url, function(data){
              //处理当前模块的内容，就是注册模块
              var theModuleList = processSourceCode(data);
              //这个模块被加载过了，因为有可能在之前没有被加载，而这个时候等你回来了别人刚好也加载了，所以就没哟必要去处理它的依赖了
              if(theModuleList.length<1){
                // log('["'+ mod.moduleName+'"] has been defined!!');
                //标记为当前模块完成
                dependMods[j].isDone = true;
                //检查所有的模块都完成与否
                checkThisDone();
                return;
              }
              // theModuleList.forEach(function(mi){
              // 目前强制要求自动依赖加载的模块只允许一个模块声明对应一个文件
              // 递归调用，再获取当前模块的所有依赖，并执行回调
                getAllDependences(moduleList.list[theModuleList[0]], function(ul){
                  //将当前模块的依赖添加到父模块的依赖列表中
                  urlList =urlList.concat(ul);
                  //标记为完成
                  dependMods[j].isDone = true;
                  //检查是否完成
                  checkThisDone();
                });
              // });

            });
          })(temp,i);
        }
      }
      //获取所有的script标签
      var scripts = src.match(/<script[^>]*>(?:[\s\S]*?)<\/script\s*>/ig) || [];
      //增加初始化标示，用于后面校验是否都完成的
      scripts.forEach(function(content, index){
        filesDone[index]={isDone:false, content:content};
      });
      //循环所有的script标签内容
      scripts.forEach(function(content, index){
        var href = content.match(/^<script[^>]+src=(?:"|')\s*(\S+)\s*(?:"|')/i);
        var path, iscore;
        //如果是外联引入通过src引入的
        if(href && href[1]){
          //获取绝对路径
          path = Util.getAbsolutePath(filepath, href[1]);
          Util.getContent(path, function(data){
            //处理内容，看看是否是核心模块，后面会用到，在此处插入所有依赖列表
            var isCore = processSourceCode(data);
            filesDone[index].isDone =true;
            filesDone[index].isCore = (isCore === true);
            //完成了检查是不是初次遍历完成
            checkFirstAlldone();
          });
        }else{
          //如果是内联的代码，提取代码内容，直接就注册模块
          iscore = processSourceCode(content.replace(/<(\/)?script(\s+[^>]+)*>/ig,''));
          filesDone[index].isDone =true;
          filesDone[index].isCore = (iscore === true);
          checkFirstAlldone();
        }
      });
    });
  });

};
