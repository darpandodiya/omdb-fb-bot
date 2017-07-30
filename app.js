var express = require("express");
var request = require("request");
var bodyParser = require("body-parser");

var app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.listen((process.env.PORT || 5000));

/*** Index Page ***/

//Index page
app.get("/", function (req, res) {
    res.send("OMDb chatbot is up and running.");
});


/*** Facebook Messenger Handling ***/

//Facebook webhook used for verification
app.get("/webhook", function (req, res) {
    if (req.query["hub.verify_token"] === process.env.VERIFICATION_TOKEN) {
        console.log("Webhook verified");
        res.status(200).send(req.query["hub.challenge"]);
    }
    else {
        console.log("Verification failed. The tokens do not match");
        res.sendStatus(403);
    }
});

// All callbacks for Messenger will be POST-ed here
app.post("/webhook", function (req, res) {
    // Make sure this is a page subscription
    if (req.body.object == "page") {
        // Iterate over each entry
        // There may be multiple entries if batched
        req.body.entry.forEach(function (entry) {
            // Iterate over each messaging event

            if(entry.messaging != undefined) {
                entry.messaging.forEach(function (event) {
                    if (event.postback) {
                        processPostback(event);
                    }
                    else if (event.message) {
                        processMessage(event);
                    }
                });
            }
        });

        res.sendStatus(200);
    }
});

function processPostback(event) {
    var senderId = event.sender.id;
    var payload = event.postback.payload;

    if (payload === "Greeting") {
        // Get user's first name from the User Profile API
        // and include it in the greeting
        request({
            url: "https://graph.facebook.com/v2.6/" + senderId,
            qs: {
                access_token: process.env.PAGE_ACCESS_TOKEN,
                fields: "first_name"
            },
            method: "GET"
        }, function (error, response, body) {
            var greeting = "";
            if (error) {
                console.log("Error getting user's name: " + error);
            } else {
                var bodyObj = JSON.parse(body);
                name = bodyObj.first_name;
                greeting = "Hi " + name + ". ";
            }
            var message = greeting + "My name is OMDb Movie Bot. I can tell you various details regarding movies. What movie would you like to know about?";
            sendMessage(senderId, { text: message });
        });
    } else if (payload === "Correct") {
        sendMessage(senderId, { text: "Awesome! What would you like to find out? Enter 'plot', 'genre', 'date', 'runtime', 'director', 'cast' or 'rating' for the various details. \n \nBetter, type back 'everything' and I will get you everything about this movie." });
    } else if (payload === "Incorrect") {
        sendMessage(senderId, { text: "Oops! Sorry about that. Try using the exact title of the movie." });
    }
}

function processMessage(event) {
    if (!event.message.is_echo) {
        var message = event.message;
        var senderId = event.sender.id;

        console.log("Received message from senderId: " + senderId);
        console.log("Message is: " + JSON.stringify(message));

        // You may get a text or attachment but not both
        if (message.text) {
            var formattedMsg = message.text.toLowerCase().trim();

            // If we receive a text message, check to see if it matches any special
            // keywords and send back the corresponding movie detail.
            // Otherwise, search for new movie.
            switch (formattedMsg) {
                case "plot":
                case "date":
                case "runtime":
                case "director":
                case "cast":
                case "rating":
                    getMovieDetail(senderId, formattedMsg);
                    break;

                case "everything":
                    getEntireMovieDetail(senderId);
                    break;

                default:
                    checkOwnName(senderId, formattedMsg);
                    
            }
        } else if (message.attachments) {
            sendMessage(senderId, { text: "Sorry, I don't understand your request. You can ask me about movies." });
        }
    }
}

