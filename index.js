var fs = require('fs');
var merge = require('./lib/merge');
var async = require('async');
var path = require('path');

exports.format = require('./lib/format');
exports.map = require('./lib/map');

function readAllFiles(filename, callback) {
  fs.stat(filename, function (err, stat) {
    if (err) {
      return callback(err);
    }
    if (stat.isFile()) {
      return fs.readFile(filename, function (err, data) {
        if (err) {
          return callback(err);
        }
        callback(null, [data]);
      });
    }

    fs.readdir(filename, function (err, filenames) {
      if (err) {
        return callback(err);
      }
      filenames = filenames.filter(function (fname) { return !(/\..*/.test(fname)); });
      filenames = filenames.map(function (fname) { return path.join(filename, fname); });
      var results = [];
      async.forEach(
        filenames,
        function (filename, callback) {
          readAllFiles(filename, function (err, datas) {
            if (err) {
              return callback(err);
            }
            results = results.concat(datas);
            callback();
          });
        },
        function (err) {
          callback(err, results);
        });
    });
  });
}

exports.run = function (options, callback) {
  callback = callback || function () {};
  var mapper = require('./lib/map/' + options.map);
  var formatter = require('./lib/format/' + options.f);

  var files = options._;
  if (files.length === 0) {
    var buffers = [];
    process.stdin.on('data', buffers.push.bind(buffers));
    process.stdin.on('error', function (err) {
      console.error(err);
      process.exit(1);
    });
    process.stdin.on('end', function () {
      var data = buffers.join('');
      var mappedOutput = mapper.map(data);
      formatter.report(mappedOutput, options.write);
      callback();
    });
    process.stdin.resume();
  } else {
    var results = [];
    async.forEachSeries(
      files,
      function (filename, callback) {
        readAllFiles(filename, function (err, fileData) {
          if (err) {
            return callback(err);
          }
          results = results.concat(fileData);
          callback();
        });
      },
      function (err) {
        if (err) {
          console.error(err);
          return process.exit(1);
        }
        results = results.map(function (buffer) {return mapper.map(buffer.toString()); });
        var data = merge(results);
        formatter.report(data, options.write);
        callback();
      });
  }
};
