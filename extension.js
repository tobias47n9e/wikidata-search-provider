/* Wikidata Search Provider for Gnome Shell
 *
 * 2015 Contributors Bahodir Mansurov
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * (at your option) any later version.
 *
 * https://github.com/6ahodir/wikidata-search-provider
 *
 */

const Main = imports.ui.main;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Util = imports.misc.util;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Api = Me.imports.api;

const WikidataSearchProvider = new Lang.Class({
    Name: 'WikidataSearchProvider',

    _init: function() {
        var self = this;
        this.id = 'wikidata-search-provider';
        this.appInfo = {
            get_name : function() {
                return 'Wikidata Search Provider';
            },
            get_icon : function() {
                return Gio.icon_new_for_string(Me.path + "/wikidata_logo.svg");
            },
            get_id : function() {
                return self.id;
            }
        };
        // Custom messages that will be shown as search results
        this._messages = {
            '__loading__': {
                id: '__loading__',
                name: 'Wikidata',
                description : 'Loading items from Wikidata, please wait...',
                // TODO: do these kinds of icon creations better
                createIcon: Lang.bind(this, this.createIcon, {})
            },
            '__error__': {
                id: '__error__',
                name: 'Wikidata',
                description : 'Oops, an error occurred while searching.',
                createIcon: Lang.bind(this, this.createIcon, {})
            }
        };
        // API results will be stored here
        this.resultsMap = new Map();
        this._api = new Api.Api();
    },

    /**
     * Open the url in default app
     * @param {String} identifier
     * @param {Array} terms
     * @param timestamp
     */
    activateResult: function(identifier, terms, timestamp) {
        let result;
        // only do something if the result is not a custom message
        if (!(identifier in this._messages)) {
            result = this.resultsMap.get(identifier);
            // TODO: check that result is not empty
            Util.trySpawnCommandLine(
                "xdg-open " + this._api.protocol + ':' + result.url);
        }
    },

    /**
     * Run callback with results
     * @param {Array} identifiers
     * @param {Function} callback
     */
    getResultMetas: function(identifiers, callback) {
        let metas = [];
        for (let i = 0; i < identifiers.length; i++) {
            metas.push(this._getResultMeta(identifiers[i]));
        }
        callback(metas);
    },

    /**
     * Search API if the query is a Wikidata query.
     * Wikidata query must start with a 'wd' as the first term.
     * @param {Array} terms
     * @param {Function} callback
     * @param {Gio.Cancellable} cancellable
     */
    getInitialResultSet: function(terms, callback, cancellable) {
        // terms holds array of search items
        // the first term must start with a 'w' (=wikidata),
        // otherwise drop the request
        if (terms.length >= 2 && terms[0] === 'wd') {
            // cancell the previous request
            cancellable.cancel();
            // show the loading message
            this.showMessage('__loading__', callback);
            // now search
            this._api.searchEntities(
                terms.slice(1).join(' '),
                Lang.bind(this, this._getResultSet, callback)
            );
        }
    },

    /**
     * Show any message as a search item
     * @param {String} identifier Message identifier
     * @param {Function} callback Callback that pushes the result to search
     * overview
     */
    showMessage: function (identifier, callback) {
        callback([identifier]);
    },

    /**
     * TODO: implement
     * @param {Array} previousResults
     * @param {Array} terms
     * @returns {Array}
     */
    getSubsetResultSearch: function (previousResults, terms) {
        return [];
    },

    /**
     * Return subset of results
     * @param {Array} results
     * @param {number} max
     * @returns {Array}
     */
    filterResults: function(results, max) {
        // override max for now
        max = this._api.limit;
        return results.slice(0, max);
    },

    /**
     * Return meta from result
     * @param {String} identifier
     * @returns {{id: String, name: String, description: String, createIcon: Function}}
     * @private
     */
    _getResultMeta: function(identifier) {
        let result,
            meta;
        // return predefined message if it exists
        if (identifier in this._messages) {
            result = this._messages[identifier];
        } else {
            // TODO: check for messages that don't exist, show generic error message
            meta = this.resultsMap.get(identifier);
            result = {
                id: meta.id,
                name: meta.label,
                description : meta.description,
                createIcon: Lang.bind(this, this.createIcon, meta)
            };
        }
        return result;
    },

    /**
     * Parse results that we get from the API and save them in this.resultsMap.
     * Inform the user if no results are found.
     * @param {null|String} error
     * @param {Object|null} result
     * @param {Function} callback
     * @private
     */
    _getResultSet: function (error, result, callback) {
        let self = this,
            results = [];
        if (result.search && result.search.length > 0) {
            result.search.forEach(function (result) {
                self.resultsMap.set(result.id, result);
                results.push(result.id);
            });
            callback(results);
        } else if (error) {
            // Let the user know that an error has occurred.
            log(error);
            this.showMessage('__error__', callback);
        } else {
            callback(results);
        }
    },

    /**
     * Create meta icon
     * @param size
     * @param {Object} meta
     */
    createIcon: function (size, meta) {
        // TODO: implement meta icon?
    }
});

let wikidataSearchProvider = null;

function init() {
    /** noop */
}

function enable() {
    if (!wikidataSearchProvider) {
        wikidataSearchProvider = new WikidataSearchProvider();
        Main.overview.viewSelector._searchResults._registerProvider(
            wikidataSearchProvider
        );
    }
}

function disable() {
    if (wikidataSearchProvider){
        Main.overview.viewSelector._searchResults._unregisterProvider(
            wikidataSearchProvider
        );
        wikidataSearchProvider = null;
    }
}