function checkOwnName(senderId, message) {
    
    if(message.indexOf("darpan") !== -1 || message.indexOf("creat") !== -1 
        || message.indexOf("develop") !== -1 || message.indexOf("author") !== -1 ) {
        sendMessage(senderId, { text: "Hey there, Darpan here. I noticed that you've mentioned my name. In case if you're wondering, yes I have programmed this bot. You can know more about me at www.darpandodiya.com"});
    }
    else if(message.indexOf("who") !== -1) {
        sendMessage(senderId, { text: "I'm just a bot. :) I run on commands of a guy named Darpan. Type Darpan to know more."});
    }
    else if(message.indexOf("source") !== -1 || message.indexOf("code") !== -1 ) {
        sendMessage(senderId, { text: "Yep, I'm open source. Find me on GitHub at: https://github.com/darpandodiya/omdb-fb-bot"});
    }
    else {
        findMovie(senderId, message);
    }
}

//Sends message to user
function sendMessage(recipientId, message) {
    request({
        url: "https://graph.facebook.com/v2.6/me/messages",
        qs: { access_token: process.env.PAGE_ACCESS_TOKEN },
        method: "POST",
        json: {
            recipient: { id: recipientId },
            message: message,
        }
    }, function (error, response, body) {
        if (error) {
            console.log("Error sending message: " + response.error);
        }
    });
}


/*** MongoDB & OMDb Handling ***/
var mongoose = require("mongoose");

var db = mongoose.connect(process.env.MONGODB_URI);
var Movie = require("./models/movie");

function getMovieDetail(userId, field) {
    Movie.findOne({ user_id: userId }, function (err, movie) {
        if (err) {
            sendMessage(userId, { text: "Something went wrong. Try again" });
        } else {
            sendMessage(userId, { text: movie[field] });
        }
    });
}

function getEntireMovieDetail(userId) {
    Movie.findOne({ user_id: userId }, function (err, movie) {
        if (err) {
            sendMessage(userId, { text: "Something went wrong. Try again" });
        } else {
            sendMessage(userId, { text: movie["title"] 
                                });
        }
    });
}

function findMovie(userId, movieTitle) {
    console.log("In findMovie. userId: " + userId + " movieTitle: " + movieTitle);
    var requestUrl = "http://www.omdbapi.com/?t=" + movieTitle + "&apikey=7e0bbc93";
    console.log(requestUrl);

    request(requestUrl, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            var movieObj = JSON.parse(body);
            if (movieObj.Response === "True") {
                var query = { user_id: userId };
                var update = {
                    user_id: userId,
                    title: movieObj.Title,
                    year: movieObj.Year,
                    release_date: movieObj.Released,
                    runtime: movieObj.Runtime,
                    genre: movieObj.Genre,
                    director: movieObj.Director,
                    cast: movieObj.Actors,
                    plot: movieObj.Plot,
                    language: movieObj.Language,
                    country: movieObj.Country,
                    awards: movieObj.Awards,
                    poster_url: movieObj.Poster,
                    metascore: movieObj.Metascore,
                    imdb_rating: movieObj.imdbRating,
                    imdb_id: movieObj.imdbID,
                    box_office: movieObj.BoxOffice,
                    production: movieObj.Production,
                    website_url: movieObj.Website, 
                };
                var options = { upsert: true };
                Movie.findOneAndUpdate(query, update, options, function (err, mov) {
                    if (err) {
                        console.log("Database error: " + err);
                    } else {
                        message = {
                            attachment: {
                                type: "template",
                                payload: {
                                    template_type: "generic",
                                    elements: [{
                                        title: movieObj.Title + " " + movieObj.Year,
                                        subtitle: "Is this the movie you are looking for?",
                                        image_url: movieObj.Poster === "N/A" ? "http://placehold.it/350x150" : movieObj.Poster,
                                        buttons: [{
                                            type: "postback",
                                            title: "Yes",
                                            payload: "Correct"
                                        }, {
                                            type: "postback",
                                            title: "No",
                                            payload: "Incorrect"
                                        }]
                                    }]
                                }
                            }
                        };
                        sendMessage(userId, message);
                    }
                });
            } else {
                console.log(movieObj.Error);
                sendMessage(userId, { text: movieObj.Error });
            }
        } else {
            sendMessage(userId, { text: "Something went wrong with OMDb API. Please try again." });
        }
    });
}
