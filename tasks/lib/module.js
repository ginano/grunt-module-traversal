/**
 * 为了能够获取到每个模块的信息，最关键是依赖关系。所以需要构造一个虚拟的模块系统，来解析这个模块列表
 * 
 */
'use strict';

var Path = require('path');
var Url = require('url');
var Http = require('http');
var File = require('fs');
var Util = require('./util');
var defaultSetting={
        mod:'../',
        core:'../',
        page:'../',
        widget:'../',
        util:'../'
  	};
 /**
  * 由于每个模块时独立的，所以每个文件对应一个模块系统
  * 模块列表作为一个私有变量（自己的属性），因为系统自定义了bjt和globalSetting两个模块
  * 所以这里也要预设两个
  */
function Module(){
	this.moduleList={
		'bjt':{
			moduleName:'bjt',
			dependences:[],
			factory:function(){}
		},
		'globalSetting':{
			moduleName:'globalSetting',
			dependences:[],
			factory:function(){}
		}
	};
	this.moduleIndex=['bjt','globalSetting'];
	this.options={
	};
}
Module.prototype={
	/**
	 * 声明当前模块系统下面的模块
	 * @param  {[type]} modulename  [description]
	 * @param  {[type]} dependences [description]
	 * @param  {[type]} factory     [description]
	 * @return {[type]}             [description]
	 */
	define:function(modulename, dependences, factory){
		var self = this;
		//处理各种传参的情况
		if('function' == typeof modulename){
			factory = modulename;
			modulename= 'anonymous_'+self.moduleIndex.length;
			dependences =[];
		}
		if(modulename instanceof Array){
			factory =dependences;
			dependences = modulename;
			modulename = 'anonymous_'+self.moduleIndex.length;
		}
		//如果已经注册过了就直接返回
		if(self.moduleList[modulename]){
			return;
		}
		//存储到模块列表当汇总
		self.moduleList[modulename]={
			moduleName: modulename,
			dependences: dependences||[],
			factory: factory
		};
		self.moduleIndex.push(modulename);
		/**
		 * 因为模块中有直接运行的
		 * define('xx',[],function(){}).excuteit();
		 * 所以需要对define返回一个具有excuteit方法的对象，并且这个返回的方法需要给我们
		 * 标记当前模块时入口模块，方便我们作为分析依赖的入口
		 * 如果依赖列表有globalsetting调用的，需要再给其对应的工厂方法返回一个setPath的方法，
		 * 并且这个方法需要能够让我们这个伪模块系统知道配置信息
		 */
		return {
			executeit:function(){
				self.moduleList[modulename].isEntry = true;
				//如果是设置
				if(dependences[0]=='globalSetting'){
					factory({
						setPath:function(opt){
							self.options = Util.extend(defaultSetting,opt);
						}
					});
				}
			}
		};
	},
	/**
	 * 获取当前的模块信息，主要是引用一下这个列表
	 * 因为后续的操作都需要这个信息
	 * @return {[type]} [description]
	 */
	getModules: function(){
		return {
			list:this.moduleList,
			index: this.moduleIndex
		};
	},
	/**
	 * 获取当前的选项
	 * @return {[type]} [description]
	 */
	getOptions: function(){
		return this.options;
	},
	/**
	 * 获取绝对的模块名，把./以及../格式的模块转化为/xxx/xxx的形式
	 * @param  {[type]} dep      [description]
	 * @param  {[type]} relative [description]
	 * @return {[type]}          [description]
	 */
	getModuleRealName: function(dep, relative){
	    if(/^(\.\/|\.\.\/)\S+/i.test(relative)){
	        return Util.getAbsolutePath(dep+'.js', relative);
	    }
	    return relative;
	},
	/**
	 * 获取模块的路径，根据配置来的
	 * @param  {[type]} mn [description]
	 * @return {[type]}    [description]
	 */
	getPathByModuleName: function(mn){
	    var moduleName = /\S+\.\S+$/i.test(mn)?mn:(mn+'.js'),
	        tempReg, p,
	        options = this.options;
	     moduleName = moduleName.replace(/\\/ig, '/');
	    for(p in options){
	        tempReg= new RegExp('^'+p+'[\/][^\/]+','i');
	        //如果有配置该路径
	        if(tempReg.test(moduleName)){
	            return options[p]+moduleName;
	        }
	    }
	    return moduleName;
	},
	/**
	 * 返回对应的define函数，由于后面的eval执行所需要的define都需要将每个模块的define方法返回去，
	 * 只这种闭包的方式才能保证所有的define都是对应的this
	 * @return {[type]} [description]
	 */
	getDefine:function(){
		var self = this;
		return function(){
			return self.define.apply(self, arguments);
		}
	}
};
module.exports= Module;