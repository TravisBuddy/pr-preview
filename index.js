"use strict";
var t0 = Date.now();
if (process.env.NODE_ENV === "dev") {
    // Load local env variables
    require("./env");
}

const express = require("express"),
    bodyParser = require('body-parser'),
    xhub = require('express-x-hub'),
    Controller = require("./lib/controller");

function logArgs() {
    var args = arguments;
    process.nextTick(function() {
        console.log.apply(console, args);
    });
}

function logResult(r, action) {
    var err = r.error;
    if (err && err.noConfig) {
        logArgs(`${r.id}: ${ action } (no config)`);
    } else if (err) {
        logArgs(`${r.id}: ${ action } (${err.name}: ${err.message})`);
        if (err.data) { logArgs(err.data) };
    } else {
        logArgs(`${r.id}: ${ action }`);
        logArgs(r);
    }
}

const controller = new Controller();

const STARTUP_QUEUE = process.env.STARTUP_QUEUE;
if (STARTUP_QUEUE) {
    try {
        let queue = JSON.parse(STARTUP_QUEUE);
        if (queue && queue.length && typeof queue[0].id == "string") {
            logArgs(`Processing queue : ${ STARTUP_QUEUE }`);
        
            Promise.all(queue.map(r => {
                return controller.handlePullRequest(r).then(r => logResult(r, "startup-queue"), logArgs);
            })).then(_ => logArgs("Startup queue processed"));
        } else {
            throw new Error();
        }
    } catch (e) {
        logArgs(`Malformed queue ${STARTUP_QUEUE}`);
    }
    
} else {
    logArgs("No startup queue present");
}

var app = express();
app.use(xhub({ algorithm: 'sha1', secret: process.env.GITHUB_SECRET }));

app.post('/github-hook', function (req, res, next) {
    if (process.env.NODE_ENV != 'production' || req.isXHubValid()) {
        res.send(new Date().toISOString());
        var payload = req.body;
        if (payload.pull_request) {
            if (payload.pull_request.base.repo.full_name == "w3c/web-platform-tests") {
                logArgs("skipping web-platform-tests");
            } if (payload.sender && payload.sender.login == "pr-preview[bot]") {
                logArgs("skipping auto-generated changes");
            } else {
                let action = payload.action
                switch(action) {
                    case "opened":
                    case "edited":
                    case "reopened":
                    case "synchronize":
                        controller.queuePullRequest(payload).then(r => logResult(r, action), logArgs);
                }
            }
        } else {
            logArgs("Unknown request", JSON.stringify(payload, null, 4));
        }
    } else {
        logArgs("Unverified request", req);
    }
    next();
});

app.post('/config', bodyParser.urlencoded({ extended: false }), function (req, res, next) {
    let params = req.body;
    controller[params.validate ? "getUrl" : "pullRequestUrl"](req.body)
        .then(
            url => res.redirect(url),
            err => {
                res.status(400).send({ error: err.message });
                logArgs(`${err.name}: ${err.message}\n${err.stack}`);
            }
        ).then(_ => next(), _ => next());
});

var port = process.env.PORT || 5000;
app.listen(port, function() {
    console.log("Express server listening on port %d in %s mode", port, app.settings.env);
    console.log("App started in", (Date.now() - t0) + "ms.");
});
