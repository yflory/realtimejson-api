define(function() {
  var realtime;
  var ready = false;
  var patching = false;
  var p;
  var stringJSON;

  var applyChange = function(ctx, oldval, newval) {
    if (oldval === newval) {
        return;
    }

    var commonStart = 0;
    while (oldval.charAt(commonStart) === newval.charAt(commonStart)) {
        commonStart++;
    }

    var commonEnd = 0;
    while (oldval.charAt(oldval.length - 1 - commonEnd) === newval.charAt(newval.length - 1 - commonEnd) &&
        commonEnd + commonStart < oldval.length && commonEnd + commonStart < newval.length) {
        commonEnd++;
    }

    var bugz = {
        commonStart:commonStart,
        commonEnd:commonEnd,
        oldvalLength: oldval.length,
        newvalLength: newval.length
    };
    if (oldval.length !== commonStart + commonEnd) {
        if (ctx.localChange) { ctx.localChange(true); }
        ctx.remove(commonStart, oldval.length - commonStart - commonEnd);
    }
    if (newval.length !== commonStart + commonEnd) {
        if (ctx.localChange) { ctx.localChange(true); }
        ctx.insert(commonStart, newval.slice(commonStart, newval.length - commonEnd));
    }
  };

  var onReady = function() {};

  var changeHandlers = {};
  var mainHandler;

  var onChange = function(keypath, value) {
    console.log('onchange');
    if(Object.keys(changeHandlers).indexOf(keypath) !== -1) {
      changeHandlers[keypath](value);
      return;
    }
    if(typeof mainHandler === "function") {
      mainHandler(value);
    }
  };

  var proxyDelete = function(target, prop) {
      delete target[prop];
      if(patching) { return true; }
      if(JSON.stringify(p) === realtime.getUserDoc()) { return true; }
      var newValue = JSON.stringify(p);
      applyChange(realtime, stringJSON, newValue);
      onMessage();
      return true;
  };
  var proxySet = function(target, prop, value, receiver) {
      target[prop] = (typeof value === "object") ? new Proxy(value, {
        set: proxySet,
        deleteProperty: proxyDelete
      }) : value;
      if(patching) { return true; }
      if(JSON.stringify(p) === realtime.getUserDoc()) { return true; }
      var newValue = JSON.stringify(p);
      applyChange(realtime, stringJSON, newValue);
      onMessage();
      return true;
  };
  var getCollaborativeObject = function() {
    p = new Proxy({}, {
        set: proxySet,
        deleteProperty: proxyDelete
    });
    return p;
  }

  var copyObject = function(toObject, fromObject, path) {
    for (var attrname in fromObject) {
      var keypath = (path === '') ? attrname : path+'.'+attrname;
      if(toObject[attrname] != fromObject[attrname]) {
        if(typeof fromObject[attrname] !== "object" || JSON.stringify(fromObject[attrname]) === "[]" || JSON.stringify(fromObject[attrname]) === "{}") {
          toObject[attrname] = fromObject[attrname];
          onChange(keypath, fromObject[attrname]);
        }
        else if(JSON.stringify(toObject[attrname]) !== JSON.stringify(fromObject[attrname])){
          if(typeof toObject[attrname] === "undefined") {
            if(fromObject[attrname] instanceof Array) {
              toObject[attrname] = [];
            }
            else {
              toObject[attrname] = {};
            }
          }
          copyObject(toObject[attrname], fromObject[attrname], keypath);
        }
      }
    }
    for (var attrname in toObject) {
      if(typeof fromObject[attrname] === "undefined") {
        delete toObject[attrname];
        onChange(keypath, fromObject[attrname]);
      }
    }

  };

  var onJoining = () => {};
  var onLeaving = () => {};
  var onMessage = () => {
    // Get the new state of the object from Chainpad
    var obj = JSON.parse(realtime.getUserDoc());
    stringJSON = JSON.stringify(obj);
    // Update the proxy with the modified property from the patch
    patching = true;
    copyObject(p, obj, '');
    patching = false;
  };
  var onPeerMessage = () => {};

  var init = function(rt) {
      realtime = rt;
      realtime.onPatch(function() {
          lastPatch = new Date();
          onMessage();
      });
      realtime.start();
      realtime.getHistory();
      
      // Check if the history is synced
      // TODO : implement this in Chainpad
      var lastPatch = new Date();
      var checkReady = function() {
        window.setTimeout(function() {
          var d = new Date();
          if(d-lastPatch < 200) {
            checkReady();
          }
          else {
            stringJSON = realtime.getUserDoc();
            ready = true;
            onReady();
          }
        },200);
      };
      checkReady();
      
      
      
      return {
        getCollaborativeObject: getCollaborativeObject,
        on: function(event, arg2, handler) {
          if(event === 'ready') {
            onReady = arg2;
            if(ready) {
              onReady();
            }
          }
          else if(event === 'change') {
            if(typeof handler !== "function") {
              mainHandler = arg2;
            }
            else {
              changeHandlers[arg2] = handler;
            }
          }
        }
      }
  };

  return {
    init : init
  };
});