var webpack = require('webpack');
var StaticSiteGeneratorPlugin = require('static-site-generator-webpack-plugin');
var Config = require('webpack-configurator');

var gatsbyLib = /(gatsby.lib)/i;
var libDirs = /(node_modules|bower_components)/i;
var babelExcludeTest = function(absPath) {
    var result = false;
    if(absPath.match(gatsbyLib)) {
        // There is a match, don't exclude this file.
        result = false
    } else if(absPath.match(libDirs)) {
        // There is a match, do exclude this file.
        result = true
    } else {
        result = false
    }

    return result
}

module.exports = function(program, directory, stage, webpackPort, routes) {
    webpackPort = webpackPort || 1500;
    routes = routes || [];
    function output() {
        switch(stage) {
        case "develop":
            return {
                path: directory,
                filename: 'bundle.js',
                publicPath: `http://${program.host}:${webpackPort}/`
            }
        case "production":
            return {
                filename: "bundle.js",
                path: directory + "/public"
            }
        case "static":
            return {
                path: directory + "/public",
                filename: "bundle.js",
                libraryTarget: 'umd'
            }
        }
    }

    function entry() {
        switch(stage) {
        case "develop":
            return [
                `${__dirname}/../../node_modules/webpack-dev-server/client?${program.host}:${webpackPort}`,
                `${__dirname}/../../node_modules/webpack/hot/only-dev-server`,
                `${__dirname}/web-entry`
            ]
        case "production":
            return [
                `${__dirname}/web-entry`
            ]
        case "static":
            return [
                `${__dirname}/static-entry`
            ]
        }
    }

    function plugins() {
        switch(stage) {
        case "develop":
            return [
                new webpack.HotModuleReplacementPlugin(),
                new webpack.DefinePlugin({
                    "process.env": {
                        NODE_ENV: JSON.stringify(process.env.NODE_ENV ? process.env.NODE_ENV : "development")
                    },
                    __PREFIX_LINKS__: program.prefixLinks
                })
            ]
        case "production":
            return [
                new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/),
                new webpack.DefinePlugin({
                    "process.env": {
                        NODE_ENV: JSON.stringify(process.env.NODE_ENV ? process.env.NODE_ENV : "production")
                    },
                    __PREFIX_LINKS__: program.prefixLinks
                }),
                new webpack.optimize.DedupePlugin(),
                new webpack.optimize.UglifyJsPlugin()
            ]
        case "static":
            return [
                new StaticSiteGeneratorPlugin('bundle.js', routes),
                new webpack.DefinePlugin({
                    "process.env": {
                        NODE_ENV: JSON.stringify(process.env.NODE_ENV ? process.env.NODE_ENV : "production")
                    },
                    __PREFIX_LINKS__: program.prefixLinks
                })
            ]
        }
    }

    function resolve() {
        return {
            extensions: ['', '.js', '.jsx', '.cjsx', '.coffee', '.json', '.less', '.toml', '.yaml'],
            modulesDirectories: [
                directory,
                `${__dirname}/../isomorphic`,
                `${directory}/node_modules`,
                "node_modules"
            ]
        }
    }

    function devtool() {
        switch(stage) {
        case "develop":
        case "static":
            return "eval"
        case "production":
            return "source-map"
        }
    }

    function module(config) {
        switch(stage) {
        case "develop":
            config.loader('css', { test: /\.css$/, loaders: ['style', 'css']});
            config.loader('cjsx', { test: /\.cjsx$/, loaders: ['react-hot', 'coffee', 'cjsx']});
            config.loader('js', {
                        test: /\.jsx?$/,
                        exclude: babelExcludeTest,
                        loaders: ['react-hot', 'babel']
            });
            config.loader('less', { test: /\.less/, loaders: ['style', 'css', 'less']});
            config.loader('coffee', { test: /\.coffee$/, loader: 'coffee' });
            config.loader('md', { test: /\.md$/, loader: 'markdown' });
            config.loader('html', { test: /\.html$/, loader: 'raw' });
            config.loader('json', { test: /\.json$/, loaders: ['json'] });
            // Match everything except config.toml
            config.loader('toml', { test: /^((?!config).)*\.toml$/, loaders: ['toml'] });
            config.loader('png', { test: /\.png$/, loader: 'null' });
            config.loader('jpg', { test: /\.jpg$/, loader: 'null' });
            config.loader('svg', { test: /\.svg$/, loader: 'null' });
            config.loader('ico', { test: /\.ico$/, loader: 'null' });
            config.loader('pdf', { test: /\.pdf$/, loader: 'null' });
            config.loader('txt', { test: /\.txt$/, loader: 'null' });
            config.loader('config', {
                test: /config\.[toml|yaml|json]/,
                loader: 'config',
                query: {
                    directory: directory
                }
            });
            return config;

        case "static":
            return {
                loaders: [
                    { test: /\.css$/, loaders: ['css']},
                    { test: /\.cjsx$/, loaders: ['coffee', 'cjsx']},
                    {
                        test: /\.jsx?$/,
                        exclude: babelExcludeTest,
                        loaders: ['babel']
                    },
                    {
                        test: /\.js?$/,
                        exclude: babelExcludeTest,
                        loaders: ['babel']
                    },
                    { test: /\.less/, loaders: ['css', 'less']},
                    { test: /\.coffee$/, loader: 'coffee' },
                    { test: /\.md$/, loader: 'markdown' },
                    { test: /\.html$/, loader: 'raw' },
                    { test: /\.json$/, loaders: ['json'] },
                    { test: /^((?!config).)*\.toml$/, loaders: ['toml'] }, // Match everything except config.toml
                    { test: /\.png$/, loader: 'null' },
                    { test: /\.jpg$/, loader: 'null' },
                    { test: /\.svg$/, loader: 'null' },
                    { test: /\.ico$/, loader: 'null' },
                    { test: /\.pdf$/, loader: 'null' },
                    { test: /\.txt$/, loader: 'null' },
                    { test: /config\.[toml|yaml|json]/, loader: 'config', query: {
                        directory: directory
                    } }
                ]
            }
        case "production":
            return {
                loaders: [
                    { test: /\.css$/, loaders: ['style', 'css']},
                    { test: /\.cjsx$/, loaders: ['coffee', 'cjsx']},
                    {
                        test: /\.jsx?$/,
                        exclude: babelExcludeTest,
                        loaders: ['babel']
                    },
                    {
                        test: /\.js?$/,
                        exclude: babelExcludeTest,
                        loaders: ['babel']
                    },
                    { test: /\.less/, loaders: ['style', 'css', 'less']},
                    { test: /\.coffee$/, loader: 'coffee' },
                    { test: /\.md$/, loader: 'markdown' },
                    { test: /\.html$/, loader: 'raw' },
                    { test: /\.json$/, loaders: ['json'] },
                    { test: /^((?!config).)*\.toml$/, loaders: ['toml'] }, // Match everything except config.toml
                    { test: /\.png$/, loader: 'null' },
                    { test: /\.jpg$/, loader: 'null' },
                    { test: /\.svg$/, loader: 'null' },
                    { test: /\.ico$/, loader: 'null' },
                    { test: /\.pdf$/, loader: 'null' },
                    { test: /\.txt$/, loader: 'null' },
                    { test: /config\.[toml|yaml|json]/, loader: 'config', query: {
                        directory: directory
                    } }
                ]
            }
        }
    }
    var config = new Config();

    config.merge({
        context: directory + "/pages",
        node: {
            __filename: true
        },
        entry: entry(),
        debug: true,
        devtool: devtool(),
        output: output(),
        resolveLoader: {
            modulesDirectories: [
                `${directory}/node_modules`,
                `${__dirname}/../../node_modules`,
                `${__dirname}/../loaders`
            ]
        },
        plugins: plugins(),
        resolve: resolve()
    });

    return module(config);
}
