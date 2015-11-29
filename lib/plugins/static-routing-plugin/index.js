var evaluate = require('eval');
var path = require('path');
var Promise = require('bluebird');

function StaticSiteGeneratorWebpackPlugin(renderSrc, outputPaths, locals) {
  this.renderSrc = renderSrc;
  this.outputPaths = Array.isArray(outputPaths) ? outputPaths : [outputPaths];
  this.locals = locals;
  console.log('routes', outputPaths);
}

StaticSiteGeneratorWebpackPlugin.prototype.apply = function(compiler) {
    var self = this;
    var routes = [];

    compiler.plugin('compilation', (compilation, params) => {

      compilation.plugin('succeed-module', function(module) {

       // if the module was requested. Not actually sure if this is nullable
        if (module.request) {
          var req = module.request.split(process.cwd());

          // sometimes loaders mean this splits into 3. idk what scenarios that happens in yet.
          if (req.length > 2) {
            console.log(req)
          } else if (req[1]) {

            var maybePage = req[1].slice(0, 6);
            // we only care if it's in the pages dir. because pages are special
            if (maybePage === '/pages') {
              var filepath = req[1];
              var filepathAsArray = filepath.split('/');
              // we don't process _template files
              var firstCharOfFilenameIs_ = /^_/.test(filepathAsArray[filepathAsArray.length])
              if (/.md$/.test(filepath) && !firstCharOfFilenameIs_) {
                /**
                 * We expect the source to translate into an object that looks like this:
                {
                  "title":"A Foray Into Haxl: PostgreSQL Simple",
                  "date":"Fri, 04 Jul 2014 19:22:59 +0000",
                  "layout":"post",
                  "path":"/2014/7/4/a-foray-into-haxl-postgresql-simple/",
                  "body":"<p></p>"
                }
                */
                var src = module._source.source();
                var content = evaluate(src, "succeed-module-fake-filename", undefined, false);
                if (content && content.path) {
                  routes.push(content.path);
                  console.log(content.path);
                } else {
                  //figure out all the other shit here
                }
              }
            }
          }
        }
      });

    })

  compiler.plugin('emit', function(compiler, done) {
    var renderPromises;

    var webpackStats = compiler.getStats();
    var webpackStatsJson = webpackStats.toJson();

    try {
      var asset = findAsset(self.renderSrc, compiler, webpackStatsJson);

      if (asset == null) {
        throw new Error('Source file not found: "' + self.renderSrc + '"');
      }

      var assets = getAssetsFromCompiler(compiler, webpackStatsJson);
      console.log('assets', assets)
      var source = asset.source();
      var render = evaluate(source, /* filename: */ self.renderSrc, /* scope: */ undefined, /* includeGlobals: */ true);

      renderPromises = self.outputPaths.map(function(outputPath) {
        console.log('outputPath', outputPath);
        var outputFileName = path.join(outputPath, '/index.html')
          .replace(/^(\/|\\)/, ''); // Remove leading slashes for webpack-dev-server

        var locals = {
          path: outputPath,
          assets: assets,
          webpackStats: webpackStats
        };

        for (var prop in self.locals) {
          if (self.locals.hasOwnProperty(prop)) {
            locals[prop] = self.locals[prop];
          }
        }

        return Promise
          .fromNode(render.bind(null, locals))
          .then(function(output) {
            compiler.assets[outputFileName] = createAssetFromContents(output);
          })
          .catch(function(err) {
            compiler.errors.push(err.stack);
          });
      });

      Promise.all(renderPromises).nodeify(done);
    } catch (err) {
      compiler.errors.push(err.stack);
      done();
    }
  });
};

var findAsset = function(src, compiler, webpackStatsJson) {
  var asset = compiler.assets[src];

  if (asset) {
    return asset;
  }

  var chunkValue = webpackStatsJson.assetsByChunkName[src];

  if (!chunkValue) {
    return null;
  }
  // Webpack outputs an array for each chunk when using sourcemaps
  if (chunkValue instanceof Array) {
    // Is the main bundle always the first element?
    chunkValue = chunkValue[0];
  }
  return compiler.assets[chunkValue];
};

// Shamelessly stolen from html-webpack-plugin - Thanks @ampedandwired :)
var getAssetsFromCompiler = function(compiler, webpackStatsJson) {
  var assets = {};
  for (var chunk in webpackStatsJson.assetsByChunkName) {
    var chunkValue = webpackStatsJson.assetsByChunkName[chunk];

    // Webpack outputs an array for each chunk when using sourcemaps
    if (chunkValue instanceof Array) {
      // Is the main bundle always the first element?
      chunkValue = chunkValue[0];
    }

    if (compiler.options.output.publicPath) {
      chunkValue = compiler.options.output.publicPath + chunkValue;
    }
    assets[chunk] = chunkValue;
  }

  return assets;
};

var createAssetFromContents = function(contents) {
  return {
    source: function() {
      return contents;
    },
    size: function() {
      return contents.length;
    }
  };
};

module.exports = StaticSiteGeneratorWebpackPlugin;
