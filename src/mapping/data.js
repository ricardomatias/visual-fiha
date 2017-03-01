'use strict';

var resolve = require('./../resolve');

var State = require('ampersand-state');
var Collection = require('ampersand-collection');

function compileTransformFunction(fn) {
  fn = fn || function(val) { return val; };
  var compiled;

  // proxy the ramda functions
  var ramdaMethods = '';
  var ramda = require('ramda');
  Object.keys(ramda)
    .filter(function(name) {
      return name.length > 1 && typeof ramda[name] === 'function';
    })
    .forEach(function(name) {
      ramdaMethods += '\nvar ' + name + ' = ramda.' + name + ';';
    });

  var str = `compiled = (function() {
  // override some stuff that should not be used
  var navigator, window, global, document, module, exports;

  ${ ramdaMethods }
  return function(val, oldVal) {
    var result;
    try {
      result = (${ fn.toString() })(val, oldVal);
    }
    catch(e) {
      result = e;
    }
    return result;
  };
})();`;
  try {
    eval(str);// jshint ignore:line
  }
  catch (e) {
    compiled = function(val) { return val; };
  }
  return compiled;
}

var MappingEmitter = State.extend({
  idAttribute: 'name',

  props: {
    targets: ['array', true, function() { return []; }],
    transformFunction: 'any',
    source: ['string', false, ''],
    name: ['string', true, null]
  },

  derived: {
    fn: {
      deps: ['transformFunction'],
      fn: function() {
        return compileTransformFunction(this.transformFunction);
      }
    },
    sourceState: {
      deps: ['source'],
      fn: function() {
        if (this.source.indexOf('midi:') === 0) return;
        var sourcePath = this.source.split('.');
        sourcePath.pop();
        sourcePath = sourcePath.join('.');
        return this.collection.resolve(sourcePath);
      }
    },
    sourceProperty: {
      deps: ['source'],
      fn: function() {
        if (this.source.indexOf('midi:') === 0) return;
        var sourcePath = this.source.split('.');
        return sourcePath.pop();
      }
    }
  },
});

var Mappings = Collection.extend({
  model: MappingEmitter,

  initialize: function(models, options) {
    if (!options.context) throw new Error('Missing context option for Mappings');
    var readonly;
    if (typeof options.readonly === 'undefined') {
      readonly = this.readonly = typeof DedicatedWorkerGlobalScope === 'undefined';
    }
    else {
      readonly = this.readonly = options.readonly;
    }

    this.on('reset', function(collection, info) {
      this.unbindMappings(info.previousModels).bindMappings(collection.models);
    });
    this.on('remove', function(model) {
      this.unbindMappings([model]);
    });
    this.on('add', function(model) {
      this.bindMappings([model]);
    });

    this.context = options.context;
  },


  bindMappings: function(mappings) {
    if (this.readonly) return this;

    (mappings || []).forEach(function(mapping) {
      if (!mapping.sourceState) return;
      this.listenTo(mapping.sourceState, 'all', function(evtName, source, value) {
        if (evtName !== 'change:' + mapping.sourceProperty) return;
        this.process([mapping], value);
      });
    }, this);

    return this;
  },

  unbindMappings: function(mappings) {
    if (this.readonly) return this;

    (mappings || []).forEach(function(mapping) {
      if (!mapping.sourceState) return;
      this.stopListening(mapping.sourceState, 'all');
    }, this);

    return this;
  },


  findMappingsBySource: function(path) {
    return this.models.filter(function(mapping) {
      return mapping.source === path;
    });
  },

  findMappingByTarget: function(path) {
    return this.models.find(function(mapping) {
      return mapping.targets.indexOf(path) > -1;
    });
  },

  import: function(data, reset) {
    if (reset) {
      this.reset(data);
    }
    else {
      this.set(data);
    }
    return this;
  },

  export: function() {
    return this.serialize().map(function(item) {
      item.transformFunction = item.transformFunction || item.fn.toString();
      delete item.fn;
      return item;
    });
  },

  resolve: function(path) {
    return resolve(path, this.context);
  },

  process: function(sources, value) {
    sources.forEach(function(info) {
      info.targets.forEach(function(target) {
        var parts = target.split('.');
        var targetProperty = parts.pop();
        var targetStatePath = parts.join('.');
        var state = this.resolve(targetStatePath);
        if (!state) return;

        var finalValue = info.fn(value, state.get(targetProperty));
        if (finalValue instanceof Error) return;
        try {
          state.set(targetProperty, finalValue);
        }
        catch (e) {
          console.info(e.message);
        }
      }, this);
    }, this);

    return this;
  },

  processMIDI: function(deviceName, property, value) {
    var sources = this.findMappingsBySource('midi:' + deviceName + '.' + property);
    if (!sources || !sources.length) return this;
    return this.process(sources, value);
  }
});

module.exports = Mappings;