var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var MovieSchema = new Schema({
  user_id: {type: String},
  title: {type: String},
  year: {type: String},
  release_date: {type: String},
  runtime: {type: String},
  genre: {type: String},
  director: {type: String},
  cast: {type: String},
  plot: {type: String},
  language: {type: String},
  country: {type: String},
  awards: {type: String},
  poster_url: {type: String},
  metascore: {type: String},
  imdb_rating: {type: String},
  imdb_id: {type: String},
  box_office: {type: String},
  production: {type: String}, 
  website_url: {type: String},
});

module.exports = mongoose.model("Movie", MovieSchema);