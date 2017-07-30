var express = require("express");
var request = require("request");
var bodyParser = require("body-parser");

var app = express();
app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.json());
app.listen((process.env.PORT || 5000));

//Index page
app.get("/", function(req, res) {
    res.send("OMDb chatbot is up and running.");
});

//Facebook webhook used for verification
app.get("/webhook", function (req, res) {
    if(req.query["hub.verify_token"] === "this_is_my_token") {
        console.log("Webhook verified");
        res.status(200).send(req.query["hub.challenge"]);
    }
    else {
        console.log("Verification failed. The tokens do not match");
        res.sendStatus(403);
    }
});
