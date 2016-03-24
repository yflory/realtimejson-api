require(['common/netflux.js',
        'common/json-ot.js',
        'ChainJSON.js',
        'common/chainpad.js',
        'common/jquery.min.js'], function(Netflux, JsonOT, ChainJSON) {
  var $ = window.$;

    var channel = 'teoiugiuguu8466';
    var options = {
      key: channel
    };
    options.signaling = 'ws://localhost:3001/cryptpad_websocket';
    options.topology = 'StarTopologyService';
    options.protocol = 'WebSocketProtocolService';
    options.connector = 'WebSocketService';
    options.openWebChannel = true;
    var createRealtime = function() {
        return ChainPad.create('User'+Math.floor((Math.random() * 100) + 1),
                              'y',
                              channel,
                              '{}',
                              {
                              transformFunction: JsonOT.validate
                              });
    };
    Netflux.join(channel, options).then(function(wc) {
        // Open a Chainpad session
        realtime = createRealtime();
        wc.onmessage = function(peer, msg) {
          if(msg == "0") { // History is synced
            return;
          }
          // Remove the password from the patch
          var passLen = msg.substring(0,msg.indexOf(':'));
          var message = msg.substring(passLen.length+1 + Number(passLen));
          // Apply the patch in Chainpad
          realtime.message(message);
        }
        // On sending message
        realtime.onMessage(function(message) {
            if(message) {
                wc.send(message).then(function() {});
            }
        });

        realtime.start();

        var hc;
        wc.peers.forEach(function (p) { if (!hc || p.linkQuality > hc.linkQuality) { hc = p; } });
        hc.send(JSON.stringify(['GET_HISTORY', wc.id]));

        var RealtimeJSON = ChainJSON.init(realtime);
        
        var p;
        var $textarea = $('#synced');
        RealtimeJSON.on('ready', function() {
          $('#prop').attr('disabled', false);
          $('#prop2').attr('disabled', false);
          $('#value').attr('disabled', false);
          // Ability to change object values
          $('#send').click(function() {
            var prop = $('#prop').val();
            var prop2 = $('#prop2').val();
            var value = $('#value').val();
            if(prop.trim()) {
              var elem = p[prop];
              if(prop2.trim()) {
                if(!value.trim()) {
                  delete p[prop][prop2];
                }
                else if(parseInt(value).toString() === value) {
                  p[prop][prop2] = parseInt(value);
                }
                else if(parseFloat(value).toString() === value) {
                  p[prop][prop2] = parseFloat(value);
                }
                else {
                try {
                  var subObject = JSON.parse(value);
                    p[prop][prop2] = subObject;
                  }
                  catch(err) {
                    p[prop][prop2] = value;
                  }
                }
              } else {
                if(!value.trim()) {
                  delete p[prop];
                }
                else if(parseInt(value).toString() === value) {
                  p[prop] = parseInt(value);
                }
                else if(parseFloat(value).toString() === value) {
                  p[prop] = parseFloat(value);
                }
                else {
                  try {
                    var subObject = JSON.parse(value);
                    p[prop] = subObject;
                  }
                  catch(err) {
                    p[prop] = value;
                  }
                }
              }
            }
            $textarea.val(JSON.stringify(p));
          });
          // Get the current value of the proxy
          $('#getvalue').click(function(){
            console.log(p);
            alert(JSON.stringify(p));
          });
        });
        
        console.log(realtime);
        
        RealtimeJSON.on('change', function(newVal) {
          $textarea.val(JSON.stringify(p));
          console.log("MAIN HANDLER val : "+newVal);
        });
        
        RealtimeJSON.on('change', 'test.sub', function(newVal) {
          console.log("test.sub val : "+newVal);
        });

        p = RealtimeJSON.getCollaborativeObject();
        
        console.log(p);
    });
});