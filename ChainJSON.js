define(function() {

  // Make the necessary operations (insert/remove) in Chainpad to sync the latest changes
  var applyChange = function(rt, oldval, newval) {
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
        if (rt.localChange) { rt.localChange(true); }
        rt.remove(commonStart, oldval.length - commonStart - commonEnd);
    }
    if (newval.length !== commonStart + commonEnd) {
        if (rt.localChange) { rt.localChange(true); }
        rt.insert(commonStart, newval.slice(commonStart, newval.length - commonEnd));
    }
  };

  // Trigger the handlers when an object has changed
  var onChange = function(ctx, keypath, value) {
    if(Object.keys(ctx.changeHandlers).indexOf(keypath) !== -1) {
      ctx.changeHandlers[keypath](value);
      return;
    }
    if(typeof ctx.mainHandler === "function") {
      ctx.mainHandler(value);
    }
  };

  // Make the changes in Chainpad when a property is deleted/added/modified
  var proxyDelete = function(ctx) {
      return function(target, prop) {
          delete target[prop];
          if(ctx.patching) { return true; }
          if(JSON.stringify(ctx.p) === ctx.realtime.getUserDoc()) { return true; }
          var newValue = JSON.stringify(ctx.p);
          applyChange(ctx.realtime, ctx.stringJSON, newValue);
          onMessage(ctx);
        return true;
      }
  };
  var proxySet = function(ctx) {
      return function(target, prop, value, receiver) {
          target[prop] = (typeof value === "object") ? new Proxy(value, {
            set: proxySet(ctx),
            deleteProperty: proxyDelete(ctx)
          }) : value;
          if(ctx.patching) { return true; }
          if(JSON.stringify(ctx.p) === ctx.realtime.getUserDoc()) { return true; }
          var newValue = JSON.stringify(ctx.p);
          applyChange(ctx.realtime, ctx.stringJSON, newValue);
          onMessage(ctx);
          return true;
      }
  };
  // Create the proxy which represents the collaborative object
  var getCollaborativeObject = function(ctx) {
    ctx.p = new Proxy({}, {
        set: proxySet(ctx),
        deleteProperty: proxyDelete(ctx)
    });
    return ctx.p;
  }

  // Apply the latest remote changes from Chainpad to our proxy
  var copyObject = function(ctx, toObject, fromObject, path) {
    for (var attrname in fromObject) {
      var keypath = (path === '') ? attrname : path+'.'+attrname;
      if(toObject[attrname] != fromObject[attrname]) {
        if(typeof fromObject[attrname] !== "object" || JSON.stringify(fromObject[attrname]) === "[]" || JSON.stringify(fromObject[attrname]) === "{}") {
          toObject[attrname] = fromObject[attrname];
          onChange(ctx, keypath, fromObject[attrname]);
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
          copyObject(ctx, toObject[attrname], fromObject[attrname], keypath);
        }
      }
    }
    for (var attrname in toObject) {
      if(typeof fromObject[attrname] === "undefined") {
        delete toObject[attrname];
        onChange(ctx, keypath, fromObject[attrname]);
      }
    }

  };

  var onJoining = () => {};
  var onLeaving = () => {};
  var onMessage = (ctx) => {
    // Get the new state of the object from Chainpad
    var obj = JSON.parse(ctx.realtime.getUserDoc());
    ctx.stringJSON = JSON.stringify(obj);
    // Update the proxy with the modified property from the patch
    ctx.patching = true;
    copyObject(ctx, ctx.p, obj, '');
    ctx.patching = false;
  };
  var onPeerMessage = () => {};

  var create = function(rt) {
      var ctx = {
        realtime: rt,
        ready: false,
        patching: false,
        p: null,
        stringJSON: '',
        mainHandler: null,
        changeHandlers: {},
        onReady: function(){}
      }
      ctx.realtime.onPatch(function() {
          lastPatch = new Date();
          onMessage(ctx);
      });

      // Update our object with the current value stored in Chainpad
      onMessage(ctx);

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
            stringJSON = ctx.realtime.getUserDoc();
            ctx.ready = true;
            ctx.onReady(ctx);
          }
        },200);
      };
      checkReady();
      
      return {
        getCollaborativeObject: function() {
          return getCollaborativeObject(ctx);
        },
        on: function(event, arg2, handler) {
          if(event === 'ready') {
            ctx.onReady = arg2;
            if(ctx.ready) {
              ctx.onReady(ctx);
            }
          }
          else if(event === 'change') {
            if(typeof handler !== "function") {
              ctx.mainHandler = arg2;
            }
            else {
              ctx.changeHandlers[arg2] = handler;
            }
          }
        }
      }
  };

  return {
    create : create
  };
});