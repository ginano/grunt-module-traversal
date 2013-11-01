'use strict';

var Path = require('path');
var Url = require('url');
var Http = require('http');
var File = require('fs');
var Util = require('./util');

var moduleList={
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
	},
	moduleIndex=['bjt','globalSetting'],
	options={},
	defaultSetting={
        mod:'../',
        core:'../',
        page:'../',
        widget:'../',
        util:'../'
  	},
	globalSetting={
		setPath:function(opt){
			options = Util.extend(defaultSetting,opt);
		}
	};
function define(modulename, dependences, factory){
	if('function' == typeof modulename){
		factory = modulename;
		modulename= 'anonymous_'+moduleIndex.length;
		dependences =[];
	}
	if(modulename instanceof Array){
		factory =dependences;
		dependences = modulename;
		modulename = 'anonymous_'+moduleIndex.length;
	}
	if(moduleList[modulename]){
		return;
	}
	moduleList[modulename]={
		moduleName: modulename,
		dependences: dependences||[],
		factory: factory
	};
	moduleIndex.push(modulename);
	return {
		executeit:function(){
			moduleList[modulename].isEntry = true;
			//如果是设置
			if(dependences[0]=='globalSetting'){
				factory(globalSetting);
			}
		}
	};
}
function getModules(){
	return {
		list:moduleList,
		index: moduleIndex
	};
}
function getOptions(){
	return options;
}
/**
 * 获取模块的路径，根据配置来的
 * @param  {[type]} mn [description]
 * @return {[type]}    [description]
 */
function getPathByModuleName(mn){
    var moduleName = /\S+\.\S+$/i.test(mn)?mn:(mn+'.js'),
        tempReg,
     moduleName = moduleName.replace(/\\/ig, '/');
    for(var p in options){
        tempReg= new RegExp('^'+p+'[\/][^\/]+','i');
        //如果有配置该路径
        if(tempReg.test(moduleName)){
            return options[p]+moduleName;
        }
    }
    return moduleName;
}
/**
 * 获取绝对的模块名，把./以及../格式的模块转化为/xxx/xxx的形式
 * @param  {[type]} dep      [description]
 * @param  {[type]} relative [description]
 * @return {[type]}          [description]
 */
function getRealModuleName(dep, relative){
    if(/^(\.\/|\.\.\/)\S+/i.test(relative)){
        return Util.getAbsolutePath(dep+'.js', relative);
    }
    return relative;
}
module.exports= {
	define:define,
	getModules: getModules,
	getOptions: getOptions,
	getModuleRealName: getRealModuleName,
	getPathByModuleName:getPathByModuleName
};
