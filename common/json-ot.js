define(function () {
    var ChainPad = window.ChainPad;
    var JsonOT = {};

    var validate = JsonOT.validate = function (text, toTransform, transformBy) {
        var resultOp = ChainPad.Operation.transform0(text, toTransform, transformBy);
        var text2 = ChainPad.Operation.apply(transformBy, text);
        var text3 = ChainPad.Operation.apply(resultOp, text2);
        try {
            JSON.parse(text3);
            return resultOp;
        } catch (e) {
            console.log(e);
        }

        // returning **null** breaks out of the loop
        // which transforms conflicting operations
        // in theory this should prevent us from producing bad JSON
        return null;
    };

    return JsonOT;
});
