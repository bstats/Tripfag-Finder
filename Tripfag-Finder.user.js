// ==UserScript==
// @name          4chan Tripfag-Finder
// @namespace     terrance
// @description   Find threads.
// @license       CC BY-NC-SA 3.0; https://raw.github.com/bstats/Tripfag-Finder/master/license
// @author        terrance
// @contributor   milky
// @run-at        document-start
// @match       https://boards.4chan.org/b/*
// @match       http://boards.4chan.org/b/*
// @updateURL     https://github.com/bstats/Tripfag-Finder/raw/master/Tripfag-Finder.user.js
// @version       2.1.0
// @icon          https://t-f.xyz/finder/icon-64.png
// ==/UserScript==

(function(){
var $,c,d,Admin,Prefs,Options,Finder,API,CSS;

$ = {
    qa : function(query, scope){
        if(scope == null)
            scope = d.body;
        return scope.querySelectorAll(query);
    },
    q : function(query, scope){
        return $.qa(query,scope)[0];
    },
    id : function(id){
        return d.getElementById(id);
    },
    el : function(tag, properties){
        return $.extend(d.createElement(tag),properties);
    },
    extend : function(object, properties) {
        var key, val;
        for (key in properties) {
            val = properties[key];
            object[key] = val;
        }
        return object;
    },
    on : function(el, event, func, cap){
        if(el !== null)
            el.addEventListener(event,func,cap ? cap : false);
    },
    off : function(el, event, func){
        el.removeEventListener(event,func);
    },
    append : function(parent, el){
        parent.appendChild(el);
    },
    prepend : function(parent, el){
        parent.insertBefore(el,parent.firstChild);
    },
    remove : function(el){
        if(el !== null)
            el.parentNode.removeChild(el);
    },
    width : function(el){
        if(typeof el === 'string')
            el = $.q(el);
        return parseInt(window.getComputedStyle(el).getPropertyValue("width").replace("px",""));
    },
    height : function(el){
        if(typeof el === 'string')
            el = $.q(el);
        return parseInt(window.getComputedStyle(el).getPropertyValue("height").replace("px",""));
    },
    ajax : function(method,url,payload,responseType,callbacks){
        var xhReq = new XMLHttpRequest();
        xhReq.open(method,url,true);
        xhReq.responseType = responseType;
        xhReq.timeout = 20000;
        if(method === 'POST')
            xhReq.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        xhReq.setRequestHeader("X-Requested-With","TripfagFinder"+c.VERSION);
        if(typeof callbacks.success === 'function')
            xhReq.onloadend = callbacks.success;
        if(typeof callbacks.failure === 'function'){
            xhReq.onerror = callbacks.failure;
            xhReq.ontimeout = callbacks.failure;
        }
        xhReq.send(payload);
    },
    dispatchEvent : function(type, detail) {
        if (detail === null) {
          detail = {};
        }
        return d.dispatchEvent(new CustomEvent(type, detail));
    },
    e : function(str){
        return encodeURIComponent(str);
    }
};

c = {
    NAMESPACE : "TripfagFinder.",
    VERSION : "2.1.0",
    HOST : "t-f.xyz",
    API : "/finder/api.php",
    chanX : false,
    offsetX : 120,
    offsetY : 110,
    flip : 1,
    adminpage : ""
};

c.protocol = window.location.protocol;
c.thread = window.location.pathname.match(/\/thread\//) ? window.location.pathname.split("/thread/")[1].substring(0,9) : "";
c.is_chrome = navigator.userAgent.toLowerCase().indexOf('chrome') > -1;

d = window.document;
Prefs = {};

API = {
    get : function(){
        Finder.refreshing = true;
        $.ajax('POST',
            "//"+c.HOST+c.API,"a=get&t="+c.thread+"&p="+$.e(Options.get('password'))+"&ap="+$.e(Options.get('AdminPassword'))+"&v="+c.VERSION,
            "json",
            {success: Finder.processResponse, failure: Finder.handleError });
    },
    mark : function(thread,type){
        $.ajax('POST',
            "//"+c.HOST+c.API,"a=set&t="+thread+"&type="+type+"&p="+Options.get('Password')+"&v="+c.VERSION,
            "json",
            {success: Finder.refresh, failure: Finder.handleError });
    },
    unmark : function(){
        $.ajax('POST',
            "//"+c.HOST+c.API,"a=unset&t="+c.thread+"&p="+Options.get('Password')+"&v="+c.VERSION,
            "json",
            {success: Finder.refresh, failure: Finder.handleError });
    },//Admin functions follow
    del : function(e){
        var threadId = e.target.parentNode['data-thread'];
        var type = e.target.parentNode['data-type'];
        $.ajax('POST',
            "//"+c.HOST+c.API,"a=delete&t="+threadId+"&y="+type+"&p="+Options.get('Password')+"&password="+Options.get('AdminPassword')+"&v="+c.VERSION,
            "json",
            {success: Finder.refresh, failure: Finder.handleError});
    }
};

Finder = {
    init : function(){
        Finder.refreshing = false;
        Options.init();
        Finder.createFinder();
        setInterval(Finder.refresh,120000);
        if(Finder.fresh)
            Finder.notifyUpdateSuccess();
    },
    createFinder : function(){
        Finder.destroyFinder();
        Finder.location = Options.get("Location");
        Finder.checkSettings();
        CSS.init();
        Finder.container = $.el('div',{id:'threadFinderContainer',className:'reply',innerHTML:'<strong>Threads</strong>'});
        Finder.hidden = true;

        
        if(Finder.location === "slideIn"){
            var handle = $.el('span',{id:"tf_open",innerHTML:'&nbsp;'});
            $.on(handle,'click',Finder.slide);
            $.append(Finder.container,handle);
        }
        if(Finder.location === 'float' || Finder.location === 'floatFixed'){
            var handle = $.el('div',{id:"tf_bar",innerHTML:'Tripfag-Finder'});
            Finder.xpos = parseFloat(Options.get("PositionX"));
            Finder.ypos_abs = parseInt(Options.get("PositionY_abs"));
            Finder.ypos_rel = parseFloat(Options.get("PositionY_rel"));
            handle.onmousedown = Finder.grabStart;
            handle.ondblclick = Finder.windowShade;
            Finder.folded = false;
            Finder.grabbing = false;
            Finder.shade = $.el('a',{id:'tf_shade',href:'javascript:;',innerHTML:'-',onclick:Finder.windowShade});
            $.prepend(Finder.container,Finder.shade);
            $.prepend(Finder.container, handle);
            
            if(Finder.location === 'float'){
                Finder.container.style.top = Finder.ypos_abs + "px";
                Finder.container.style.left = Finder.xpos + "%";
            }
            else{
                Finder.container.style.top = Finder.ypos_rel + "%";
                Finder.container.style.left = Finder.xpos + "%";
            }
        }
        
        Finder.threadWrapper = $.el('div',{id:'tf_threadWrapper'});
        $.append(Finder.container, Finder.threadWrapper);
        
        Finder.refreshButton = $.el('input',{type:'button',value:'Refresh'});
        $.on(Finder.refreshButton,"click", Finder.refresh);
        $.append(Finder.container,Finder.refreshButton);
        
        if(/\/thread\//.test(d.location.href)){
            Finder.typeSelect = $.el('select',{id:'tf_type'});
            Finder.markButton = $.el('input',{type:'button',style:'width:auto',value:'Mark'});
            Finder.unmarkButton = $.el('input',{type:'button',style:'width:auto',value:'Unmark'});
            
            $.on(Finder.markButton,"click", Finder.mark);
            $.on(Finder.unmarkButton,"click", Finder.unmark);
        
            for(var type in Options.threadTypes){   
                if(Prefs[type])
                    $.append(Finder.typeSelect,$.el("option",{value:type,textContent:Options.threadTypes[type]})); 
             };
             
             $.append(Finder.container,Finder.typeSelect);
             $.append(Finder.container,Finder.markButton);
             $.append(Finder.container,Finder.unmarkButton);
        }
        $.append(Finder.container,$.el('div',{id:"tf_notify",className:"tfHidden"}));
        $.append(Finder.container,$.el('div',{id:"tf_error",className:"tfHidden"}));
        
        
        switch(Finder.location){
            case "float":
            case "floatFixed":
            case "topCenter":
            case "topLeft":
                $.prepend($.id("delform"),Finder.container);
                break;
            case "bottomLeft":
            case "bottomCenter":
            default:
                $.append($.id("delform"),Finder.container);
        }

        Options.makeLink();
        
        
        if(Prefs["AutoSlide"])
            setTimeout(Finder.slide, 250);
        else
            Finder.refresh();
    },
    destroyFinder : function(){
        $.remove($.id("threadFinderContainer"));
    },
    refresh : function(){
        if(Finder.refreshing) return;
        Finder.disableRefresh();
        API.get();
    },
    processResponse : function(e){
        var response = e.target.response;
        var rows = response.data;
        var users = response.users;
        var announce = response.announce;
        c.adminpage = response.adminpage;
        Finder.admin = response.admin;
        if(Finder.admin) Admin.makeLink();
        var threads = new Array();
        if(rows.length < 1){
            Finder.threadWrapper.innerHTML = "No threads are currently marked.";
        }
        else{
            var typeTotals = {};
            for(var r = 0; r < rows.length; r++)
                typeTotals[rows[r].type] = typeTotals[rows[r].type] == null ? rows[r].votes : typeTotals[rows[r].type] + rows[r].votes;
            for(var r = 0; r < rows.length; r++){
                var t = rows[r];
                if(t['type'] === "override")
                    threads[threads.length] = $.el('div',{className:"tf_override",innerHTML:t['thread']});
                else if(Prefs[t['type']]){
                    t.percent = ~~(t.votes/typeTotals[t.type]*100);
                    threads[threads.length] = $.el('div',{
                        className:"tf_thread",
                        "data-thread":t.thread,"data-votes":t.votes,"data-type":t.type,
                        "data-tim":t.tim,"data-replies":t.r,"data-images":t.i,
                        innerHTML:"<a class='tf_threadLink' href='/b/thread/"+t.thread+"'>"+Options.threadTypes[t.type]+" Thread: "+t.thread+" ("+t.percent+"%) ("+t.votes+")</a>"});
                    if(t.thread == c.thread){
                        Finder.typeSelect.value = t.type;
                    }
                }
                
            }
            Finder.threadWrapper.innerHTML = "";
            for(var t = 0; t < threads.length; t++){
                if(Prefs['Counts'] && threads[t].className !== 'tf_override'){
                    $.append(threads[t],$.el('span',{className:'tf_Counts',textContent:" (R: "+threads[t]['data-replies']+" I: "+threads[t]['data-images']+")"}));
                }
                if(Finder.admin && threads[t].className !== 'tf_override'){
                    $.append(threads[t],$.el('a',{href:"javascript:;",textContent:"x",onclick:API.del,className:'tf_adminDelete'}));
                }
                $.append(Finder.threadWrapper,threads[t]);
            }
            if(Prefs['Users']) $.append(Finder.threadWrapper,$.el('span',{textContent:"Online Users: "+users}));
            if(Prefs['Hover']) Finder.thumbPreview();
        }
        if(announce != ""){
          $.append(Finder.threadWrapper,$.el('div',{className:"tf_notify",innerHTML:announce}));
        }
        $.id('tf_error').className = "tfHidden";
        $.id("tf_error").innerHTML = "";
        if(Finder.location == 'fixed' || Finder.location == 'floatFixed'){
          Finder.checkBounds();
        }
        Finder.enableRefresh();
    },
    handleError : function(e){
        if(e.type === 'timeout')
            Finder.err("Error loading threads. (Operation timed out)");
        else
            Finder.err("Error loading threads. Try refreshing.");
        Finder.enableRefresh();
    },
    mark : function(){
        var thread = c.thread;
        var type = $.id('tf_type').value;
        API.mark(thread,type);
    },
    unmark : function(){
        API.unmark();
    },
    slide : function(){
        if(Finder.hidden){
            Finder.refresh();
            $.id('threadFinderContainer').style.right = "0em";
            Finder.hidden = false;
        }
        else{
            $.id('threadFinderContainer').style.right = "-24.1em";
            Finder.hidden = true;
        }
    },
    thumbPreview : function(){
        Finder.thumbRemove();
        $.remove($.id('tf_hover'));
        var threadLinks = $.qa("a.tf_threadLink");
        for(var l = 0; l < threadLinks.length; l++){
            $.on(threadLinks[l],'mouseover',Finder.thumbInit);
            $.on(threadLinks[l],'mouseout',Finder.thumbRemove);
            $.on(threadLinks[l],'mousemove',Finder.thumbMove);
        }
    },
    thumbInit : function(e){
        var div = e.target.parentNode;
        var tim = div['data-tim'];
        
        Finder.hover = $.el('img',{id:'tf_hover'});
        Finder.hover.style.display = 'none';
        Finder.hover.style.position = 'fixed';
        $.append(d.body,Finder.hover);
        
        Finder.hover.onload = function(){
           Finder.hover.style.display = 'block';
           Finder.thumbMove(e);
        };
        
        $.id("tf_hover").src = "//t.4cdn.org/b/thumb/"+ tim +"s.jpg";
    },
    thumbMove : function(e){
        var tf_hover = Finder.hover;
        var hoverHeight = $.height(tf_hover);
        var hoverWidth = $.width(tf_hover);
        var Y = e.clientY - c.offsetY;
        if(e.clientX > window.innerWidth/2) c.flip = -1;
        else c.flip = 1;
        
        if(e.clientY < c.offsetY)
            Y = 0;
        
        if(e.clientY > (window.innerHeight - (hoverHeight-c.offsetY)))
            Y = window.innerHeight - hoverHeight;
        if(c.flip === 1)
            tf_hover.style.left = ((e.clientX + c.offsetX) + "px");
        else
            tf_hover.style.left = ((e.clientX - c.offsetX - hoverWidth) + "px");
        tf_hover.style.top = (Y + "px");
    },
    thumbRemove : function(){
        $.remove($.id("tf_hover"));
    },
    grabStart : function(e){
        if (e.type === 'mousedown' && e.button !== 0) {
            return;
        }
        e.preventDefault();
        Finder.grabbed = true;
        Finder.grab = {};
        Finder.grab.mouseX = e.clientX;
        Finder.grab.mouseY = e.clientY;
        Finder.grab.xpos = isNaN(Finder.xpos) ? 0 : Finder.xpos;
        Finder.grab.ypos_abs = Finder.ypos_abs;
        Finder.grab.ypos_rel = Finder.ypos_rel;
        $.on(d,'mousemove',Finder.grabMove);
        $.on(d,'mouseup',Finder.grabEnd);
    },
    checkBounds : function(){
      var rect = Finder.container.getBoundingClientRect();
      if(rect.left / window.innerWidth < 0.02){
        Finder.container.style.left = '0';
        Finder.xpos = 0;
        rect = Finder.container.getBoundingClientRect();
        Finder.xpos = rect.left * 100 / window.innerWidth;
      }
      if(rect.right / window.innerWidth > 0.98){
        Finder.container.style.left = null;
        Finder.container.style.right = '0';
        rect = Finder.container.getBoundingClientRect();
        Finder.xpos = rect.left * 100 / window.innerWidth;
      }
      if(Finder.location === 'float'){
        if(rect.top / window.innerHeight < 0.02){
          Finder.container.style.top = '0';
          Finder.ypos_abs = 0;
        }
        if(rect.bottom / window.innerHeight > 0.98){
          Finder.container.style.top = null;
          Finder.container.style.bottom = '0';
        }
        rect = Finder.container.getBoundingClientRect();
        Finder.ypos_abs = rect.top * 100 / window.innerHeight;
      }
      else{
        if(rect.top / window.innerHeight < 0.02){
          Finder.container.style.top = '0';
          Finder.ypos_rel = 0;
        }
        if(rect.bottom / window.innerHeight > 0.98){
          Finder.container.style.top = null;
          Finder.container.style.bottom = '0';
        }
        rect = Finder.container.getBoundingClientRect();
        Finder.ypos_rel = rect.top * 100 / window.innerHeight;
      }
      
      
    },
    grabMove : function(e){
        if(!Finder.grabbed) return;
        var dx = e.clientX - Finder.grab.mouseX, dy = e.clientY - Finder.grab.mouseY;
        Finder.xpos = (dx/window.innerWidth)*100 + Finder.grab.xpos;
        Finder.container.style.left = Finder.xpos + "%";
        Finder.container.style.right = null;
        Finder.container.style.bottom = null;
        if(Finder.location === 'float'){
            Finder.ypos_abs = (e.clientY/window.innerHeight)*100;
            Finder.container.style.top = Finder.ypos_abs + "%";
        }
        else{
            Finder.ypos_rel = (dy/window.innerHeight)*100 + Finder.grab.ypos_rel;
            Finder.container.style.top = Finder.ypos_rel + "%";
        }
        Finder.checkBounds();
    },
    grabEnd : function(e){
        Options.set("PositionX",Finder.xpos);
        Options.set("PositionY_abs",Finder.ypos_abs);
        Options.set("PositionY_rel",Finder.ypos_rel);
        $.off(d,'mousemove',Finder.grabMove);
        $.off(d,'mouseup',Finder.grabEnd);
        Finder.grabbed = false;
    },
    windowShade : function(){
        if(!Finder.folded){
            Finder.folded = true;
            Finder.container.style.minHeight = "0px";
            Finder.container.style.height = "16px";
            Finder.container.style.overflow = "hidden";
            Finder.shade.innerHTML = '+';
        }
        else{
            Finder.folded = false;
            Finder.container.style.minHeight = null;
            Finder.container.style.height = null;
            Finder.shade.innerHTML = '-';
            Finder.refresh();
        }
        Finder.checkBounds();
    },
    checkSettings : function(){
        if(Finder.location == null && Options.get('Center') != null){
            Finder.fresh = true;
            if(Options.get("Peekaboo"))
                Finder.location = 'slideIn';
            else{
                if(Options.get("Top") === 'true')
                    if(Options.get("Center") === 'true')
                        Finder.location = 'topCenter';
                    else
                        Finder.location = 'topLeft';
                else
                    if(Options.get("Center") == 'true')
                        Finder.location = 'bottomCenter';
                    else
                        Finder.location = 'bottomLeft';
            }
            if(Options.get("adminPassword") != null)
                Options.set("AdminPassword",Options.get("adminPassword"));
            
            localStorage.removeItem("TripfagFinder.Center");
            localStorage.removeItem("TripfagFinder.Top");
            localStorage.removeItem("TripfagFinder.Peekaboo");
            Options.set("Location",Finder.location);
        }
        if(Finder.location === 'float' || Finder.location === 'floatFixed'){
            if(Options.get("PositionX") == null){
                Options.set("PositionX","0.0");
                Options.set("PositionY_abs","0");
                Options.set("PositionY_rel","0.0");
            }
        }
        if(Options.get("Version") !== c.VERSION){
            Finder.fresh = true;
            Options.set("Version",c.VERSION);
        }
    },
    disableRefresh : function(){
        Finder.refreshing = true;
        Finder.refreshButton.setAttribute("disabled","disabled");
        Finder.refreshButton.setAttribute("value","Loading...");
    },
    enableRefresh : function(){
        Finder.refreshing = false;
        Finder.refreshButton.removeAttribute("disabled");
        Finder.refreshButton.setAttribute("value","Refresh");
    },
    err : function(msg){
        if(c.chanX){
            $.dispatchEvent('CreateNotification', {
                    detail: {
                      type: 'error',
                      content: 'Tripfag-Finder: '+msg,
                      lifetime: 5
                    }
              });
        }
        else {
            $.id('tf_error').className = "";
            $.id('tf_error').textContent = msg;
        }
    },
    notifyUpdateSuccess : function(){
         if(c.chanX){
            $.dispatchEvent('CreateNotification', {
                    detail: {
                      type: 'info',
                      content: 'Tripfag-Finder has been updated to version '+c.VERSION+'!',
                      lifetime: 10
                    }
              });
        }
        else {
            $.id('tf_notify').className = "";
            $.id('tf_notify').textContent = 'Tripfag-Finder has been updated to version '+c.VERSION+'!';
        }
    }
};

Options = {
    init: function() {
        var pref;
        for (pref in Options.settings) {
            var stored = Options.get(pref);
            Prefs[pref] = stored == null ? Options.settings[pref][1] : stored == "true";
        }
    },
    makeLink: function() {
        var link = $.el("a",{href:"javascript:void(0);",title:"Show options",id:"tf_optionsLink",textContent:"Finder Options"});
        $.on(link,'click',Options.open);
        $.append($.id("threadFinderContainer"), link);
    },
    settings: {
        "animu": ["Show Animu threads", true],
        "gfur": ["Show Gfur threads", true],
        "sfur": ["Show Sfur threads", true],
        "pony": ["Show Pony threads", true],
        "trap": ["Show Trap threads", true],
        "draw": ["Show Draw threads", true],
        "loli": ["Show Loli threads", true],
        "shota": ["Show Shota threads", true],
        "poke": ["Show Poképorn threads", true],
        "ks": ["Show Katawa Shoujou threads", true],
        "Hover": ["Show OP image preview on hover",true],
        "Counts": ["Show reply/image count in thread list",true],
        "Location": ["Location of the thread finder","topCenter"],
        "AutoSlide": ["Slide the finder in automatically",true],
        "Users":["Show online user count",true],
        "Password": ["Password, just in case",""],
        "AdminPassword": ["Admin password.",""]
    },
    locations : {
        "slideIn"   :   "Slide in from the right",
        "topCenter" :   "Top of page, centered",
        "topLeft"   :   "Top of page, left side",
        "bottomCenter": "Bottom of page, centered",
        "bottomLeft":   "Bottom of page, left side",
        "float":        "Floating, stuck to page (like watcher)",
        "floatFixed":   "Floating, stuck to window (like QR)"
    },
    threadTypes : { 
        "animu":"Animu",
        "draw":"Draw",
        "gfur":"Gfur",
        "pony":"Pony",
        "sfur":"Sfur",
        "trap":"Trap",
        "loli":"Loli",
        "shota":"Shota",
        "poke":"Poké",
        "ks":"KS"
    },
    generalSettings : {
        "Hover": "Show OP image preview on hover",
        "Counts": "Show reply/image count in thread list",
        "AutoSlide": "Slide the finder in automatically",
        "Users": "Show online user count"
    },
    get: function(name) {
        return localStorage.getItem(c.NAMESPACE + name);
    },
    set: function(name, value) {
        localStorage.setItem(c.NAMESPACE + name, value);
    },
    open: function() {
        d.body.style.overflow = 'hidden';
        var overlay = $.el('div',{id:"tf_optionsOverlay"});
        $.append(d.body,overlay);
        $.append(overlay,$.el('div',{className:"reply",id:"tf_optionsWrapper",innerHTML:'<div id="tf_optionsContent"><div id="tf_optionsMain"><h1>' + c.VERSION + '</h1><h2>Tripfag-Finder Options</h2></div></div>'}));
        $.on(overlay, "click", Options.close);
        $.on(overlay.firstElementChild, 'click', function(e) {
            return e.stopPropagation();
        });
        
        $.append($.id('tf_optionsMain'),$.el('fieldset',{innerHTML:'<legend>General Settings</legend>',id:"tf_generalSettings"}));
        var generalSettings = $.id("tf_generalSettings");
        for(var set in Options.generalSettings){
            var label = $.el('label',{innerHTML:"<span style='text-decoration: underline'>"+set + "</span>: "+Options.generalSettings[set]});
            var input = $.el('input',{type:"checkbox",name:set});
            var stored = Options.get(set);
            if(stored == null ? Options.settings[set][1] : stored == "true")
                input.setAttribute("checked","checked");
            $.prepend(label,input);
            $.append(generalSettings, label);
        }
        
        $.append(generalSettings,$.el('br'));
        $.append(generalSettings,$.el('label',{innerHTML:"Location: <select name='Location' id='tf_locationSelect'></select>"}));
        var locationSelect = $.id("tf_locationSelect");
        for(var loc in Options.locations){
            $.append(locationSelect,$.el('option',{value:loc,textContent:Options.locations[loc]}));
        }
        $.q("#tf_locationSelect").value = Options.get("Location");
        
        $.append($.id('tf_optionsMain'),$.el('br'));
        $.append($.id('tf_optionsMain'),$.el('fieldset',{innerHTML:'<legend>Thread Types</legend><strong>Show only:</strong><br>',id:"tf_threadTypes"}));
        var threadTypes = $.id("tf_threadTypes");
        for(var type in Options.threadTypes){
            var label = $.el('label',{innerHTML:"<span style='text-decoration: underline'>"+Options.threadTypes[type]+" threads</span>"});
            var input = $.el('input',{type:"checkbox",name:type});
            var stored = Options.get(type);
            if(stored == null ? Options.settings[type][1] : stored == "true")
                input.setAttribute("checked","checked");
            $.prepend(label,input);
            $.append(threadTypes, label);
        }
        
        $.append($.id('tf_optionsMain'),$.el('br'));
        $.append($.id('tf_optionsMain'),$.el('fieldset',{
            innerHTML:'<legend>Passwords</legend><label><input type="text" name="Password" placeholder="Access Password"> Typically not needed.</label><label><input type="text" name="AdminPassword" placeholder="Admin Password"> For administrative privileges.</label>',
            id:"tf_passwords"
        }));
        $.append($.id('tf_optionsMain'),$.el('br'));
        
        if(Options.get("Password"))
            $.q("#tf_passwords input[name=Password]").value = Options.get("Password");
        if(Options.get("AdminPassword"))
            $.q("#tf_passwords input[name=AdminPassword]").value = Options.get("AdminPassword");
        
        var textInputs = $.qa("input[type=text]",overlay);
        for(var text=0; text < textInputs.length; text++){
            textInputs[text].addEventListener("change",function(e){
                Options.set(e.target.name,e.target.value);
            });
        }
        var checkInputs = $.qa("input[type=checkbox]",overlay);
        for(var check=0; check<checkInputs.length;check++){
            checkInputs[check].addEventListener("change",function(e){
                Options.set(e.target.name,e.target.checked);
            });
        }
        var selects = $.qa("select",overlay);
        for(var select=0; select<selects.length; select++){
            selects[select].addEventListener("change",function(e){
                Options.set(e.target.name,e.target.value);
            });
        }
    },
    close: function() {
        Options.init();
        d.body.style.overflow = "auto";
        $.remove($.q("#tf_optionsOverlay"));
        Admin.linkMade = false;
        Finder.createFinder();
    }
};

Admin = {
  linkMade : false,
  makeLink: function() {
    if(Admin.linkMade) return;
    Admin.linkMade = true;
    var link = $.el("a",{href:"javascript:void(0);",title:"Show admin panel",id:"tf_adminLink",textContent:"  Admin Panel"});
    $.on(link,'click',Admin.open);
    $.append($.id("threadFinderContainer"), $.el("br"));
    $.append($.id("threadFinderContainer"), link);
  },
  open: function() {
        d.body.style.overflow = 'hidden';
        var overlay = $.el('div',{id:"tf_adminOverlay"});
        $.append(d.body,overlay);
        $.append(overlay,$.el('div',{className:"reply",id:"tf_adminWrapper",innerHTML:'<div id="tf_adminContent" style="height:100%"><div id="tf_adminMain" style="height:100%"></div></div>'}));
        $.q("#tf_adminWrapper").style.width = "550px";
        $.on(overlay, "click", Admin.close);
        $.on(overlay.firstElementChild, 'click', function(e) {
            return e.stopPropagation();
        });
        var frame = $.el('iframe',{src:c.adminpage});
        frame.style.height="100%";
        frame.style.width="100%";
        $.append($.id('tf_adminMain'),frame);
    },
    close: function() {
        d.body.style.overflow = "auto";
        $.remove($.q("#tf_adminOverlay"));
    }
};

CSS = {
    init: function(){
        var css = "\
        #tf_optionsOverlay { z-index: 99; box-sizing: border-box; -moz-box-sizing: border-box; position: fixed; display: flex; top: 0; left: 0; width: 100%; height: 100%; padding: 10px; background: rgba(0,0,0,.25); }\
        #tf_optionsWrapper * { margin: 0; padding: 0; }\
        #tf_optionsWrapper { box-sizing: border-box; -moz-box-sizing: border-box; display:block; padding: 12px; width: 450px; max-width: 100%; height: 580px; max-height:100%; z-index: 100; margin:auto; border: 1px solid rgba(0, 0, 0, 0.25); overflow-y: auto; box-shadow: 0px 0px 8px rgba(0,0,0,0.4);}\
        #tf_optionsWrapper label { width: 100%; margin-bottom: 2px; cursor: pointer; display: block; height: 18px; }\
        #tf_optionsWrapper a { text-decoration: none; }\
        #tf_optionsWrapper fieldset { border: 1px solid rgba(0,0,0,0.25); border-radius: 2px; padding: 4px; padding-left: 10px; margin: 0 10px; }\
        #tf_optionsWrapper legend { font-weight: bold; padding:0px 2px; }\
        #tf_optionsWrapper input[type=checkbox] { margin-right: 2px; position: relative; top: 2px; }\
        #tf_optionsWrapper p { margin-bottom: 10px; }\
        #tf_optionsWrapper h1 { font-size: 10pt; margin: 0 !important; color: rgba(0, 0, 0, 0.5); float: right; }\
        #tf_optionsWrapper h2 { font-size: 10pt; margin: 8px 0 6px 0 !important; text-align: left !important; }\
        #tf_optionsMain h2 { margin-top: 0 !important; }\
        #tf_adminOverlay { z-index: 99; box-sizing: border-box; -moz-box-sizing: border-box; position: fixed; display: flex; top: 0; left: 0; width: 100%; height: 100%; padding: 10px; background: rgba(0,0,0,.25); }\
        #tf_adminWrapper * { margin: 0; padding: 0; }\
        #tf_adminWrapper { box-sizing: border-box; -moz-box-sizing: border-box; display:block; padding: 12px; width: 550px; max-width: 100%; height: 580px; max-height:100%; z-index: 100; margin:auto; border: 1px solid rgba(0, 0, 0, 0.25); overflow-y: auto; box-shadow: 0px 0px 8px rgba(0,0,0,0.4);}\
        #threadFinderContainer { min-height:115px; padding-left:4px; width:24em; margin-top:2px; display:block; z-index: 9; }\
        #threadFinderContainer:hover { z-index: 20; }\
        #threadFinderContainer a{ text-decoration: none; }\
        .tf_Counts { font-size:0.8em; }\
        #tf_optionsLink {display: inline-block;} \
        #tf_hover { box-shadow: 0px 0px 5px rgba(0,0,0,0.5); z-index: 100; }\n\
        #tf_open {float: left; height: 100%; display: inline; position: absolute; margin-left: 0px; left: 0px; width: 22px; cursor: pointer;}\
        #tf_bar { display:block; height: 16px; font-size: 14pt; line-height: 14px; color: rgba(0,0,0,0.6); cursor: move; -moz-user-select: none; -webkit-user-select: none; user-select: none;}\
        #tf_error, #tf_notify, .tf_notify { min-height: 0px; box-sizing: border-box; -moz-box-sizing: border-box; margin: 0 6px; padding: 2px 5px; border: 1px solid rgba(0,0,0,0.25); border-radius: 3px; display:block; }\
        #tf_error { border-color: #f22; }\
        .tfHidden { visibility: hidden; }\
        .tf_thread {display: table-row;}\
        .tf_Counts {display: table-cell;}\
        .tf_threadLink {display: table-cell;}\
        .tf_adminDelete {font-weight: bold; margin-left: 4px; text-decoration: none; }\n\
        #tf_shade {font-size:14pt; line-height:18px; position:absolute; right:2px; top:0; }";
        if(Finder.location === 'slideIn' || Finder.location === 'topCenter' || Finder.location === 'bottomCenter')
            css += "#threadFinderContainer { padding:auto; text-align:center; margin-left:auto; margin-right:auto; box-shadow: 0px 0px 6px 1px rgba(0,0,0,0.3) }";
        if(Finder.location === 'slideIn')
            css += " #tf_threadWrapper { margin-left: 3px; } #threadFinderContainer { position: fixed; right: -24em; transition-duration: 0.75s; top: 33%; padding-left:20px; background-repeat:no-repeat; background-position:left center; background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAB6CAYAAAClS5OpAAAAAXNSR0IArs4c6QAAAAZiS0dEAP8A/wD/oL2nkwAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0SU1FB90GCxcuDVbqF5QAAAAdaVRYdENvbW1lbnQAAAAAAENyZWF0ZWQgd2l0aCBHSU1QZC5lBwAAA4xJREFUaN7tms9LVFEUxz/W6BCVSmlq/qiITI1ICIQygggiwyIIclVIPzbtW5t/QLtaFbmphUnRLysqgqKgNiFJv8RqMaZmlvkrxxpmWsx36DHovJn7ZhineReG82bue/f77j3nfO855w64Ld1tsU1/K7AWeG8KsMimvxSoBzypmsGAQCqBMcAPBBMByLHpb49znDbTJXKbrQ4AcoEGoA4oArzAGeA48Bj4HOthO/NbLl8omqOvCjgKXAH6TZW8V4O/Bc5G9T3S87ucONoGydvARFTfS8kyJwChGPd5JQNOAD5KHpA+rLpp1vUnJ1ZUIGspmKd/GrgI/DDlolmgR9dLtCwhYBzoBa4DP7PPk9sNxkkfm+bEQRWHpNx7wJA2nBJ5+SxwC5g0taIj2pMvACMaPKQB+4H92u1emS5RuWQwxrOrnXjyoORhgXn0qQBaLPu2sQ7KRdd5MTy5A/hmqoNJ4I1m6tXmExQ19ADXstOTrS1P9l4rsstJ1JPt9uQ9wFYnM7AD2CT5BHguz00qQK7kM+B3KqLrLxZOSkl0PQJsVgw0BMxYAgE3uv4P9uQ2Vwdpa+2GsZEjHRiDplzJLkD6ATI/fHdpxPWDDABIe/gej8UElEoNKkgeSvYSeVSNqQVOEFWgsotNJ4AavV0n0A08BT4AxRr4DnBT16VAvioxcc1gp2Qn4NNyBBR1d6lvBzAF3Nf3qkSWKD9GIh6JspdJzljSrrgBvkq2KPmOJOLlSs4BhiXrJMcTyXDuql5RAZyco9+ve1DRBOv6x6vkXpmz1zL9MeC1EvFR/daoex+Q4BFA5ifizcBGLVHSE/HdwJZUsmmtZIcyToBzwHmLeXY5AYg40QD/zgkqBHZD37c7Afhj0VXE6VZJRopQJU4AItRbb7muAZZa6hhBJ5m+X5l+tVizWjNotOjnHeEDDCOAUcIls2LCBxJ9QKGoOUC43NaNzRlCdDsFnE7Wfj2XH6zU76GonDlpfhBRWmGqqOIYsCaV4ftDYhS7F3TOnBa6BlgBbAPWKwgIES4t9wEvFHQZA1QSPq+crzg+BVwCvpvuB/s0uE9xz7BeqhRoUnTRBFw2JbsIU14VZQfEsD4FYwDrnLCpL8ZMgxa+MmbTPim5QQNNa4nKgIPAL83En8rwPaZnu4m4o2KIWzeNyw9acf9flCRPzrKSWlqK41kMkPmVX4/JW7lW5Da3LbD2F828vo4bCvUuAAAAAElFTkSuQmCC'); }";
        if(Finder.location === 'float' || Finder.location === 'floatFixed')
            css += " #threadFinderContainer { margin: 0; box-shadow: 0px 0px 4px 1px rgba(0,0,0,0.3); }";
        if(Finder.location === 'float')
            css += "#threadFinderContainer { position: absolute; }";
        if(Finder.location === 'floatFixed')
            css += "#threadFinderContainer { position: fixed; }";
        $.remove($.id("tf_css"));
        $.append(d.body, $.el('style',{textContent: css,id:"tf_css"}));
    }
};
console.log("TF Loaded: "+c.VERSION);
$.on(d, '4chanXInitFinished', function(){c.chanX = true;});
$.on(d, 'DOMContentLoaded',Finder.init);
}).call(this);