webpackJsonp([3,5],{

/***/ 142:
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var resolve = __webpack_require__(654);
var assign = __webpack_require__(33);
var State = __webpack_require__(27);
var Collection = __webpack_require__(34);

function cleanFnFromExport(item) {
  item.transformFunction = item.transformFunction || item.fn.toString();
  delete item.fn;
  return item;
}

function compileTransformFunction(fn) {
  fn = fn || function(val) { return val; };
  var compiled;

  // proxy the ramda functions
  var ramdaMethods = '';
  var ramda = __webpack_require__(36);
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

  serialize: function() {
    return Collection.prototype
            .serialize.apply(this, arguments)
            .map(cleanFnFromExport);
  },

  toJSON: function () {
    return this.map(function (model) {
      if (model.toJSON) {
        return model.toJSON();
      }
      else {
        var out = {};
        assign(out, model);
        delete out.collection;
        return out;
      }
    })
    .map(cleanFnFromExport);
  },

  export: function() {
    return this.serialize();
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
        var state;
        try {
          state = this.resolve(targetStatePath);
        } catch(e) {}
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

/***/ }),

/***/ 143:
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var assign = __webpack_require__(33);

function Settings(name, defaults) {
  this.name = name;
  var loaded = {};
  try {
    loaded = JSON.parse(localStorage.getItem(name) || '{}');
  }
  catch (e) {
    console.warn('settings loading error', e);
  }
  this._vars = assign({}, defaults, loaded);
}

Settings.prototype._vars = {};

Settings.prototype.set = function(name, value) {
  this._vars[name] = value;
  try {
    localStorage.setItem(this.name, JSON.stringify(this._vars));
  }
  catch (e) {
    console.warn('error while trying to store %s', name, e);
  }
  return value;
};

Settings.prototype.get = function(name, defaultValue) {
  return this._vars[name] === undefined ? defaultValue : this._vars[name];
};

module.exports = Settings;

/***/ }),

/***/ 144:
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var State = __webpack_require__(27);
var Collection = __webpack_require__(34);

var midiMappings = {
  'KORG INC.': {
    'KP3 MIDI 1': __webpack_require__(692),
    'nanoKONTROL2 MIDI 1': __webpack_require__(693)
  },
  'AKAI professional LLC': {
    'LPD8 MIDI 1': __webpack_require__(691)
  },
  'Focusrite A.E. Ltd': {
    'Launchpad Mini MIDI 1': __webpack_require__(694)
  }
};


var MIDIState = State.extend({
  props: {
    manufacturer: 'string',
    name: 'string'
  },

  session: {
    active: ['boolean', true, true],
    connection: 'string',
    state: 'string',
    type: 'string',
    id: 'string',
    version: 'string'
  }
});



function getMappings(manufacturer, name) {
  var m = midiMappings || {};
  if (!m[manufacturer] || !m[manufacturer][name]) {
    return;
  }
  return m[manufacturer][name] || function(){};
}


function handleMIDIMessage(accessState, model) {
  // var setThrottled = throttle(function(name, velocity) {
  //   model.set(name, velocity);
  // }, 1000 / 16);
  var _mappings = getMappings(model.manufacturer, model.name);

  return function(MIDIMessageEvent) {
    if (!model.active) { return; }
    var info = _mappings(MIDIMessageEvent.data);
    // if (info.name) setThrottled(info.name, info.velocity);
    if (model.collection.parent && info.name) model.collection.parent.trigger('midi:change', model.id, info.name, info.velocity);
  };
}


var MIDIAccessState = State.extend({
  mappable: {
    source: ['inputs'],
    target: []
  },

  registerInput: function(info) {
    var accessState = this;
    var _mappings = getMappings(info.manufacturer, info.name);
    if (!_mappings) {
      if (info.name !== 'Midi Through Port-0') {
        // console..warn('Unrecognized MIDI controller %s from %s', info.name, info.manufacturer);
      }
      return;
    }

    var props = {};
    var sources = [];

    Object.keys(_mappings.note || {}).forEach(function(key) {
      sources.push(_mappings.note[key]);
      props[_mappings.note[key]] = ['number', true, 0];
    });

    var Constructor = MIDIState.extend({
      mappable: {
        source: sources,
        target: []
      },
      props: props
    });

    var model = new Constructor({
      connection: info.connection,
      state: info.state,
      type: info.type,
      id: _mappings.prefix,//info.id,
      manufacturer: info.manufacturer,
      name: info.name,
      version: info.version
    });

    if (typeof info.onmidimessage !== 'undefined') {
      info.onmidimessage = handleMIDIMessage(this, model);
    }

    model.on('all', function(evtName, name, velocity) {
      if (evtName.slice(0, 5) === 'midi:') accessState.trigger(name, velocity);
    });

    accessState.inputs.add(model);
  },

  initialize: function(options) {
    options = options || {};
    var accessState = this;


    function MIDIAccessChanged() {
      if (!accessState.MIDIAccess) {
        accessState.inputs.reset([]);
        return;
      }
      accessState.inputs.reset();
      accessState.MIDIAccess.inputs.forEach(accessState.registerInput, accessState);
      accessState.trigger('change:inputs');
    }

    accessState.on('change:MIDIAccess', MIDIAccessChanged);

    if (typeof options.MIDIAccess === 'undefined') {
      if (!navigator.requestMIDIAccess) {
        accessState.MIDIAccess = false;
        return;
      }

      navigator.requestMIDIAccess()
        .then(function(MIDIAccess) {
          accessState.MIDIAccess = MIDIAccess;
          accessState.MIDIAccess.onstatechange = function(evt) {
            accessState.MIDIAccess = evt.currentTarget;
            MIDIAccessChanged();
          };
        }, function() {
          accessState.MIDIAccess = false;
        });
    }
  },

  session: {
    MIDIAccess: {
      type: 'any',
      default: false
    }
  },

  collections: {
    inputs: Collection.extend({
    })
  },

  toJSON: function() {
    var obj = {};
    obj.inputs = this.inputs.toJSON();
    return obj;
  }
});

module.exports = MIDIAccessState;


/***/ }),

/***/ 265:
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var View = __webpack_require__(648);
var SignalDetailsView = __webpack_require__(696);
var SignalControlView = View.extend({
  template: '<section class="rows signal">' +
    '<header class="row">' +
      '<h3 class="row name"></h3>' +
    '</header>' +

    // '<div class="row gutter-horizontal columns model text-center">' +
    //   '<div class="column input"></div>' +
    //   '<div class="column gutter-horizontal no-grow">&raquo;</div>' +
    //   '<div class="column result"></div>' +
    // '</div>' +

    '<div class="row gutter-horizontal columns test text-center">' +
      '<input class="column input" placeholder="Input" type="text"/>' +
      '<div class="column gutter-horizontal no-grow">&raquo;</div>' +
      '<div class="column result"></div>' +
    '</div>' +
  '</section>',

  session: {
    input: 'any',
    showMappings: ['boolean', true, false]
  },

  derived: {
    result: {
      deps: ['input', 'model'/*, 'model.transformations'*/],
      fn: function() {
        return this.model.computeSignal(this.input);
      }
    }
  },

  bindings: {
    'model.name': '.name',
    // 'model.input': '.model .input',
    // 'model.result': '.model .result',
    result: '.test .result'
  },

  events: {
    'change .test .input': '_testValue',
    'click header h3': '_showDetails'
  },

  _showDetails: function () {
    this.rootView.showDetails(new SignalDetailsView({
      parent: this,
      model: this.model
    }));
  },

  _testValue: function(evt) {
    this.input = evt.target.value.trim();
  },

  render: function () {
    this.renderWithTemplate();
    var inputEl = this.query('.test .input');
    if (inputEl && !inputEl.value) {
      inputEl.value = this.input || null;
    }
    return this;
  }
});

SignalControlView.types = {};

module.exports = SignalControlView;

/***/ }),

/***/ 266:
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var assign = __webpack_require__(33);
var DetailsView = __webpack_require__(655);
var View = __webpack_require__(648);
var objectPath = __webpack_require__(651);

var StylePropertyView = View.extend({
  template: `
    <div class="columns object-prop prop-type-default">
      <div class="column gutter text-right prop-name"></div>
      <div class="column no-grow prop-value-reset">
        <button class="vfi-cancel"></button>
      </div>
      <div class="column prop-value">
        <input name="value" type="text" />
      </div>
      <div class="column prop-mapping-clear no-grow">
        <button class="vfi-unlink"></button>
      </div>
      <div class="column prop-mapping-name">
        <input name="mapping-name" type="text" />
      </div>
      <div class="column no-grow">
        <button class="mapping-details"></button>
      </div>
    </div>
  `,

  initialize: function() {
    View.prototype.initialize.apply(this, arguments);
    this.listenToAndRun(this.rootView.mappings, 'change:targets', function() {
      this.trigger('change:rootView.mappings');
    });
  },

  derived: {
    suggestionHelper: {
      cache: false,
      fn: function() {
        var view = this.parent;
        while (view) {
          if (view.suggestionHelper) return view.suggestionHelper;
          view = view.parent;
        }
        return false;
      }
    },

    propertyPath: {
      deps: ['model.name', 'parent.modelPath'],
      fn: function() {
        return this.parent.modelPath + '.styleProperties.' + this.model.name + '.value';
      }
    },

    mapping: {
      deps: ['propertyPath', 'rootView.mappings'],
      fn: function() {
        return this.rootView.mappings.findMappingByTarget(this.propertyPath);
      }
    }
  },

  bindings: {
    'model.name': '.prop-name',
    'model.value': {
      selector: '[name="value"]',
      type: 'value'
    },

    'mapping.name': [
      {
        type: 'booleanAttribute',
        selector: '.prop-mapping-clear button',
        name: 'disabled',
        invert: true
      },
      {
        type: 'value',
        selector: '[name="mapping-name"]'
      },
      {
        type: 'booleanClass',
        selector: '.mapping-details',
        yes: 'vfi-eye',
        no: 'vfi-eye-off'
      },
      {
        type: 'booleanAttribute',
        selector: '.mapping-details',
        name: 'disabled',
        invert: true
      },
      {
        type: 'booleanAttribute',
        selector: '.prop-value-reset button',
        name: 'disabled'
      }
    ]
  },

  commands: {
    'click .prop-mapping-clear button': 'updateMapping _handleRemoveMappingTarget',
    'change [name="value"]': 'propChange _handleChange',
    // 'click .prop-value-reset button': 'resetProp _handleReset',
  },

  _handleRemoveMappingTarget: function() {
    var propertyPath = this.propertyPath;
    var mapping = this.mapping.serialize();
    mapping.targets = mapping.targets.filter(function(target) {
      return target !== propertyPath;
    });
    return {mapping: mapping};
  },

  _handleChange: function() {
    return {
      path: objectPath(this.model),
      property: 'value',
      value: this.query('[name="value"]').value
    };
  },

  events: {
    'focus [name="mapping-name"]': '_suggestMapping',
    'click button.mapping-details': '_showMapping'
  },

  _suggestMapping: function(evt) {
    var view = this;
    var helper = view.suggestionHelper;
    var mappings = this.rootView.mappings;
    var propertyPath = this.propertyPath;

    helper.attach(evt.target, function(selected) {
      var mappingState = mappings.get(selected);
      if (!mappingState) return;
      var mapping = mappingState.serialize();
      mapping.targets.push(propertyPath);
      view.sendCommand('updateMapping', {
        mapping: mapping
      });
      helper.detach();
    }).fill(mappings.map(function(state) { return state.name; }));
  },

  _showMapping: function() {
    var mapping = this.mapping;
    this.rootView.regionRight.focusTab('Mappings');
    this.rootView.mappingsView.mappingsList.views.forEach(function(view) {
      if (view.model === mapping) {
        view.el.scrollIntoView();
        view.blink();
      }
    });
  }
});



var LayerDetailsView = DetailsView.extend({
  template: `
    <section>
      <header>
        <div class="columns">
          <h3 class="column">Details for <span data-hook="name"></span> <small data-hook="type"></small></h3>
          <div class="column no-grow"><button class="vfi-eye" name="show-origin"></button></div>
        </div>
        <h5 data-hook="object-path"></h5>
      </header>

      <div class="row columns">
        <div class="columns"><input type="text" name="style-prop-name" placeholder="--css-var-name" /></div>
        <div class="columns"><input type="text" name="style-prop-default" placeholder="2px, 100%, " /></div>
        <div class="columns no-grow"><button name="style-prop-add" class="vfi-plus"></button></div>
      </div>

      <div class="row style-props" ></div>
      <hr/>
      <div class="row mappings props"></div>
    </section>
  `,


  events: assign(DetailsView.prototype.events, {
    'click [name=show-origin]': '_showOrigin',
    'click [name=style-prop-add]': 'addStyleProperty'
  }),

  _showOrigin: function() {
    this.rootView.trigger('blink', this.modelPath);
  },

  addStyleProperty: function() {
    var val = this.query('[name=style-prop-default]').value;
    var props = this.model.styleProperties.serialize();
    props.push({
      name: this.query('[name=style-prop-name]').value,
      default: val,
      value: val
    });
    this.rootView.sendCommand('propChange', {
      path: 'layers.' + this.model.getId(),
      property: 'styleProperties',
      value: props
    });
  },

  render: function() {
    DetailsView.prototype.render.apply(this, arguments);

    if (this.styleProperties) {
      this.styleProperties.remove();
    }

    if (this.model.styleProperties) {
      this.styleProperties = this.renderCollection(this.model.styleProperties, StylePropertyView, '.style-props');
    }

    return this;
  }
});

LayerDetailsView.types = {};

module.exports = LayerDetailsView;

/***/ }),

/***/ 267:
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var assign = __webpack_require__(33);
var SignalControlView = __webpack_require__(265);
var HSLASignalControlView = SignalControlView.types.hsla = SignalControlView.extend({
  template: [
    '<section class="rows signal signal-color">',
    '<header class="row">',
    '<h3 class="name"></h3>',
    '</header>',

    '<div class="row columns gutter-horizontal gutter-bottom">',
    '<div class="column result-color no-grow"></div>',
    '<div class="column result gutter-left"></div>',
    '</div>',

    '<div class="row mappings props"></div>',
    '</section>'
  ].join(''),

  bindings: assign({}, SignalControlView.prototype.bindings, {
    'model.result': [
      {
        selector: '.result-color',
        type: function(el, val) {
          el.style.backgroundColor = val;
        }
      },
      {
        selector: '.result',
        type: 'text'
      }
    ]
  })
});
module.exports = HSLASignalControlView;

/***/ }),

/***/ 274:
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var View = __webpack_require__(648);
var MIDIView = View.extend({
  template: [
    '<li class="gutter">',
    '<span class="name"></span> ',
    '</li>'
  ].join(''),
  bindings: {
    'model.active': {
      type: 'booleanClass'
    },
    'model.state': '.state',
    'model.name': '.name'
  },

  events: {
    click: '_handleClick'
  },

  _handleClick: function() {
    this.model.toggle('active');
  }
});

var MIDIAccessView = View.extend({
  template:
    '<div class="midi-access">' +
      '<div class="midi-inputs">' +
        '<div class="gutter">Inputs</div>' +
        '<ul></ul>' +
      '</div>' +
    '</div>',

  render: function() {
    var originalClass;
    if (this.el) {
      originalClass = this.el.className;
    }
    this.renderWithTemplate();
    if (originalClass) {
      this.el.className = originalClass;
    }
    this.inputsView = this.renderCollection(this.model.inputs, MIDIView, '.midi-inputs ul');
    // this.outputsView = this.renderCollection(this.model.outputs, MIDIView, '.midi-outputs ul');
    return this;
  }
});

module.exports = MIDIAccessView;

/***/ }),

/***/ 275:
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var assign = __webpack_require__(33);
var SignalControlView = __webpack_require__(265);
var BeatSignalControlView = SignalControlView.types.beat = SignalControlView.extend({
  template: '<section class="rows signal signal-beat">' +
    '<header class="row">' +
      '<h3 class="name"></h3>' +
    '</header>' +

    '<div class="detector">' +
      '<button class="avg">Tap</button>' +
    '</div>' +

    '<div class="row columns gutter-horizontal gutter-bottom">' +
      '<div class="column result-dot no-grow gutter-right"></div>' +
      '<div class="column result gutter-left">' +
        '<input class="column input" placeholder="BPM" data-hook="input" />' +
      '</div>' +
    '</div>' +

    '<div class="row mappings props"></div>' +
  '</section>',

  bindings: assign({}, SignalControlView.prototype.bindings, {
    avg: {
      type: 'text',
      selector: '.avg'
    },
    'model.input': {
      type: 'value',
      hook: 'input'
    },
    'model.result': [
      {
        selector: '.result-dot',
        type: function(el, val) {
          el.style.backgroundColor = 'hsla(190, 81%, 67%,' + (val / 100) + ')';
        }
      }
    ]
  }),

  events: assign({}, SignalControlView.prototype.events, {
    'click .detector > button': 'tap'
  }),

  commands: {
    'change [data-hook=input]': 'propChange _updateBPM'
  },

  _updateBPM: function() {
    return {
      path: 'signals.' + this.model.getId(),
      property: 'input',
      value: parseInt(this.queryByHook('input').value.trim(), 10)
    };
  },

  session: {
    wait: ['number', true, 2],
    avg: ['number', true, 0],
    count: ['number', true, 0],
    first: ['number', true, 0],
    previous: ['number', true, 0]
  },

  _resetDetector: function() {
    this.set({
      count: 0,
      first: 0,
      previous: 0
    });
  },

  tap: function() {
    var timeSeconds = new Date();
    var msecs = timeSeconds.getTime();
    var wait = 2;

    if ((msecs - this.previous) > 1000 * wait) {
      this.count = 0;
    }

    if (!this.count) {
      this.first = msecs;
      this.count = 1;
    }
    else {
      this.avg = Math.round((60000 * this.count / (msecs - this.first)) * 100) / 100;
      this.count++;
    }

    this.sendCommand('propChange', {
      path: 'signals.' + this.model.getId(),
      property: 'input',
      value: this.avg
    });

    this.previous = msecs;
  }
});
module.exports = BeatSignalControlView;

/***/ }),

/***/ 276:
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var SignalControlView = __webpack_require__(265);
var HSLASignalControlView = __webpack_require__(267);

var RGBASignalControlView = SignalControlView.types.rgba = HSLASignalControlView.extend({});

module.exports = RGBASignalControlView;

/***/ }),

/***/ 277:
/***/ (function(module, exports, __webpack_require__) {

var localForage = __webpack_require__(151);

localForage.config({
  // driver      : localforage.WEBSQL, // Force WebSQL; same as using setDriver()
  name        : 'visualFiha',
  version     : 1.0,
  size        : 4980736, // Size of database, in bytes. WebSQL-only for now.
  storeName   : 'keyvaluepairs', // Should be alphanumeric, with underscores.
  description : 'Visual Fiha storage'
});

module.exports = localForage;

/***/ }),

/***/ 642:
/***/ (function(module, exports, __webpack_require__) {

module.exports = function() {
	return new Worker(__webpack_require__.p + "worker-build.js");
};

/***/ }),

/***/ 644:
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var View = __webpack_require__(648);
var ViewSwitcher = __webpack_require__(45);
var MIDIAccessView = __webpack_require__(274);
var SignalsView = __webpack_require__(699);
var LayersView = __webpack_require__(681);
var SuggestionView = __webpack_require__(664);
var AudioSource = __webpack_require__(658);
var AceEditor = __webpack_require__(656);
var RegionView = __webpack_require__(663);
var GistView = __webpack_require__(660);
var MappingsControlView = __webpack_require__(690);
var ControlScreenControls = __webpack_require__(659);
var LocalforageView = __webpack_require__(661);
var objectPath = __webpack_require__(651);
// var Timeline = require('./timeline-view');





var ControllerView = View.extend({
  initialize: function(options) {
    var controllerView = this;
    this.signals = options.signals;
    this.midi = options.midi;
    this.mappings = options.mappings;
    if (!this.router) {
      throw new Error('Missing router options for ControllerView');
    }

    this.listenTo(this.router, 'all', function(...args) {
      if (args[0].indexOf('app:') === 0) this.trigger(...args);
    });

    [
      'minDecibels',
      'maxDecibels',
      'smoothingTimeConstant',
      'fftSize'
    ].forEach(function(name) {
      controllerView.on('change:' + name, function () {
        if (!controllerView.audioAnalyser) return;
        controllerView.audioAnalyser[name] = controllerView[name];
      });
    }, controllerView);


    controllerView._animate();

    if (options.autoStart) {
      controllerView.play();
    }

    if (controllerView.el) {
      controllerView._attachSuggestionHelper();
    }
    else {
      controllerView.once('change:el', controllerView._attachSuggestionHelper);
    }

    controllerView.listenTo(controllerView.model.layers, 'sendCommand', function(...args) {
      controllerView.sendCommand(...args);
    });

    this._animate();
  },

  midiSources: function() {
    var eventNames = [];
    this.midi.inputs.forEach(function(midiInput) {
      var id = midiInput.getId();
      eventNames = eventNames.concat(midiInput.mappable.source.map(function(property) {
        return 'midi:' + id + '.' + property;
      }));
    });
    return eventNames;
  },

  sendCommand: function(name, payload, callback) {
    if (!this.router || !this.router.worker) return;
    this.router.sendCommand(name, payload, callback);
    return this;
  },

  _animate: function(timestamp) {
    if (this.controllerSparkline) {
      this.controllerSparkline.update(1000 / ((timestamp - this.model.frametime) - this.model.firstframetime));
    }

    if (this.audioSource) {
      this.audioSource.update();
    }

    this.model.frametime = timestamp - this.model.firstframetime;
    this.update();

    this._arId = window.requestAnimationFrame(this._animate.bind(this));
  },

  update: function() {
    var analyser = this.audioAnalyser;

    var freqArray = this.audioFrequencyArray;
    analyser.getByteFrequencyData(freqArray);

    var timeDomainArray = this.audioTimeDomainArray;
    analyser.getByteTimeDomainData(timeDomainArray);

    var command = {
      frametime: this.model.frametime,
      audio: {
        bufferLength: analyser.frequencyBinCount,
        frequency: freqArray,
        timeDomain: timeDomainArray
      }
    };

    this.sendCommand('heartbeat', command);
  },

  derived: {
    audioContext: {
      deps: [],
      fn: function() {
        return new window.AudioContext();
      }
    },
    audioAnalyser: {
      deps: ['audioContext'],
      fn: function() {
        var analyser = this.audioContext.createAnalyser();
        try {
          analyser.minDecibels = this.minDecibels;
          analyser.maxDecibels = this.maxDecibels;
          analyser.smoothingTimeConstant = this.smoothingTimeConstant;
          analyser.fftSize = this.fftSize;
        }
        catch (e) {}
        return analyser;
      }
    },
    audioFrequencyArray: {
      deps: ['audioAnalyser', 'fftSize'],
      fn: function () {
        return new window.Uint8Array(this.audioAnalyser.frequencyBinCount);
      }
    },
    audioTimeDomainArray: {
      deps: ['audioAnalyser', 'fftSize'],
      fn: function () {
        return new window.Uint8Array(this.audioAnalyser.frequencyBinCount);
      }
    },
    computedStyle: {
      deps: ['el'],
      fn: function() {
        return window.getComputedStyle(this.el);
      }
    }
  },

  session: {
    _arId: 'number',
    broadcastId: ['string', true, 'vfBus'],
    currentDetails: 'state',
    fftSize: ['number', true, 256],
    maxDecibels: ['number', true, -10],
    minDecibels: ['number', true, -90],
    playing: ['boolean', true, false],
    router: 'any',
    showControlScreen: ['boolean', true, false],
    controlScreenWidth: ['number', true, 33],
    controlScreenHeight: ['number', true, 33],
    smoothingTimeConstant: ['number', true, 0.85],
    workerPerformance: 'string'
  },

  play: function() {
    this.playing = true;
    if (!this.model.firstframetime) {
      this.model.firstframetime = performance.now();
    }
    return this;
  },
  pause: function() {
    this.playing = false;
    return this;
  },
  stop: function() {
    this.playing = false;
    this.model.firstframetime = this.model.frametime = 0;
    return this;
  },

  subviews: {
    controlScreenControls: {
      waitFor: 'el',
      selector: '.control-screen-controls',
      prepareView: function(el) {
        if (this.router) {
          this.set({
            showControlScreen: this.router.settings.get('showControlScreen', true),
            controlScreenWidth: this.router.settings.get('controlScreenWidth', 45),
            controlScreenHeight: this.router.settings.get('controlScreenHeight', 45)
          });
        }

        var view = new ControlScreenControls({
          el: el,
          active: this.showControlScreen,
          width: this.controlScreenWidth,
          height: this.controlScreenHeight,
          parent: this
        });

        this.listenToAndRun(view, 'change:active', function() {
          this.showControlScreen = view.active;
          if (this.router) {
            this.router.settings.set('showControlScreen', this.showControlScreen);
          }
        });
        this.listenToAndRun(view, 'change:width', function() {
          this.controlScreenWidth = view.width;
          if (this.router) {
            this.router.settings.set('controlScreenWidth', this.controlScreenWidth);
          }
        });
        this.listenToAndRun(view, 'change:height', function() {
          this.controlScreenHeight = view.height;
          if (this.router) {
            this.router.settings.set('controlScreenHeight', this.controlScreenHeight);
          }
        });
        return view;
      }
    },

    regionRight: {
      waitFor: 'el',
      selector: '.region-right',
      prepareView: function(el) {
        var parent = this;
        function buildLayers() {
          if (parent.layersView && parent.layersView.remove) {
            parent.layersView.remove();
            parent.stopListening(parent.layersView);
          }
          parent.layersView = new LayersView({
            collection: parent.model.layers,
            parent: parent,
            model: parent.model
          });
          return parent.layersView;
        }

        parent.mappingsView = new MappingsControlView({
          collection: parent.mappings,
          parent: parent,
          model: parent.model
        });

        function buildSignals() {
          if (parent.signalsView && parent.signalsView.remove) {
            parent.signalsView.remove();
            parent.stopListening(parent.signalsView);
          }
          parent.signalsView = new SignalsView({
            collection: parent.signals,
            parent: parent,
            model: parent.model
          });
          return parent.signalsView;
        }

        function buildCodeEditor() {
          if (parent.codeEditor) {
            parent.stopListening(parent.codeEditor);
          }
          parent.codeEditor = new AceEditor({
            parent: parent
          });
          return parent.codeEditor;
        }

        var view = new RegionView({
          parent: parent,
          el: el,
          tabs: [
            {name: 'Layers', rebuild: buildLayers, pinned: true, active: true},
            {name: 'Signals', rebuild: buildSignals, pinned: true},
            {name: 'Mappings', view: parent.mappingsView, pinned: true},
            {name: 'Editor', rebuild: buildCodeEditor, pinned: true}
          ]
        });

        view.el.classList.add('region-right');
        view.el.classList.add('column');
        view.el.classList.add('rows');

        return view;
      }
    },

    regionLeftBottom: {
      waitFor: 'el',
      selector: '.region-left-bottom',
      prepareView: function(el) {
        var parent = this;
        var styles = this.computedStyle;

        function buildAudioSource() {
          parent.audioSource = new AudioSource({
            audioAnalyser: parent.audioAnalyser,
            parent: parent,
            color: styles.color
          });
          return parent.audioSource;
        }
        buildAudioSource();

        if (parent.midi) {
          parent.MIDIAccess = new MIDIAccessView({
            parent: parent,
            model: parent.midi
          });
        }

        // parent.timeline = new Timeline({
        //   parent: this,
        //   entries: []
        // });

        var view = new RegionView({
          parent: parent,
          el: el,
          currentView: parent.mappingsView,
          tabs: [
            {name: 'MIDI', view: parent.MIDIAccess, pinned: true, active: true},
            {name: 'Audio', rebuild: buildAudioSource, pinned: true},
            // {name: 'Timeline', view: parent.timeline, pinned: true, active: true}
          ]
        });

        view.el.classList.add('row');
        view.el.classList.add('grow-l');
        view.el.classList.add('region-left-bottom');

        return view;
      }
    },

    localforageView: {
      waitFor: 'el',
      selector: '.controller > .header',
      prepareView: function(el) {
        var view = new LocalforageView({parent: this, model: this.model});
        el.appendChild(view.render().el);
        return view;
      }
    },

    gistView: {
      waitFor: 'el',
      selector: '.controller > .header',
      prepareView: function(el) {
        var view = new GistView({parent: this, model: this.model});
        el.appendChild(view.render().el);
        return view;
      }
    }
  },

  _attachSuggestionHelper: function() {
    if (this.suggestionHelper) { return; }
    this.suggestionHelper = this.registerSubview(new SuggestionView({
      parent: this
    }));
  },

  remove: function() {
    View.prototype.remove.apply(this, arguments);
  },

  bindings: {
    workerPerformance: '.worker-performance',
    showControlScreen: [
      {
        selector: '.control-screen',
        type: 'toggle'
      },
      {
        selector: '.control-screen',
        type: function(el, val) {
          el.src = !val ? '' : './screen.html#' + this.broadcastId;
        }
      }
    ],
    controlScreenWidth: {
      selector: '.region-left',
      type: function(el, val) {
        el.style.width = val +'%';
      }
    },
    controlScreenHeight: {
      selector: '.region-left-top',
      type: function(el, val) {
        var parentNode = el.parentNode;
        var height = ((Math.max(100, parentNode.clientHeight) / 100) * val) +'px';
        el.style.maxHeight = height;
        el.style.minHeight = height;
      }
    },
    playing: [
      {
        type: 'toggle',
        selector: '[name="play"]',
        invert: true
      },
      {
        type: 'toggle',
        selector: '[name="pause"]'
      }
    ]
  },

  commands: {
    'click [name="play"]': 'play',
    'click [name="pause"]': 'pause',
    'click [name="stop"]': 'stop'
  },

  events: {
    'click [name="screen"]': '_openScreen',
    'click [name="setup-editor"]': '_setupEditor'
  },

  _openScreen: function() {
    window.open('./screen.html#' + this.broadcastId, 'screen', 'width=800,height=600,location=no');
  },

  toJSON: function() {
    return {
      signals: this.signals.toJSON(),
      mappings: this.mappings.toJSON(),
      layers: this.model.layers.toJSON()
    };
  },

  fromJSON: function(obj) {
    this.router._sendBootstrap(obj);
    return this;
  },



  getEditor: function() {
    this.regionRight.focusTab('Editor');
    return this.codeEditor;
  },

  _setupEditor: function() {
    var view = this;
    var editor = view.getEditor();

    editor.editCode({
      autoApply: false,
      title: 'Setup',
      script: view.gistView.toYaml(),
      language: 'yaml',
      onapply: function(str) {
        view.router._sendBootstrap(view.gistView.fromYaml(str), view._setupEditor.bind(view));
      }
    });
  },

  showDetails: function (view) {
    if (view === this.currentDetails) return this;
    var tabs = this.regionLeftBottom.tabs;
    var tabName = view.modelPath || objectPath(view.model);
    var found = tabs.get(tabName);
    if (!found) {
      found = tabs.add({name: tabName, view: view});
    }
    else {
      found.view = view;
    }

    this.regionLeftBottom.focusTab(tabName);
    found.view.blink();
    return this;
  },

  render: function () {
    var controllerView = this;
    this.renderWithTemplate();

    this.cacheElements({
      jsHeapLimit: '.heap-limit span',
      jsHeapTotal: '.heap-total span',
      jsHeapUsed: '.heap-used span',
      detailsEl: '.details'
    });

    this.detailsSwitcher = new ViewSwitcher(this.detailsEl, {
      show: function (view) {
        controllerView.currentDetails = view;
      }
    });

    return this;
  },

  autoRender: true,

  /*
  :sout=#http{dst=:8080/stream} :sout-keep
  */
  template: `
    <div class="controller rows">
      <div class="row columns gutter-horizontal header">
        <div class="column no-grow gutter-right">Visual Fiha</div>

        <div class="column columns">
          <!-- <span class="column columns no-grow button-group">
            <button class="column gutter-horizontal" name="play"><span class="vfi-play"></span></button>
            <button class="column gutter-horizontal" name="pause"><span class="vfi-pause"></span></button>
            <button class="column gutter-horizontal" name="stop"><span class="vfi-stop"></span></button>
          </span> -->

          <div class="column"></div>

          <div class="column worker-performance"></div>

          <div class="column no-grow control-screen-controls"></div>

          <div class="column no-grow">
            <button name="screen">Open screen</button>
          </div>

          <div class="column"></div>

          <div class="column no-grow">
            <button name="setup-editor">Setup editor</button>
          </div>
        </div>
      </div>

      <div class="row columns body">
        <div class="region-left column no-grow rows">
          <iframe class="region-left-top row control-screen"></iframe>

          <div class="region-left-bottom row grow-l rows"></div>
        </div>

        <div class="region-right column rows settings">
        </div>
      </div>
    </div>
  `
});
module.exports = ControllerView;

/***/ }),

/***/ 646:
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var assign = __webpack_require__(33);
var Collection = __webpack_require__(34);
var SignalState = __webpack_require__(652);
__webpack_require__(695);
__webpack_require__(697);
__webpack_require__(698);

var SignalCollection = Collection.extend({
  mainIndex: 'name',
  model: function(attrs, opts) {
    var Constructor = SignalState.types[attrs.type] || SignalState;
    var state = new Constructor(attrs, opts);
    return state;
  },

  toJSON: function () {
    return this.map(function (model) {
      if (model.toJSON) {
        return model.toJSON();
      }
      else {
        var out = {};
        assign(out, model);
        delete out.collection;
        return out;
      }
    });
  }
});
module.exports = SignalCollection;


/***/ }),

/***/ 648:
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var View = __webpack_require__(35);

function noop() {}

function splitClean(str) {
  return str.split(' ')
            .map(p => p.trim())
            .filter(p => p);
}

var ControlView = View.extend({
  _commandsBound: false,

  blink: function() {
    var classes = this.el.classList;
    this.el.addEventListener('animationend', function() {
      classes.remove('blink');
    });
    if (!classes.contains('blink')) {
      classes.add('blink');
    }
    return this;
  },

  initialize: function() {
    var view = this;

    function initCommands() {
      if (view.el) {
        view.bindCommands();
      }
      else if (view.el) {
        view.unbindCommands();
      }
    }

    view.on('change:el', initCommands);

    view.listenTo(view.rootView, 'blink', function(modelPath) {
      console.info('blink', view.modelPath, view.modelPath && view.modelPath === modelPath);
      if (view.modelPath && view.modelPath === modelPath) view.blink();
    });
  },

  derived:{
    rootView:{
      deps:['parent'],
      fn: function() {
        for (var inst = this; inst; inst = inst.parent) {
          if (!inst.parent) { return inst; }
        }
      }
    }
  },

  sendCommand: function(...args) {
    this.rootView.sendCommand(...args);
  },

  _commands: function(el) {
    var view = this;
    var commands = [];
    var rootView = view.rootView;
    el = el || view.el;
    // not sure about that...
    if (!el) return commands;

    Object.keys(view.commands || {}).forEach(function(key) {
      var evtNameSelector = splitClean(key);
      var evtName = evtNameSelector.shift();
      var selector = evtNameSelector.join(' ');
      var info = view.commands[key];
      var serializer = noop;
      var command;

      if (typeof info === 'string') {
        var cmdNameMethodName = splitClean(info);
        command = cmdNameMethodName[0];

        if (cmdNameMethodName[1]) {
          serializer = view[cmdNameMethodName[1]];

          if (typeof serializer !== 'function') {
            throw new Error('Command "' + info + '" method not found');
          }
        }

        info = {};
      }
      else {
        command = info.command;
        serializer = info.serializer;
      }

      // var listener = throttle(function commandEventListener(...args) {
      //   rootView.sendCommand(command, serializer(...args)/*, done*/);
      // }, 1000 / 24);
      var listener = function commandEventListener(...args) {
        rootView.sendCommand(command, serializer.apply(view, ...args)/*, done*/);
      };

      var els = [view.el];
      if (selector) {
        els = el.querySelectorAll(selector);
      }

      commands.push({
        event: evtName,
        listener: listener,
        command: command,
        listenerOptions: {
          passive: info.passive
        },
        elements: els
      });
    }, view);
    return commands;
  },

  bindCommands: function(el) {
    if (this._commandsBound) return this;
    this._commands(el).forEach(function(info) {
      for (var e = 0; e < info.elements.length; e++) {
        info.elements[e].addEventListener(info.event, info.listener, info.listenerOptions);
      }
    });
    this._commandsBound = true;
    this.trigger('commands:bound');
    return this;
  },

  unbindCommands: function(el) {
    if (!this._commandsBound) return this;
    this._commands(el).forEach(function(info) {
      for (var e = 0; e < info.elements.length; e++) {
        //? if (info.elements[e].removeEventListener)
        info.elements[e].removeEventListener(info.event, info.listener, info.listenerOptions);
      }
    });
    this._commandsBound = false;
    this.trigger('commands:unbound');
    return this;
  },

  remove: function() {
    this.unbindCommands();
    return View.prototype.remove.apply(this, arguments);
  }
});

module.exports = ControlView;

/***/ }),

/***/ 649:
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var View = __webpack_require__(648);
var LayerDetailsView = __webpack_require__(266);
var objectPath = __webpack_require__(651);

var LayerControlView = View.extend({
  template: `
    <section class="default-layer-control">
      <header class="columns">
        <div class="column no-grow gutter-right"><button class="active prop-toggle"></button></div>
        <div class="column no-grow gutter-horizontal"><button class="edit-css vfi-code"></button></div>
        <h3 class="column layer-name gutter-left" data-hook="name"></h3>
        <div class="column no-grow text-right"><button class="vfi-trash-empty remove-layer"></button></div>
      </header>

      <div class="preview gutter-horizontal"></div>

      <div class="mappings props"></div>
    </section>
  `,

  events: {
    'click .edit-css': '_editLayerStyles',
    'click .layer-name': '_showDetails'
  },


  _showDetails: function () {
    var DetailsViewConstructor = LayerDetailsView.types ? LayerDetailsView.types[this.model.getType()] : false;
    DetailsViewConstructor = DetailsViewConstructor || LayerDetailsView;
    this.rootView.showDetails(new DetailsViewConstructor({
      parent: this,
      model: this.model
    }));
  },

  _editLayerStyles: function () {
    var view = this;
    var rootView = view.rootView;
    var editorView = rootView.getEditor();
    var id = view.model.getId();
    editorView.editCode({
      script: '#' + id + ' {\n' + this.model.layerStyles + '\n}',
      language: 'css',
      title: id + ' layer styles',
      onshoworigin: function() {
        rootView.trigger('blink', 'layers.' + id);
      },
      autoApply: true,
      onvalidchange: function (str) {
        var cleaned = str.split('{').pop().split('}').shift().trim();
        view.sendCommand('propChange', {
          path: 'layers.' + id,
          property: 'layerStyles',
          value: cleaned
        });
      }
    });
  },

  commands: {
    'click .remove-layer': 'removeLayer _layerName',
    'click .active.prop-toggle': 'propChange _toggleActive'
  },

  _layerName: function() {
    return {
      layerName: this.model.name
    };
  },

  _toggleActive: function() {
    return {
      path: objectPath(this.model),
      property: 'active',
      value: !this.model.active
    };
  },

  bindings: {
    'model.active': [
      {
        type: 'booleanClass',
        name: 'disabled',
        invert: true
      },

      {
        type: 'booleanClass',
        selector: '.active.prop-toggle',
        yes: 'vfi-toggle-on',
        no: 'vfi-toggle-off'
      }
    ],
    'model.name': {
      hook: 'name',
      type: 'text'
    },
    'model.type': [
      {
        hook: 'type',
        type: 'text'
      },
      {
        type: 'class'
      }
    ]
  },

  derived: {
    modelPath: {
      deps: ['model'],
      fn: function() {
        return objectPath(this.model);
      }
    }
  }
});

LayerControlView.types = {};

module.exports = LayerControlView;

/***/ }),

/***/ 651:
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function isCollectionOfParent(o, p) {
  if (!p || !p._collections) return;
  for (var name in p._collections) {
    if (p[name] === o.collection) return name + '.' + o.getId();
  }
}

function isChildOfParent(o, p) {
  if (!p || !p._children) return;
  for (var name in p._children) {
    if (p[name] === o) return name;
  }
}

function isPropOfParent(o, p) {
  if (!p) return;
  for (var name in p) {
    if (p[name] === o) return name;
  }
}

var _paths = {};
function objectPath(state) {
  if (!state) return null;
  if (_paths[state.cid]) return _paths[state.cid];
  var parts = [];


  function up(instance) {
    var collectionName = instance.collection ?
                          isCollectionOfParent(instance, instance.collection.parent) :
                          null;
    if (collectionName) {
      parts.unshift(collectionName);
      return up(instance.collection.parent);
    }

    var childName = isChildOfParent(instance, instance.parent);
    if (childName) {
      parts.unshift(childName);
      return up(instance.parent);
    }


    var propName = isPropOfParent(instance, instance.parent);
    if (propName) {
      parts.unshift(propName);
      return up(instance.parent);
    }

    if (instance.parent) up(instance.parent);
  }

  up(state);

  _paths[state.cid] = parts.join('.');
  return _paths[state.cid];
}

module.exports = objectPath;

/***/ }),

/***/ 652:
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var State = __webpack_require__(27);

var SignalState = State.extend({
  idAttribute: 'name',
  typeAttribute: 'type',

  mappable: {
    source: ['result'],
    target: ['input']
  },

  props: {
    name: ['string', true, null],
    type: ['string', true, 'default'],
    defaultValue: ['any', true, function () { return 1; }],
    input: ['any', false, null]
  },

  derived: {
    modelPath: {
      deps: ['name'],
      fn: function() {
        return 'signals.' + this.name;
      }
    },
    result: {
      deps: ['input', 'transformations'],
      fn: function() {
        return this.computeSignal();
      }
    }
  },

  computeSignal: function(val) {
    val = val || this.input;
    return val;
  }
});

SignalState.types = {};

module.exports = SignalState;


/***/ }),

/***/ 654:
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function resolve(path, context) {
  if (!context) throw new Error('Missing context to solve mapping path');

  function solver(str) {
    var parts = str.split('.');

    var f = function(instance) {
      if (!parts.length) return instance;

      var part = parts.shift();
      if (instance[part] && instance[part].isCollection) {
        return f(instance[part].get(parts.shift()));
      }
      else if (typeof instance[part] !== 'undefined') {
        return f(instance[part]);
      }
    };
    return f;
  }

  return solver(path)(context);
}

module.exports = resolve;

/***/ }),

/***/ 655:
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var assign = __webpack_require__(33);
var Collection = __webpack_require__(34);
var State = __webpack_require__(27);
var View = __webpack_require__(648);
var objectPath = __webpack_require__(651);

var PropertyView = __webpack_require__(662);

var DetailsView = View.extend({
  template: `
    <section class="row rows">
      <header class="row no-grow">
        <div class="columns">
          <h3 class="column">Details for <span data-hook="name"></span> <small data-hook="type"></small></h3>
        </div>
        <h5 data-hook="object-path"></h5>
      </header>

      <div class="row items"></div>
    </section>
  `,

  initialize: function() {
    this.listenToAndRun(this, 'change:definition', function() {
      this.properties.reset(this.definition);
    });

    this.listenTo(this.rootView, 'all', function(evtName) {
      if (evtName.indexOf('app:') === 0 && evtName.indexOf('Mapping') > 0) {
        this.trigger('change:model', this.model);
      }
      else if (evtName === 'blink') {
        if(this.modelPath === arguments[1]) this.blink();
      }
    });
  },

  derived: {
    propNames: {
      deps: ['model'],
      fn: function() {
        var def = this.model.constructor.prototype._definition;
        return Object.keys(def)
          .filter(function(key) {
            return [
              'drawFunction',

              'name',
              'type'
            ].indexOf(key) < 0;
          });
      }
    },

    definition: {
      deps: ['propNames'],
      fn: function() {
        var def = this.model.constructor.prototype._definition;
        return this.propNames
          .map(function(name) {
            return assign({name: name}, def[name]);
          });
      }
    },

    modelPath: {
      deps: ['model'],
      fn: function() {
        return objectPath(this.model);
      }
    }
  },

  collections: {
    properties: Collection.extend({
      mainIndex: 'name',

      model: State.extend({
        idAttribute: 'name',

        session: {
          name: 'string',
          allowNull: 'boolean',
          default: 'any',
          required: 'boolean',
          test: 'any',
          type: 'string',
          values: 'array'
        }
      })
    })
  },

  render: function() {
    View.prototype.render.apply(this, arguments);

    if (this.propertiesView) {
      this.propertiesView.remove();
    }

    this.propertiesView = this.renderCollection(this.properties, function (opts) {
      var Constructor = (PropertyView.names[opts.model.name] || PropertyView.types[opts.model.type] || PropertyView);
      // console.info('property name: %s (%s), type: %s (%s)', opts.model.name, !!PropertyView.names[opts.model.name], opts.model.type, !!PropertyView.types[opts.model.type]);
      return new Constructor(opts);
    }, '.items');

    this.trigger('change:model');
    this.trigger('change:model.name');
    this.trigger('change:modelPath');
    return this;
  },

  bindings: {
    'model.name': '[data-hook=name]',
    'model.type': '[data-hook=type]',
    modelPath: '[data-hook="object-path"]'
  }
});
module.exports = DetailsView;


/***/ }),

/***/ 656:
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var View = __webpack_require__(35);
var canvasCompleter = __webpack_require__(665);

var AceEditor = View.extend({
  editCode: function(options) {
    options.autoApply = !!options.autoApply;
    if (options.autoApply && typeof options.onvalidchange !== 'function') throw new Error('Missing onvalidchange function option');
    if (!options.autoApply && typeof options.onapply !== 'function') throw new Error('Missing onapply function option');
    options.original = options.script = options.script.toString();
    this._cleanup().set(options).render();
  },

  template: `
    <section class="row code-editor rows">
      <header>
        <div class="columns">
          <h3 class="column"><span data-hook="editor-title"></span> <small data-hook="editor-language"></small></h3>
          <div class="column no-grow show-origin"><button class="vfi-eye" name="show-origin"></button></div>
        </div>
      </header>

      <div class="ace-editor row grow-xl"></div>

      <div class="ace-controls row no-grow gutter columns">
        <div class="column"></div>
        <div class="column no-grow gutter-right">
          <button class="no" name="cancel">Cancel</button>
          <button class="yes" name="apply">Apply</button>
        </div>
      </div>
    </section>
  `,

  session: {
    title: 'string',
    language: {
      type: 'string',
      values: ['javascript', 'yaml', 'css'],
      required: true,
      default: 'javascript'
    },
    autoApply: 'boolean',
    errors: 'array',
    editor: 'any',
    original: ['string', true, ''],
    script: ['string', true, ''],
    onshoworigin: 'any',
    onvalidchange: 'any',
    onapply: 'any',
    validator: 'any'
  },

  derived: {
    pristine: {
      deps: ['script', 'original'],
      fn: function() {
        return this.script === this.original;
      }
    }
  },

  bindings: {
    script: {
      type: function() {
        if (!this.editor) return;
        this.editor.setValue(this.script);
      }
    },

    pristine: [
      {
          type: 'booleanClass',
          name: 'pristine'
      },
      {
        selector: '[name=cancel]',
        type: 'booleanAttribute',
        name: 'disabled'
      },
      {
        selector: '[name=apply]',
        type: 'booleanAttribute',
        name: 'disabled'
      }
    ],

    autoApply: {
      type: 'booleanClass',
      name: 'autoapply'
    },

    onshoworigin: {
      type: 'toggle',
      selector: '.show-origin'
    },

    title: '[data-hook=editor-title]',
    language: '[data-hook=editor-language]'
  },

  events: {
    'click [name=show-origin]': '_showOrigin',
    'click [name="cancel"]': '_cancel',
    'click [name="apply"]': '_apply'
  },

  _showOrigin: function() {
    var fn = this.onshoworigin;
    if (typeof fn === 'function') fn();
  },

  setPristine: function() {
    if (this.original != this.script) this.original = this.script;
    return this;
  },

  _cleanup: function() {
    delete this._cache.changed;
    delete this._cache.original;

    if (typeof this.onvalidchange === 'function') {
      this.unset('onvalidchange');
    }
    if (typeof this.validator === 'function') {
      this.unset('validator');
    }

    return this;
  },

  validateScript: function(script) {
    var validator = this.validator;
    if (typeof validator === 'function') {
      return validator.call(this, script);
    }
  },

  getErrors: function() {
    return this.editor
      .getSession()
      .getAnnotations()
      .filter(function (annotation) {
        return annotation.type === 'error';
      });
  },

  _cancel: function() {},

  _apply: function() {
    var view = this;
    var editor = view.editor;
    var str = editor.getValue();
    if (typeof view.onapply === 'function') {
      view.onapply(str);
    }
    view.set('script', str, {silent: true});
    view.set('original', str, {silent: true});
    delete view._cache.pristine;
    view.trigger('change:pristine', view, view.script === view.original);
  },

  _makeEditor: function() {
    var view = this;
    var ace = window.ace;
    if (view.editor) view.editor.destroy();

    var hasAnnotations = ['javascript', 'css'].indexOf(view.language) > -1;
    var editor = view.editor = ace.edit(view.query('.ace-editor'));

    function changed() {
      var errors = view.getErrors();
      if (errors.length) {
        return;
      }

      var str = editor.getValue();
      if (view.autoApply && typeof view.onvalidchange === 'function' && view.script !== str) {
        view.onvalidchange(str);
      }
      view.set('script', str, {silent: true});
      delete view._cache.pristine;
      view.trigger('change:pristine', view, view.script === view.original);
    }

    editor.$blockScrolling = Infinity;
    editor.setTheme('ace/theme/monokai');
    editor.setShowInvisibles();
    editor.setFontSize(16);

    if (view.language === 'javascript') {
      var languageTools = ace.require('ace/ext/language_tools');
      editor.setOptions({
        enableBasicAutocompletion: true,
        enableSnippets: true,
        enableLiveAutocompletion: false
      });
      languageTools.addCompleter(canvasCompleter);
    }

    var session = editor.getSession();
    session.setMode('ace/mode/' + view.language);
    session.setUseSoftTabs(true);
    session.setTabSize(2);
    session.setUseWrapMode(true);

    if (hasAnnotations) {
      session.on('changeAnnotation', changed);
    }
    else {
      session.on('change', changed);
    }

    editor.setValue(view.script || view.original || '');

    return view;
  },

  render: function() {
    View.prototype.render.apply(this, arguments);

    this._makeEditor();

    return this;
  },

  remove: function() {
    this.editor.destroy();
    return View.prototype.remove.apply(this, arguments);
  }
});
module.exports = AceEditor;

/***/ }),

/***/ 657:
/***/ (function(module, exports, __webpack_require__) {

"use strict";

module.exports = __webpack_require__(35).extend({
  autoRender: true,
  template: '<canvas width="200" height="200"></canvas>',

  session: {
    lineWidth: ['number', true, 1],
    width: ['number', true, 200],
    height: ['number', true, 200],
    padding: ['number', true, 2],
    color: ['string', true, '#000']
  },

  bindings: {
    width: {
      type: 'attribute',
      name: 'width'
    },
    height: {
      type: 'attribute',
      name: 'height'
    }
  },

  derived: {
    ctx: {
      deps: ['el', 'width', 'height'],
      fn: function() {
        return this.el.getContext('2d');
      }
    }
  },

  drawScales: function(/*bufferLength*/) {
    var ctx = this.ctx;
    var x = ctx.canvas.width * 0.5;
    var y = ((ctx.canvas.height - 30) * 0.5) + 15;
    var r = Math.min(x, y) - 30;
    var rad = (Math.PI * 2);

    ctx.font = '10px monospace';
    ctx.fillStyle = ctx.strokeStyle = this.color;
    var i, a, ax, ay, bx, by, lx, ly, ca, sa;
    ctx.globalAlpha = 0.5;
    for (i = 0; i < 360; i += 15) {
      a = ((rad / 360) * i) - Math.PI;
      ca = Math.cos(a);
      sa = Math.sin(a);
      ax = Math.round(x + (ca * (r / 10)));
      ay = Math.round(y + (sa * (r / 10)));
      bx = Math.round(x + (ca * (r - 5)));
      by = Math.round(y + (sa * (r - 5)));
      lx = Math.round(x + (ca * r));
      ly = Math.round(y + (sa * r));

      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);

      ctx.textAlign = 'center';
      if (lx < x) {
        ctx.textAlign = 'right';
      }
      else if (lx > x) {
        ctx.textAlign = 'left';
      }

      ctx.textBaseline = 'middle';
      if (ly < y) {
        ctx.textBaseline = 'bottom';
      }
      else if (ly > y) {
        ctx.textBaseline = 'top';
      }
      ctx.globalAlpha = 1;
      ctx.fillText(i, lx, ly);
      ctx.globalAlpha = 0.5;

      ctx.stroke();
      ctx.closePath();
    }
    ctx.globalAlpha = 1;

    return this;
  },

  update: function() {
    if (!this.el) {
      return this;
    }

    var source = this.parent;

    var ctx = this.ctx;
    var width = ctx.canvas.width;
    var height = ctx.canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = ctx.strokeStyle = this.color;

    var analyser = source.parent.audioAnalyser;
    var bufferLength = analyser.frequencyBinCount;
    this.drawScales(bufferLength);

    var freqArray = source.parent.audioFrequencyArray;
    analyser.getByteFrequencyData(freqArray);

    var timeDomainArray = source.parent.audioTimeDomainArray;
    analyser.getByteTimeDomainData(timeDomainArray);

    var x = width * 0.5;
    var y = ((height - 30) * 0.5) + 15;
    var r = Math.min(x, y) - 30;
    var rad = Math.PI * 2;

    ctx.font = '13px monospace';
    ctx.textAlign = 'center';


    var i, a, f, td, lx, ly, val, min = 0, max = 0, avg = 0;
    ctx.strokeStyle = ctx.fillStyle = '#A581FF';
    ctx.beginPath();
    for (i = 0; i < bufferLength; i++) {
      val = freqArray[i];
      avg += val;
      min = Math.min(min, val);
      max = Math.max(max, val);

      a = ((rad / bufferLength) * i) - Math.PI;
      f = (r / 100) * (val * 0.5);
      lx = Math.round(x + Math.cos(a) * f);
      ly = Math.round(y + Math.sin(a) * f);
      ctx.lineTo(lx, ly);
    }
    ctx.stroke();
    ctx.textBaseline = 'top';
    ctx.fillText(min.toFixed(2) + ' - ' + max.toFixed(2) + ' | ' + (avg / bufferLength).toFixed(2), x, 0);



    min = 0;
    max = 0;
    avg = 0;
    ctx.strokeStyle = ctx.fillStyle = '#66D9EF';
    ctx.beginPath();
    for (i = 0; i < bufferLength; i++) {
      val = timeDomainArray[i];
      avg += val;
      min = Math.min(min, val);
      max = Math.max(max, val);

      a = ((rad / bufferLength) * i) - Math.PI;
      td = (r / 100) * (val * 0.5);
      lx = Math.round(x + Math.cos(a) * td);
      ly = Math.round(y + Math.sin(a) * td);
      ctx.lineTo(lx, ly);
    }
    ctx.stroke();
    ctx.textBaseline = 'bottom';
    ctx.fillText(min.toFixed(2) + ' - ' + max.toFixed(2) + ' | ' + (avg / bufferLength).toFixed(2), x, height);

    return this;
  }
});


/***/ }),

/***/ 658:
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var View = __webpack_require__(648);
var AudioMonitor = __webpack_require__(657);
var AudioSource = View.extend({
  autoRender: true,

  // need to investigate min/max value for decibels:
  // https://webaudio.github.io/web-audio-api/#widl-AnalyserNode-maxDecibels
  template: `
    <div class="column rows audio-source">
      <!-- <audio class="row" src="http://localhost:8080/stream" controls autoplay></audio> -->
      <div class="row columns">
        <div class="column audio-monitor"></div>
        <div class="column audio-controls">
          <label>MinDb: <input type="range" name="minDecibels" value="-90" min="-200" max="-11" step="1" /></label>
          <label>MaxDb: <input type="range" name="maxDecibels" value="-10" min="-70" max="120" step="1" /></label>
          <label>Smoothing: <input type="range" name="smoothingTimeConstant" min="0" max="1" value="0.85" step="0.01" /></label>
          <label>FftSize: <select type="number" name="fftSize" value="32" step="2">
            <option value="32">32</option>
            <option value="64">64</option>
            <option value="128">128</option>
            <option value="256">256</option>
            <option value="1024">1024</option>
            <option value="2048">2048</option>
          </select></label>
        </div>
      </div>
    </div>
  `,

  initialize: function() {
    this.listenToAndRun(this, 'change:audioContext change:audioAnalyser', this.connectAudioSource);
  },

  // session: {
  //   minDecibels: ['number', true, -90],
  //   maxDecibels: ['number', true, -10],
  //   smoothingTimeConstant: ['number', true, 0.85],
  //   fftSize: ['number', true, 256],
  //   audioAnalyser: 'any'
  // },

  bindings: {
    'parent.minDecibels': {
      selector: '[name="minDecibels"]',
      type: 'value'
    },
    'parent.maxDecibels': {
      selector: '[name="maxDecibels"]',
      type: 'value'
    },
    'parent.smoothingTimeConstant': {
      selector: '[name="smoothingTimeConstant"]',
      type: 'value'
    },
    'parent.fftSize': {
      selector: '[name="fftSize"]',
      type: 'value'
    }
  },

  session: {
    color: 'string'
  },

  subviews: {
    monitor: {
      waitFor: 'el',
      selector: '.audio-monitor',
      prepareView: function(el) {
        var view = new AudioMonitor({
          color: this.color,
          audioAnalyser: this.parent.audioAnalyser,
          parent: this
        });
        el.appendChild(view.el);
        return view;
      }
    }
  },


  events: {
    'change .audio-source [name]': '_changeAudioParams'
  },

  connectAudioSource: function() {
    var view = this;
    var capture = {
      audio: true
    };

    function success(stream) {
      var source = view.parent.audioContext.createMediaStreamSource(stream);
      source.connect(view.parent.audioAnalyser);
    }
    function error(err) {
      console.warn(err);
    }

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia(capture).then(success).catch(error);
    }
    else if (navigator.getUserMedia) {
      navigator.getUserMedia(capture, success, error);
    }

    return this;
  },

  _changeAudioParams: function(evt) {
    this.parent.set(evt.target.name, Number(evt.target.value));
  },

  update: function() {
    if (!this.monitor) return;
    this.monitor.update();
  }
});
module.exports = AudioSource;

/***/ }),

/***/ 659:
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var View = __webpack_require__(35);

var ControlScreenControls = View.extend({
  template: `<div class="column columns control-screen-controls">
    <div class="column no-grow">
      <button name="control-screen">Control screen</button>
    </div>

    <div class="column no-grow columns control-screen-size">
      <div class="column">
        <input type="number" min="25" max="75" name="control-screen-width" />
      </div>

      <div class="column">
        <input type="number" min="25" max="75" name="control-screen-height" />
      </div>
    </div>
  </div>`,

  props: {
    active: ['boolean', true, true],
    width: ['number', true, 33],
    height: ['number', true, 33],
  },

  bindings: {
    'width': {type: 'value', selector: '[name="control-screen-width"]'},
    'height': {type: 'value', selector: '[name="control-screen-height"]'}
  },

  events: {
    'click [name="control-screen"]': 'toggleActive',
    'change [name="control-screen-width"]': 'setWidth',
    'change [name="control-screen-height"]': 'setHeight'
  },

  toggleActive: function() {
    this.toggle('active');
  },

  setWidth: function(evt) {
    this.width = Number(evt.target.value);
  },

  setHeight: function(evt) {
    this.height = Number(evt.target.value);
  }
});
module.exports = ControlScreenControls;

/***/ }),

/***/ 660:
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* global Request */

var View = __webpack_require__(648);
var jsYAML = __webpack_require__(147);

function resToJSON(res) {
  return res.json();
}

function toObj(arr) {
  var obj = {};
  arr.forEach(function(o) {
    obj[o.name] = o;
    delete obj[o.name].name;
  });
  return obj;
}

function toArr(obj) {
  var keys = Object.keys(obj);
  return keys.map(function(key) {
    obj[key].name = key;
    return obj[key];
  });
}


var GistView = View.extend({
  template: `
    <div class="columns">
      <div class="column"><input placeholder="Gist ID" name="gist-id"/></div>
      <div class="column no-grow"><button name="save-gist">Save gist</button></div>
      <a target="_blank">Open on GH</a>
    </div>
  `,

  events: {
    'change [name="gist-id"]': '_loadGist',
    'click [name="save-gist"]': '_saveGist'
  },

  session: {
    gistId: 'string',
    revision: 'any'
  },

  derived: {
    url: {
      deps: ['gistId'],
      fn: function() {
        return this.gistId ? 'https://gist.github.com/' + this.gistId : false;
      }
    }
  },

  bindings: {
    gistId: [
      {
        type: 'value',
        selector: '[name="gist-id"]'
      }
    ],
    url: [
      {
        type: 'attribute',
        name: 'href',
        selector: 'a'
      },
      {
        type: 'toggle',
        selector: 'a'
      }
    ]
  },

  _loadGist: function(done) {
    var view = this;
    if (!view.gistId) return done(new Error('No Gist ID'));
    done = typeof done === 'function' ? done : function(err) { console.error('gist loading error', err.message); };

    fetch('https://api.github.com/gists/' + view.gistId)
      .then(resToJSON)
      .then(function(json) {
        var content = json.files['visual-fiha-setup.yml'].content;
        done(null, view.fromYaml(content));
      }, done)
      .catch(done);
  },

  fromYaml: function(newStr) {
    var obj = {};
    try {
      obj = jsYAML.safeLoad(newStr);
      obj.signals = toArr(obj.signals || {});
      obj.layers = toArr(obj.layers || {});
      obj.mappings = toArr(obj.mappings || {});
    }
    catch(e) {
      console.warn(e);
    }
    return obj;
  },

  toYaml: function() {
    var setup = this.parent.toJSON();
    setup.signals = toObj(setup.signals || []);
    setup.layers = toObj(setup.layers || []);
    setup.mappings = toObj(setup.mappings || []);
    return jsYAML.safeDump(JSON.parse(JSON.stringify(setup)));
  },

  _saveGist: function(evt) {
    console.info('_saveGist');
    evt.preventDefault();
    var method = 'POST';
    var url = 'https://api.github.com/gists';
    var view = this;

    // we can't update an anonymous gist... :/
    // var id = this.gistId;
    // if (id) {
    //   url += '/' + id;
    //   method = 'PATCH';
    // }

    var req = new Request(url, {
      method: method,
      body: JSON.stringify({
        description: 'This gist is a setup information for https://zeropaper.github.io/visual-fiha',
        public: true,
        files: {
          'visual-fiha-setup.yml': {
            content: view.toYaml()
          }
        }
      })
    });

    fetch(req)
      .then(resToJSON)
      .then(function(json) {
        view.gistId = json.id;
      });
  }
});
module.exports = GistView;


/***/ }),

/***/ 661:
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var localForage = __webpack_require__(277);

var View = __webpack_require__(35);
var LocalforageView = View.extend({
  template: `
    <div class="columns localforage-view">
      <div class="column columns no-grow">
        <div class="column"><button name="snapshot-save" title="Take snapshot">Snapshot</button></div>
        <div class="column"><button name="snapshot-restore" class="vfi-ccw" title="Restore snapshot"></button></div>
      </div>
      <div class="column columns">
        <div class="column"><input placeholder="Local ID" name="local-id"/></div>
        <div class="column no-grow"><button name="save">Save</button></div>
        <div class="column"><button name="restore" class="vfi-ccw" title="Reload"></button></div>
      </div>
    </div>
  `,
  events: {
    'focus [name=local-id]': '_suggestKeys',
    'click [name=snapshot-restore]': '_restoreSnapshot',
    'click [name=snapshot-save]': '_saveSnapshot',
    'click [name=restore]': '_restoreSetup',
    'click [name=save]': '_saveSetup'
  },
  _suggestKeys: function(evt) {
    var helper = this.parent.suggestionHelper;
    localForage.keys().then(function(keys) {

      helper
        .attach(evt.target, function(selected) {
          evt.target.value = selected;
          helper.detach();
        })
        .fill(keys.map(s => s.replace('local-', '')));
    });
  },
  loadLocal: function(setupId, done) {
    done = typeof done === 'function' ? done : function(err) { if(err) console.error('localforage error', err.message); };
    return localForage.getItem(setupId)
            .then(function(setup) {
              done(null, setup);
            }, done)
            .catch(done);
  },
  saveLocal: function(setupId, done) {
    done = typeof done === 'function' ? done : function(err) { if(err) console.error('localforage error', err.message); };
    return localForage.setItem(setupId, this.parent.toJSON())
            .then(function() {
              done();
            }, done)
            .catch(done);
  },
  _restoreSnapshot: function() {
    var controlView = this.parent;
    this.loadLocal('snapshot', function(err, setup) {
      if (err) throw err;
      controlView.fromJSON(setup);
    });
  },
  _saveSnapshot: function() {
    this.saveLocal('snapshot', function(err) {
      if (err) throw err;
    });
  },
  _restoreSetup: function() {
    var controlView = this.parent;
    var id = 'local-' + this.query('[name=local-id]').value;
    this.loadLocal(id, function(err, setup) {
      if (err) throw err;
      controlView.fromJSON(setup);
      controlView._setupEditor();
    });
  },
  _saveSetup: function() {
    var id = 'local-' + this.query('[name=local-id]').value;
    this.saveLocal(id, function() {
      console.info('saved setup to local storage as ' + id);
    });
  }
});
module.exports = LocalforageView;

/***/ }),

/***/ 662:
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var assign = __webpack_require__(33);
var View = __webpack_require__(648);
var objectPath = __webpack_require__(651);

var PropertyView = View.extend({
  template: `
    <div class="columns object-prop prop-type-default">
      <div class="column gutter text-right prop-name"></div>
      <div class="column no-grow prop-value-reset">
        <button class="vfi-cancel"></button>
      </div>
      <div class="column prop-value">
        <input name="value" type="text" />
      </div>
      <div class="column prop-mapping-clear no-grow">
        <button class="vfi-unlink"></button>
      </div>
      <div class="column prop-mapping-name">
        <input name="mapping-name" type="text" />
      </div>
      <div class="column no-grow">
        <button class="mapping-details"></button>
      </div>
    </div>
  `,

  initialize: function() {
    View.prototype.initialize.apply(this, arguments);

    this.listenToAndRun(this.parent.model, 'change:' + this.model.name, function() {
      this.trigger('change:model', this.model);
    });
  },

  derived: {
    suggestionHelper: {
      cache: false,
      fn: function() {
        var view = this.parent;
        while (view) {
          if (view.suggestionHelper) return view.suggestionHelper;
          view = view.parent;
        }
        return false;
      }
    },

    value: {
      deps: [
        'model',
        'model.name',
        'parent.model'
      ],
      fn: function() {
        return this.parent.model.get(this.model.name);
      }
    },

    propertyPath: {
      deps: [],
      fn: function() {
        return this.parent.modelPath + '.' + this.model.name;
      }
    },

    mapping: {
      deps: [],
      fn: function() {
        return this.rootView.mappings.findMappingByTarget(this.propertyPath);
      }
    }
  },

  bindings: {
    'model.name': {
      type: 'text',
      selector: '.prop-name'
    },

    value: {
      type: function(el, val) {
        if (el === document.activeElement) return;
        el.value = val;
      },
      selector: 'input[name=value]',
    },

    'mapping.name': [
      {
        type: 'booleanAttribute',
        selector: '.prop-mapping-clear button',
        name: 'disabled',
        invert: true
      },
      {
        type: 'value',
        selector: '[name="mapping-name"]'
      },
      {
        type: 'booleanClass',
        selector: '.mapping-details',
        yes: 'vfi-eye',
        no: 'vfi-eye-off'
      },
      {
        type: 'booleanAttribute',
        selector: '.mapping-details',
        name: 'disabled',
        invert: true
      },
      {
        type: 'booleanAttribute',
        selector: '.prop-value-reset button',
        name: 'disabled'
      }
    ]
  },

  commands: {
    'click .prop-mapping-clear button': 'updateMapping _handleRemoveMappingTarget',
    'change [name="value"]': 'propChange _handleChange',
    // 'click .prop-value-reset button': 'resetProp _handleReset',
  },

  _handleRemoveMappingTarget: function() {
    var propertyPath = this.propertyPath;
    var mapping = this.mapping.serialize();
    mapping.targets = mapping.targets.filter(function(target) {
      return target !== propertyPath;
    });
    return {mapping: mapping};
  },

  _handleChange: function() {
    var parent = this.model.collection.parent.model;
    return {
      path: parent.modelPath || objectPath(parent),
      property: this.model.name,
      value: this.query('[name="value"]').value
    };
  },

  // _handleReset: function() {
  //   this.parent.model.unset(this.model.name);
  // },

  events: {
    'focus [name="mapping-name"]': '_suggestMapping',
    'focus [type="text"][name="value"]': '_suggestValues',
    'click button.mapping-details': '_showMapping'
  },

  _suggestMapping: function(evt) {
    var view = this;
    var helper = view.suggestionHelper;
    var mappings = this.rootView.mappings;
    var propertyPath = this.propertyPath;

    helper.attach(evt.target, function(selected) {
      var mappingState = mappings.get(selected);
      if (!mappingState) return;
      var mapping = mappingState.serialize();
      mapping.targets.push(propertyPath);
      view.sendCommand('updateMapping', {
        mapping: mapping
      });
      helper.detach();
    }).fill(mappings.map(function(state) { return state.name; }));
  },

  _suggestValues: function(evt) {
    var view = this;
    var helper = view.suggestionHelper;
    if (!helper || !view.model.values || !view.model.values.length) return;

    var model = view.model;
    var parent = model.collection.parent.model;
    var el = evt.target;
    helper.attach(el, function(selected) {
      // console.info('set %s . %s = %s', objectPath(parent), model.name, selected, el.value !== selected);

      view.sendCommand('propChange', {
        path: objectPath(parent),
        property: model.name,
        value: selected
      });

      el.value = selected;
      helper.detach();
    }).fill(model.values);
  },

  _showMapping: function() {
    var mapping = this.mapping;
    var rootView = this.rootView;
    rootView.regionRight.focusTab('Mappings');
    rootView.mappingsView.mappingsList.views.forEach(function(view) {
      if (view.model === mapping) {
        view.el.scrollIntoView();
        view.blink();
      }
    });
  }
});



PropertyView.types = {};

PropertyView.types.boolean = PropertyView.extend({
  template: `
    <div class="columns object-prop prop-type-boolean">
      <div class="column gutter text-right prop-name"></div>
      <div class="column no-grow prop-value-reset">
        <button class="vfi-cancel"></button>
      </div>
      <div class="column prop-value">
        <button class="prop-toggle-btn"></button>
      </div>
      <div class="column prop-mapping-clear no-grow">
        <button class="vfi-unlink"></button>
      </div>
      <div class="column prop-mapping-name">
        <input name="mapping-name" type="text" />
      </div>
      <div class="column no-grow">
        <button class="mapping-details"></button>
      </div>
    </div>
  `,

  bindings: assign({}, PropertyView.prototype.bindings, {
    value: {
      selector: 'button.prop-toggle-btn',
      type: 'booleanClass',
      yes: 'vfi-toggle-on',
      no: 'vfi-toggle-off'
    }
  }),

  events: {
    'focus [name="mapping-name"]': '_suggestMapping',
    'click button.prop-toggle-btn': '_handleChange'
  },

  _handleChange: function() {
    var parent = this.model.collection.parent.model;
    this.sendCommand('propChange', {
      path: objectPath(parent),
      property: this.model.name,
      value: !parent[this.model.name]
    });
  }
});

PropertyView.types.number = PropertyView.extend({
  template: `
    <div class="columns object-prop prop-type-number">
      <div class="column gutter text-right prop-name"></div>
      <div class="column no-grow prop-value-reset">
        <button class="vfi-cancel"></button>
      </div>
      <div class="column prop-value">
        <input name="value" type="number" />
      </div>
      <div class="column prop-mapping-clear no-grow">
        <button class="vfi-unlink"></button>
      </div>
      <div class="column prop-mapping-name">
        <input name="mapping-name" type="text" />
      </div>
      <div class="column no-grow">
        <button class="mapping-details"></button>
      </div>
    </div>
  `,

  bindings: assign({}, PropertyView.prototype.bindings, {
    min: [
      {
        selector: '[name=value]',
        type: function(el, val) {
          if (val !== null && typeof val !== 'undefined') {
            el.setAttribute('min', val);
          }
          else {
            el.removeAttribute('min');
          }
        }
      }
    ],
    max: [
      {
        selector: '[name=value]',
        type: function(el, val) {
          if (val !== null && typeof val !== 'undefined') {
            el.setAttribute('max', val);
          }
          else {
            el.removeAttribute('max');
          }
        }
      }
    ],
  }),

  session: {
    min: ['number', false, null],
    max: ['number', false, null]
  },

  _handleChange: function() {
    var payload = PropertyView.prototype._handleChange.apply(this, arguments);
    payload.value = Number(payload.value);
    return payload;
  }
});









PropertyView.names = {};

PropertyView.names.active = PropertyView.types.boolean.extend({});

PropertyView.names.opacity = PropertyView.types.number.extend({
  session: {
    min: ['number', false, 0],
    max: ['number', false, 100]
  }
});

PropertyView.names.skewX =
PropertyView.names.skewY =
PropertyView.names.rotateX =
PropertyView.names.rotateY =
PropertyView.names.rotateZ = PropertyView.types.number.extend({
  session: {
    min: ['number', false, -360],
    max: ['number', false, 360]
  }
});

module.exports = PropertyView;

/***/ }),

/***/ 663:
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var State = __webpack_require__(27);
// var View = require('./control-view');
var View = __webpack_require__(35);
var Collection = __webpack_require__(34);
var ViewSwitcher = __webpack_require__(45);

var TabView = View.extend({
  template: '<li class="columns">' +
    '<div class="column gutter name"></div>' +
    '<div class="column no-grow">' +
      '<button class="vfi-minus-squared-alt"></button>' +
    '</div>' +
  '</li>',

  bindings: {
    'model.name': '.name',
    'model.active': {type: 'booleanClass', name: 'active'},
    'model.pinned': {type: 'toggle', selector: 'button', invert: true}
  },

  events: {
    'click .name': 'selectTab',
    'click button': 'closeTab'
  },

  selectTab: function() {
    var itemView = this;
    var item = itemView.model;
    itemView.parent._focus(item);
  },

  closeTab: function() {
    this.parent.focusTabIndex(0);
    this.model.collection.remove(this.model);
  }
});

var RegionView = View.extend({
  collections: {
    tabs: Collection.extend({
      mainIndex: 'name',

      find: function(fn) {
        for (var i = 0; i < this.length; i++) {
          if (fn(this.models[i])) return this.models[i];
        }
      },

      model: State.extend({
        idAttribute: 'name',

        session: {
          pinned: 'boolean',
          active: 'boolean',
          name: 'string',
          view: 'state',
          rebuild: 'any'
        }
      })
    })
  },

  autoRender: true,

  template: '<div class="region">' +
              '<ul class="region-tabs tabs"></ul>'+
              '<div class="region-content"></div>' +
            '</div>',

  activeIndex: function() {
    if (!this.tabs.models.length) return -2;
    for (var i = 0; i < this.tabs.models.length; i++) {
      if (this.tabs.models[i].active) return i;
    }
    return -1;
  },

  render: function() {
    if (this.rendered) return this;

    View.prototype.render.apply(this, arguments);

    this.regionSwitcher = new ViewSwitcher(this.query('.region-content'), {});

    this.renderCollection(this.tabs, TabView, '.region-tabs');

    this.listenToAndRun(this.tabs, 'reset add remove', function() {
      var activeIndex = this.activeIndex();
      if (activeIndex > -2) {
        this.focusTabIndex(activeIndex > -1 ? activeIndex : 0);
      }
    });

    return this;
  },

  _setView: function(view) {
    if (!view) return;
    this.regionSwitcher.set(view);
    return view;
  },

  _focus: function(tabState) {
    if (!tabState) return;
    this.tabs.forEach(function(state) {
      state.active = tabState === state;
    });

    var view = tabState.view;
    if (typeof tabState.rebuild === 'function') {
      view = tabState.rebuild();
    }
    if (typeof tabState.Constructor === 'function') {
      view = new tabState.Constructor({
        parent: this
      });

    }
    // else {
    //   view.trigger('change:model', view, view.model, {});
    //   view.trigger('change', view, view, {});
    //   var bindings = view.constructor.prototype.bindings || {};
    //   Object.keys(bindings).forEach(function(key) {
    //     view.trigger('change:' + key);
    //   }, view);
    // }
    this._setView(view);
  },

  focusTabIndex: function(index) {
    this._focus(this.tabs.at(index));
  },

  focusTab: function(name) {
    this._focus(this.tabs.get(name));
  }
});

module.exports = RegionView;

/***/ }),

/***/ 664:
/***/ (function(module, exports, __webpack_require__) {

"use strict";

// var View = require('./control-view');
var View = __webpack_require__(35);
var Collection = __webpack_require__(34);
var State = __webpack_require__(27);

function sharedStart(array) {
  var A = array.concat().sort(),
      a1 = A[0],
      a2 = A[A.length-1],
      L = a1.length,
      i = 0;
  while(i < L && a1.charAt(i) === a2.charAt(i)) i++;
  return a1.substring(0, i);
}

var SuggestionItem = View.extend({
  template: '<li></li>',
  derived: {
    shortText: {
      deps: ['model.text', 'model.collection.parent'],
      fn: function() {
        return this.model.text.substring(this.model.collection.parent.commonStart.length);
      }
    }
  },
  bindings: {
    'model.active': {type: 'booleanClass', name: 'active'},
    shortText: {type: 'text'}
  },
  events: {
    click: '_handleClick'
  },
  _handleClick: function (evt) {
    evt.preventDefault();
    this.parent.trigger('selected', this.model.value || this.model.text);
  }
});

var SuggestionView = View.extend({
  autoRender: true,

  attach: function (el, selectCb, newCollection) {
    this.inputEl = typeof el === 'string' ? this.parent.query(el) : el;
    selectCb = selectCb || function(selected) { this.inputEl.value = selected; this.detach(); }.bind(this);
    this.off('selected');
    this.once('selected', selectCb);

    this._makeHintEl();

    if (newCollection) {
      if (newCollection.isCollection) {
        this.collection = newCollection;
      }
      else {
        this.collection.reset(newCollection);
      }
    }

    this.filterCollection();

    return this;
  },

  fill: function (arr) {
    arr = typeof arr === 'function' ? arr(this.inputEl.value) : arr;
    this.collection.reset(arr.map(function (v) { return {text:v}; }));
    return this.filterCollection();
  },

  detach: function (done) {
    done = done || function(){};
    this._removeHintEl();
    this.off('selected');
    this.unset('inputEl');
    this.collection.reset([]);
    done();
    return this;
  },

  filterCollection: function () {
    var update = [];
    if (!this.inputEl) {
      update = this.collection.models;
    }
    else {
      var inputElVal = this.inputEl.value || this.inputEl.value;

      if (!inputElVal) {
        update = this.collection.models;
      }
      else {
        update = this.collection.filter(function (suggestion) {
          return suggestion.text.indexOf(inputElVal) === 0;
        });
      }
    }

    if (update.length > 1) {
      this.commonStart = sharedStart(update.map(function(state) { return state.text; }));
    }
    else if (update.length/* === 1*/) {
      this.commonStart = update[0].text;
      if (this.commonStart === this.inputEl.value) {
        update = [];
      }
    }
    else {
      this.commonStart = '';
      update = [];
    }
    this.suggestions.reset(update);
    this.hasSuggestions = !!update.length;
    if (this.hasSuggestions) this.suggestions.at(0).toggle('active');
    return this;
  },

  derived: {
    // creates an event listener with correct scope (ideal for add/removeEventListener)
    _handleHintClick: {
      deps: [],
      fn: function() {
        var view = this;
        return function() {
          if (!view.inputEl || !view.commonStart) return;
          view.inputEl.value = view.commonStart;
        };
      }
    },
    styles: {
      deps:['inputEl'],
      fn: function() {
        if (!this.inputEl) return {};
        return window.getComputedStyle(this.inputEl);
      }
    }
  },

  session: {
    hasSuggestions: 'boolean',
    commonStart: 'string',
    inputEl: 'element'
  },

  bindings: {
    hasSuggestions: {
      type: 'toggle'
    },
    commonStart: {
      type: function() {
        var el = this.suggestionHint;
        if (!el) return;
        el.textContent = this.commonStart;
      }
    }
  },

  _handleInput: function(evt) {
    var suggestions = this.suggestions;
    var activeState = suggestions.filter(function(state) {
      return state.active;
    })[0];
    var activeIndex = activeState ? suggestions.indexOf(activeState) : -1;
    var inputElVal = this.inputEl.value;


    if (evt.type === 'keydown') {
      // that way, autocomplete can be done using the Tab keyup
      if (evt.key === 'Tab' && this.commonStart !== inputElVal) {
        evt.preventDefault();
      }
      else if (evt.key === 'Enter') {
        if (this.items.views[activeIndex]) {
          this.items.views[activeIndex]._handleClick(evt);
        }
        else {
          this.trigger('selected', inputElVal);
        }
      }
      return;
    }

    // keyup
    switch (evt.key) {
      case 'ArrowRight':
      case 'Tab':
        this._handleHintClick();
        break;
      case 'ArrowUp':
      case 'ArrowDown':
        activeIndex += evt.key === 'ArrowDown' ? 1 : -1;

        if (activeIndex < 0) {
          activeIndex = suggestions.length - 1;
        }
        else if (activeIndex >= suggestions.length) {
          activeIndex = 0;
        }

        suggestions.forEach(function(state, index) {
          state.active = index === activeIndex;
        });

        this.query('li.active').scrollIntoView();
        break;
      default:
        this.filterCollection();
    }
  },

  _makeHintEl: function() {
    var parentNode = this.inputEl.parentNode;
    if (!parentNode) return this;
    this._removeHintEl();

    var div = this.suggestionHint = document.createElement('div');
    div.className = 'suggestion--hint';
    [
      'display',
      'paddingTop',
      'paddingBottom',
      'paddingLeft',
      'paddingRight',
      'marginTop',
      'marginBottom',
      'marginLeft',
      'marginRight',
      'top',
      'bottom',
      'left',
      'right',
      'borderWidth',
      'borderStyle',
      'lineHeight',
      'fontSize',
      'fontFamily',
      'textAlign',
      'color'
    ].forEach(function(copy) {
      div.style[copy] = this.styles[copy];
    }, this);

    div.style.cursor = 'pointer';
    div.style.pointerEvents = 'none';
    div.style.borderColor = 'transparent';
    div.style.position = 'absolute';
    div.style.zIndex = this.styles.zIndex + 1;
    div.style.opacity = 0.5;

    parentNode.appendChild(div);
    this.inputEl.addEventListener('click', this._handleHintClick);
  },

  _removeHintEl: function() {
    if (!this.suggestionHint || !this.suggestionHint.parentNode) return this;

    this.inputEl.removeEventListener('click', this._handleHintClick);
    this.suggestionHint.parentNode.removeChild(this.suggestionHint);
    this.suggestionHint = null;
    return this;
  },

  resetPosition: function() {
    var view = this;
    if (!view.el || !view.el.parentNode || !view.inputEl) { return view; }
    view.el.style.visibility = 'hidden';

    setTimeout(function () {
      if (!view.el || !view.el.parentNode || !view.inputEl) { return; }
      var ipos = view.inputEl.getBoundingClientRect();
      var bpos = view.el.getBoundingClientRect();

      if (ipos.top > view.el.parentNode.clientHeight * 0.5) {
        view.el.style.maxHeight = Math.min(ipos.top, view.el.parentNode.clientHeight * 0.33) + 'px';
        view.el.style.top = ((ipos.top - view.el.clientHeight) - 3) + 'px';
      }
      else {
        view.el.style.maxHeight = Math.min(ipos.bottom, view.el.parentNode.clientHeight * 0.33) + 'px';
        view.el.style.top = (ipos.bottom + 3) + 'px';
      }

      var s = window.getComputedStyle(view.inputEl);
      var exceed = view.el.parentNode && (bpos.left + bpos.width) > view.el.parentNode.clientWidth;
      view.el.style.textAlign = s.textAlign;
      if (s.textAlign === 'right' || exceed) {
        view.el.style.left = (ipos.left - (bpos.width - ipos.width)) + 'px';
      }
      else {
        view.el.style.left = (ipos.left) + 'px';
      }

      view.el.style.visibility = 'visible';
    });

    return view;
  },

  initialize: function () {
    if (!this.parent) { throw new Error('Suggestion view need a parent view'); }

    this.collection = this.collection || new Collection([], {parent: this});

    this.on('change:collection', function () {
      this.listenToAndRun(this.collection, 'add remove reset', this.filterCollection);
    });

    this.listenTo(this.suggestions, 'add remove reset', this.resetPosition);

    var _handleInput = this._handleInput.bind(this);

    this.on('change:inputEl', function() {
      var previous = this.previousAttributes();
      if (previous.inputEl) {
        previous.inputEl.removeEventListener('keydown', _handleInput);
        previous.inputEl.removeEventListener('keyup', _handleInput);
      }

      var list = this.el;
      var holderEl = this.parent.el;
      var inputEl = this.inputEl;

      if (!inputEl) {
        if (this.el && this.el.parentNode === holderEl) {
          holderEl.removeChild(this.el);
        }
        return;
      }

      if (!list || !holderEl) { return; }
      if (list.parentNode !== holderEl) {

        var holderElStyle = window.getComputedStyle(holderEl);
        if (holderElStyle.position === 'static') {
          holderEl.style.position = 'relative';
        }

        holderEl.appendChild(list);
      }

      this.resetPosition();
      inputEl.addEventListener('keydown', _handleInput, false);
      inputEl.addEventListener('keyup', _handleInput, false);
    });

    var _handleHolderClick = function (evt) {
      evt.preventDefault();
      if (evt.target !== this.inputEl && !this.el.contains(evt.target)) {
        this.detach();
      }
    }.bind(this);

    this.listenToAndRun(this.parent, 'change:el', function() {
      var previous = this.parent.previousAttributes();
      if (previous.el) {
        previous.el.removeEventListener('click', _handleHolderClick);
      }
      if (this.parent.el) {
        this.parent.el.addEventListener('click', _handleHolderClick, false);
      }
    });
  },

  collections: {
    suggestions: Collection.extend({
      model: State.extend({
        props: {
          active: 'boolean',
          text: ['string', true, ''],
          value: ['any', false, null]
        }
      })
    })
  },

  template: '<ul class="suggestion-view"></ul>',

  render: function () {
    this.renderWithTemplate();

    this.items = this.renderCollection(this.suggestions, SuggestionItem, this.el);

    return this;
  }
});
module.exports = SuggestionView;

/***/ }),

/***/ 665:
/***/ (function(module, exports, __webpack_require__) {

"use strict";

// http://plnkr.co/edit/6MVntVmXYUbjR0DI82Cr

var mockedCtx = __webpack_require__(653);
var ramda = __webpack_require__(36);

var entries = [].concat(mockedCtx._.properties, mockedCtx._.methods);

Object.keys(ramda)
  .filter(function(name) {
    return name.length > 1 && typeof ramda[name] === 'function';
  })
  .forEach(function(name) {
    entries.push(name);
  });

// https://gist.github.com/andrei-m/982927#gistcomment-1931258
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let tmp, i, j, prev, val, row;
  // swap to save some memory O(min(a,b)) instead of O(a)
  if (a.length > b.length) {
    tmp = a;
    a = b;
    b = tmp;
  }

  row = Array(a.length + 1);
  // init the row
  for (i = 0; i <= a.length; i++) {
    row[i] = i;
  }

  // fill in the rest
  for (i = 1; i <= b.length; i++) {
    prev = i;
    for (j = 1; j <= a.length; j++) {
      if (b[i-1] === a[j-1]) {
        val = row[j-1]; // match
      } else {
        val = Math.min(row[j-1] + 1, // substitution
              Math.min(prev + 1,     // insertion
                       row[j] + 1));  // deletion
      }
      row[j - 1] = prev;
      prev = val;
    }
    row[a.length] = prev;
  }
  return row[a.length];
}

var canvasCompleter = {
  getCompletions: function(editor, session, pos, prefix, callback) {
    // if (!prefix.length) { return callback(null, []); }
    // console.info('canvasCompleter', editor, session, prefix);

    var filtered = entries
      .filter(function(entry) {
        // console.info('distance', prefix, entry, levenshteinDistance(prefix, entry));
        return !prefix || entry.indexOf(prefix) > -1;
      })
      .map(function(entry) {
        return {
          name: entry,
          value: entry + '()',
          score: 1,
          meta: 'livecode'
        };
      });

    callback(null, filtered);
  }
};
module.exports = canvasCompleter;


/***/ }),

/***/ 667:
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var LayerControlView = __webpack_require__(649);
var LayerDetailsView = __webpack_require__(266);
var assign = __webpack_require__(33);
var objectPath = __webpack_require__(651);

var CanvasLayerDetailsView = LayerDetailsView.extend({
  template: `
    <section>
      <header>
        <div class="columns">
          <h3 class="column">Details for <span data-hook="name"></span> <small>sublayer</small></h3>
          <div class="column no-grow"><button class="vfi-eye" name="show-origin"></button></div>
        </div>
        <h5 data-hook="object-path"></h5>
      </header>
      <div class="row mappings props"></div>
    </section>
  `
});

var CanvasControlLayerView = LayerControlView.extend({
  template: `
    <section class="canvas-layer">
      <header class="columns">
        <div class="column no-grow"><button name="active"></button></div>
        <div class="column no-grow"><button class="edit-draw-function vfi-cog-alt"></button></div>
        <h3 class="column canvas-layer-name gutter-horizontal" data-hook="name"></h3>
        <div class="column no-grow"><button class="vfi-trash-empty" name="remove-canvas-layer"></button></div>
      </header>
    </section>
  `,

  events: {
    'click .edit-draw-function': '_editDrawFunction',
    'click .canvas-layer-name': '_showDetails'
  },

  commands: {
    'click [name=remove-canvas-layer]': 'removeLayer _layerName',
    'click [name="active"]': 'propChange _toggleActive',
  },

  _editDrawFunction: function () {
    var rootView = this.rootView;
    var path = objectPath(this.model);
    var editor = rootView.getEditor();

    editor.editCode({
      script: this.model.drawFunction || '',
      language: 'javascript',
      title: path + '.drawFunction',
      onshoworigin: function() {
        rootView.trigger('blink', path);
      },
      autoApply: true,
      onvalidchange: function doneEditingCanvasDrawFunction(str) {
        rootView.sendCommand('propChange', {
          path: path,
          property: 'drawFunction',
          value: str
        });
      }
    });
  },

  _showDetails: function () {
    this.rootView.showDetails(new CanvasLayerDetailsView({
      parent: this,
      model: this.model
    }));
  },

  bindings: {
    'model.active': [
      {
        type: 'booleanClass',
        name: 'disabled',
        invert: true
      },

      {
        type: 'booleanClass',
        selector: '[name="active"]',
        yes: 'vfi-toggle-on',
        no: 'vfi-toggle-off'
      }
    ],

    drawFunction: '[data-hook=drawFunction]',
    'model.name': '[data-hook=name]',
    'model.duration': '[data-hook=duration]',
    'model.fps': '[data-hook=fps]',
    'model.frametime': '[data-hook=frametime]'
  }
});

module.exports = LayerControlView.types.canvas = LayerControlView.extend({
  template: `
    <section class="row canvas-control">
      <header class="rows">
        <div class="row columns">
          <div class="column no-grow"><button class="active prop-toggle"></button></div>
          <div class="column no-grow"><button class="edit-css vfi-code"></button></div>
          <h3 class="column layer-name" data-hook="name"></h3>
        </div>

        <div class="row columns new-layer">
          <div class="column"><input type="text" placeholder="new-layer-name" data-hook="new-layer-name" /></div>
          <div class="column"><input type="text" placeholder="propA, propB" data-hook="new-layer-props" /></div>
          <div class="column no-grow">
            <button name="add-layer" class="vfi-plus"></button>
          </div>
        </div>
      </header>

      <div class="layers">
        <div class="items"></div>
      </div>
    </section>
  `,

  events: assign({
    'change [data-hook=new-layer-name]': '_inputLayerName',
    'click [name=add-layer]': '_addLayer'
  }, LayerControlView.prototype.events),

  _inputLayerName: function() {
    this.query('[name=add-layer]').disabled = !this.queryByHook('new-layer-name').value.trim();
  },

  _addLayer: function(evt) {
    evt.preventDefault();
    var nameEl = this.queryByHook('new-layer-name');
    var name = nameEl.value.trim();
    var propsEl = this.queryByHook('new-layer-props');
    var propsVal = propsEl ? propsEl.value.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s; }) : [];

    var props = {};
    propsVal.forEach(function(prop) {
      props[prop] = 'any';
    });
    var res = this.model.canvasLayers.add({
      name: name,
      drawFunction: 'function(ctx) {\n  // ' + name + ' drawFunction\n}',
      props: props
    });

    if (!res) {
      return;
    }
    nameEl.value = '';

    this.rootView.sendCommand('propChange', {
      path: objectPath(this.model),
      property: 'canvasLayers',
      value: this.model.canvasLayers.serialize()
    });
  },

  initialize: function () {
    LayerControlView.prototype.initialize.apply(this, arguments);
    this.once('change:rendered', this._inputLayerName);
  },


  subviews: {
    canvasLayersView: {
      waitFor: 'el',
      selector: '.layers .items',
      prepareView: function (el) {
        return this.renderCollection(this.model.canvasLayers, CanvasControlLayerView, el);
      }
    }
  }
});

/***/ }),

/***/ 679:
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var ScreenLayerControlView = __webpack_require__(649);
module.exports = ScreenLayerControlView.types.img = ScreenLayerControlView.extend({
});

/***/ }),

/***/ 681:
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var View = __webpack_require__(649);

var LayerControlView = __webpack_require__(649);
__webpack_require__(667);
__webpack_require__(682);
__webpack_require__(679);
__webpack_require__(688);
__webpack_require__(686);

var LayersView = View.extend({
  commands: {
    'click [name="add-layer"]': 'addLayer _addLayer'
  },

  events:{
    'focus [data-hook="layer-type"]': '_suggestLayerType'
  },

  _suggestLayerType: function() {
    var helper = this.parent.suggestionHelper;
    var el = this.queryByHook('layer-type');
    helper.attach(el, function(selected) {
      el.value = selected;
      helper.detach();
    }).fill([
      'default',
      'img',
      'SVG',
      'canvas'
    ]);
  },

  _addLayer: function() {
    var typeEl = this.queryByHook('layer-type');
    var nameEl = this.queryByHook('layer-name');
    var type = typeEl.value;
    var name = nameEl.value;
    if (!type || !name) { return; }
    return {
      layer: {
        name: name,
        type: type
      }
    };
  },

  subviews: {
    items: {
      selector: '.items',
      waitFor: 'el',
      prepareView: function(el) {
        return this.renderCollection(this.collection, function (opts) {
          var type = opts.model.getType();
          var Constructor = LayerControlView.types[type] || LayerControlView;
          return new Constructor(opts);
        }, el);
      }
    }
  },

  template: `
    <section class="row layers">
      <header class="columns">
        <div class="column">
          <input data-hook="layer-name" placeholder="Name" type="text"/>
        </div>
        <div class="column">
          <input data-hook="layer-type" placeholder="Type" type="text"/>
        </div>
        <div class="column no-grow">
          <button name="add-layer" class="vfi-plus"></button>
        </div>
      </header>
      <div class="items"></div>
    </section>
  `
});
module.exports = LayersView;

/***/ }),

/***/ 682:
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var assign = __webpack_require__(33);
var ScreenLayerControlView = __webpack_require__(649);
var SVGDetailsView = __webpack_require__(683);

module.exports = ScreenLayerControlView.types.SVG = ScreenLayerControlView.extend({
  template: `
    <section class="svg-layer-control">
      <header class="columns">
        <div class="column no-grow gutter-right"><button class="active prop-toggle"></button></div>
        <div class="column no-grow gutter-horizontal"><button title="Edit layer CSS" class="edit-css vfi-code"></button></div>
        <div class="column no-grow gutter-horizontal"><button title="Edit SVG elements CSS" class="edit-svg-css vfi-cog-alt"></button></div>
        <h3 class="column layer-name gutter-left" data-hook="name"></h3>
        <div class="column no-grow text-right"><button class="vfi-trash-empty remove-layer"></button></div>
      </header>

      <div class="preview gutter-horizontal"></div>

      <div class="mappings props"></div>
    </section>
  `,

  events: assign(ScreenLayerControlView.prototype.events, {
    'click .edit-svg-css': '_editSVGStyles'
  }),

  session: {
    svgStyles: ['object', true, function() { return {}; }]
  },

  _showDetails: function () {
    this.rootView.showDetails(new SVGDetailsView({
      parent: this,
      model: this.model
    }));
  },

  _editSVGStyles: function () {
    var view = this;
    var id = view.model.getId();
    var editorView = view.rootView.getEditor();

    var cssStr = '';

    var styles = view.model.svgStyles;
    var selectors = Object.keys(styles);
    selectors.forEach(function(selector) {
      cssStr += `${ selector } {\n  ${ styles[selector].split(';').map(s => s.trim()).join(';\n  ').trim() }\n}`;
    });


    editorView.editCode({
      script: cssStr,
      language: 'css',
      title: id + ' layer styles',
      onshoworigin: function() {
        view.rootView.trigger('blink', 'layers.' + id);
      },
      autoApply: true,
      onvalidchange: function (str) {
        var parsed = {};
        str.split(/([^\{\}]+\{[^\{\}]+\})/igm).forEach(function(match) {
          match = match.trim();
          if (!match) return;
          match = match.split('{').map(s => s.split('}')[0].trim());
          parsed[match[0]] = match[1];
        });

        view.sendCommand('propChange', {
          path: 'layers.' + id,
          property: 'svgStyles',
          value: parsed
        });
      }
    });
  }
});

/***/ }),

/***/ 683:
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var DetailsView = __webpack_require__(266);



var SVGDetailsView = DetailsView.extend({
  derived: {
    propNames: {
      deps: ['model'],
      fn: function() {
        var def = this.model.constructor.prototype._definition;
        return Object.keys(def)
          .filter(function(key) {
            return [
              'content',
              'svgStyles',

              'name',
              'type',
              'zIndex'
            ].indexOf(key) < 0;
          });
      }
    }
  }
});

module.exports = SVGDetailsView;

/***/ }),

/***/ 686:
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var LayerControlView = __webpack_require__(649);
var TxtLayerControlView = LayerControlView.types.txt = LayerControlView.extend({
});
module.exports = TxtLayerControlView;

/***/ }),

/***/ 688:
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var ScreenLayerControlView = __webpack_require__(649);
module.exports = ScreenLayerControlView.types.video = ScreenLayerControlView.extend({
});

/***/ }),

/***/ 690:
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var Collection = __webpack_require__(34);
var State = __webpack_require__(27);
var View = __webpack_require__(648);
var uniq = __webpack_require__(152);

function filterEmpty(v) { return !!v; }

/**********************************************************************************\
 *                                                                                *
 *                                                                                *
\**********************************************************************************/
function sourceSuggestions(origin) {
  var results = [];
  if (!origin || typeof origin !== 'object') return results;

  var kepts = [];
  if (origin.mappable && origin.mappable.source) {
    kepts = (origin.mappable.source || []);
  }

  function filterKeys(key) {
    var excluded = [
      'mappable',
      'parent',
      'collection',
      origin.idAttribute,
      origin.typeAttribute
    ];
    return excluded.indexOf(key) < 0 && kepts.indexOf(key) > -1;
  }

  var proto = origin.constructor && origin.constructor.prototype ? origin.constructor.prototype : {};
  var propNames = Object.keys(proto._definition || {});
  var derivedNames = Object.keys(proto._derived || {});
  var childNames = Object.keys(proto._children || {});
  var collectionNames = Object.keys(proto._collections || {});

  propNames.concat(derivedNames, childNames)
    .filter(filterKeys)
    .forEach(function(key) {
      var sub = sourceSuggestions(origin[key]);
      if (!sub.length) {
        if (childNames.indexOf(key) < 0) {
          results.push(key);
        }
        return;
      }

      results = results.concat(sub.map(function(name) {
        return key + '.' + name;
      }));
    });

  kepts.concat(collectionNames)
    .filter(filterKeys)
    .forEach(function(collectionName) {
      if (!origin[collectionName] || typeof origin[collectionName].forEach !== 'function') return;

      origin[collectionName].forEach(function(model) {
        var id = model.getId();
        var suggestions = sourceSuggestions(model);
        results = results.concat(suggestions.filter(filterEmpty).map(function(name) {
          return collectionName + '.' + id + '.' + name;
        }));
      });
    });

  return uniq(results);
}


/**********************************************************************************\
 *                                                                                *
 *                                                                                *
\**********************************************************************************/
function targetSuggestions(origin) {
  var results = [];
  if (!origin || typeof origin !== 'object') return results;
  var kepts = [];
  if (origin.mappable && origin.mappable.target) {
    kepts = (origin.mappable.target || []);
  }

  function filterKeys(key) {
    var excluded = [
      'mappable',
      'parent',
      'collection',
      origin.idAttribute,
      origin.typeAttribute
    ];
    return excluded.indexOf(key) < 0 && kepts.indexOf(key) > -1;
  }

  var proto = origin.constructor && origin.constructor.prototype ? origin.constructor.prototype : {};
  var propNames = Object.keys(proto._definition || {});
  var childNames = Object.keys(proto._children || {});
  var collectionNames = Object.keys(proto._collections || {});

  propNames.concat(childNames)
    .filter(filterKeys)
    .forEach(function(key) {
      var sub = targetSuggestions(origin[key]);
      if (!sub.length) {
        if (childNames.indexOf(key) < 0) {
          results.push(key);
        }
        return;
      }

      results = results.concat(sub.map(function(name) {
        return key + '.' + name;
      }));
    });

  kepts.concat(collectionNames)
    .filter(filterKeys)
    .forEach(function(collectionName) {
      if (!origin[collectionName] || typeof origin[collectionName].forEach !== 'function') return;

      origin[collectionName].forEach(function(model) {
        var id = model.getId();
        var suggestions = targetSuggestions(model);
        results = results.concat(suggestions.filter(filterEmpty).map(function(name) {
          return collectionName + '.' + id + '.' + name;
        }));
      });
    });

  return uniq(results);
}


/**********************************************************************************\
 *                                                                                *
 *                                                                                *
\**********************************************************************************/
var EmitterTargetView = View.extend({
  template: `<div class="mapping-emitter-target-view columns">
  <div class="column"><input type="text" name="target-path" /></div>
  <div class="column no-grow"><button name="remove-target" class="vfi-trash-empty"></button></div>
</div>`,

  bindings: {
    'model.path': {
      type: 'value',
      selector: '[name="target-path"]'
    }
  },

  events: {
    'focus [name="target-path"]': '_handleTargetPathFocus',
    'change [name="target-path"]': '_handleTargetPathChange',
    'click [name="remove-target"]': '_handleRemoveTarget'
  },

  _handleTargetPathFocus: function(evt) {
    var targetView = this;
    var rootView = targetView.rootView;
    var suggestions = targetSuggestions({layers: rootView.model.layers, signals: rootView.signals, mappable: {target: ['layers', 'signals']}});
    var index = targetView.collection.indexOf(targetView.model);
    var mapping = targetView.parent.model;
    rootView.suggestionHelper.attach(evt.target, function(selected) {
      mapping.targets[index] = selected;
      targetView.parent.updateWorkerMapping();
      rootView.suggestionHelper.detach();
    }).fill(suggestions);
  },

  _handleTargetPathChange: function(evt) {
    this.model.path = evt.target.value;
    this.parent.updateWorkerMapping();
  },

  _handleRemoveTarget: function() {
    this.collection.remove(this.model);
    this.parent.updateWorkerMapping();
  }
});


/**********************************************************************************\
 *                                                                                *
 *                                                                                *
\**********************************************************************************/
var EmitterView = View.extend({
  initialize: function() {
    this.listenToAndRun(this.model, 'change:targets', function() {
      this.targets.reset((this.model.targets || []).map(function(path) {
        return {path: path};
      }));
    });
  },

  collections: {
    targets: Collection.extend({
      model: State.extend({
        props: {
          path: 'string'
        }
      })
    })
  },

  template: `<section class="mapping-emitter-view">
  <header class="columns">
    <div class="column emitter-name gutter"></div>
    <div class="column no-grow"><button name="edit-transform-function" class="vfi-code"></button></div>
    <div class="column"><input type="text" name="emitter-source" /></div>
    <div class="column no-grow"><button name="remove-emitter" class="vfi-trash-empty"></button></div>
  </header>
  <div class="columns">
    <div class="column"><input type="text" name="new-emitter-target" placeholder="new target path" /></div>
    <div class="column no-grow"><button name="add-emitter-target" class="vfi-plus"></button></div>
  </div>
  <div class="items"></div>
</section>`,

  bindings: {
    'model.name': '.emitter-name',
    'model.source': {
      type: 'value',
      selector: '[name="emitter-source"]'
    }
  },

  events: {
    'click [name="remove-emitter"]': '_handleRemoveEmitter',
    'focus [name="new-emitter-target"]': '_handleEmitterTargetPathFocus',
    'click [name="add-emitter-target"]': '_handleAddEmitterTarget',
    'click [name="edit-transform-function"]': '_handleEditEmitterTransform'
  },

  _handleRemoveEmitter: function() {
    this.rootView.sendCommand('removeMapping', {name: this.model.getId()});
  },

  updateWorkerMapping: function(serialized) {
    if (!serialized) {
      serialized = this.model.serialize();
      serialized.targets = this.targets.serialize().map(function(obj) { return obj.path; });
    }
    this.rootView.sendCommand('updateMapping', {mapping: serialized});
  },

  _handleEmitterTargetPathFocus: function(evt) {
    var view = this;
    var rootView = view.rootView;
    var suggestions = targetSuggestions({layers: rootView.model.layers, signals: rootView.signals, mappable: {target: ['layers', 'signals']}});

    rootView.suggestionHelper.attach(evt.target, function(selected) {
      evt.target.value = selected;
      view._handleAddEmitterTarget();
      rootView.suggestionHelper.detach();
    }).fill(suggestions);
  },

  _handleAddEmitterTarget: function() {
    var el = this.query('[name="new-emitter-target"]');
    if (this.model.targets.indexOf(el.value) < 0) {
      this.targets.add({path: el.value});
      this.updateWorkerMapping();
    }
    el.value = '';
  },

  _handleEditEmitterTransform: function() {
    var mappingView = this;
    var rootView = this.rootView;
    var editor = rootView.getEditor();
    var model = this.model;
    editor.editCode({
      script: (model.transformFunction || function(val) { return val; }).toString(),
      autoApply: true,
      language: 'javascript',
      onvalidchange: function doneEditingTransformFunction(str) {
        var mapping = model.serialize();
        mapping.transformFunction = str;
        mappingView.updateWorkerMapping(mapping);
      }
    });
  },

  subviews: {
    mappingsList: {
      waitFor: 'targets',
      selector: '.items',
      prepareView: function(el) {
        return this.renderCollection(this.targets, EmitterTargetView, el);
      }
    }
  },

  derived: {
    codeEditor: {
      deps: ['rootView'],
      fn: function () {
        return this.rootView.codeEditor;
      }
    }
  }
});


/**********************************************************************************\
 *                                                                                *
 *                                                                                *
\**********************************************************************************/
var MappingsControlView = View.extend({
  template: `<section class="mappings-view">
  <header>
    <div class="add-form columns">
      <div class="column add-form--name">
        <input placeholder="new mapping name" name="new-source-name" />
      </div>

      <div class="column add-form--source-path">
        <input placeholder="new source event" name="new-source-path" />
      </div>

      <div class="column no-grow">
        <button name="add-mapping" class="vfi-plus"></button>
      </div>
    </div>
  </header>

  <div class="items"></div>
</section>`,

  events: {
    'focus [name=new-source-path]': '_handleSourceFocus',
  },

  _handleSourceFocus: function(evt) {
    var rootView = this.rootView;
    var helper = rootView.suggestionHelper;
    var midiSources = this.rootView.midiSources();

    var results = [];
    rootView.signals.forEach(function(model) {
      var id = model.getId();
      results = results.concat(sourceSuggestions(model).filter(filterEmpty).map(function(name) {
        return 'signals.' + id + '.' + name;
      }));
    });

    results = midiSources.concat(results);

    helper.attach(evt.target, function(selected) {
      evt.target.value = selected;
      helper.detach();
    }).fill(results);
  },

  commands:{
    'click [name="add-mapping"]': 'addMapping _handleAddMapping'
  },

  _handleAddMapping: function() {
    return {
      mapping: {
        name: this.query('[name="new-source-name"]').value,
        source: this.query('[name="new-source-path"]').value
      }
    };
  },


  derived: {
    suggestionHelper: {
      deps: ['rootView'],
      fn: function () {
        return this.rootView.suggestionHelper;
      }
    }
  },

  render: function() {
    View.prototype.render.apply(this, arguments);
    this.mappingsList = this.renderCollection(this.collection, EmitterView, this.query('.items'));
    return this;
  }
});

module.exports = MappingsControlView;

/***/ }),

/***/ 691:
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function toPrct(val) {
  return (100 / 127) * (val || 0);
}

var mappings = {
  prefix: '<something>',

  type: {
    128: 'noteOn',
    144: 'noteOff',
    176: 'change',
    192: 'search',
    248: 'idle'
  },

  note: {
    1: 'k1',
    2: 'k2',
    3: 'k3',
    4: 'k4',
    5: 'k5',
    6: 'k6',
    7: 'k7',
    8: 'k8',

    36: 'p1',
    38: 'p2',
    40: 'p3',
    41: 'p4',
    43: 'p5',
    45: 'p6',
    47: 'p7',
    48: 'p8',
  },

  velocity: {
    0: function(type, note, velocity) {
      if (note > 23) {
        return false;
      }
      return velocity;
    },

    127: function(type, note, velocity) {
      if (note > 23) {
        return true;
      }
      return toPrct(velocity);
    }
  }
};

module.exports = function(data) {
  var type = data[0] || 0;
  if (type === 248) { return {}; }

  var note = data[1] || 0;
  var velocity = data[2] || 0;

  var name = mappings.note[note];
  console.info('MIDI evt on %s (%s) => %s', name, note, velocity, data);
  return {
    name: name,
    velocity: velocity,
    type: type
  };
};
module.exports.note = mappings.note;
module.exports.prefix = mappings.prefix;


/***/ }),

/***/ 692:
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function toPrct(val) {
  return (100 / 127) * (val || 0);
}

var KP3ToggleButoons = [
  49,
  50,
  51,
  52,
  53,
  54,
  55,
  56,

  92,
  95
];

var KP3LetterButoons = [
  36,
  37,
  38,
  39
];

var mappings = {
  prefix: 'kp3',

  type: {
    128: 'noteOn',
    144: 'noteOff',
    176: 'change',
    192: 'search',
    248: 'idle'
  },

  note: {
    36: 'buttonA',
    37: 'buttonB',
    38: 'buttonC',
    39: 'buttonD',

    49: 'num1',
    50: 'num2',
    51: 'num3',
    52: 'num4',
    53: 'num5',
    54: 'num6',
    55: 'num7',
    56: 'num8',

    70: 'padX',
    71: 'padY',
    72: 'pad72',
    73: 'pad73',
    74: 'pad74',
    75: 'pad75',
    76: 'pad76',

    92: 'pad',
    93: 'effectSlider',
    94: 'effectKnob',
    95: 'hold'
  },

  velocity: {
    0: function(type, note, velocity) {
      if (KP3ToggleButoons.indexOf(note) > -1) {
        return false;
      }
      return velocity;
    },

    64: function(type, note, velocity) {
      if (KP3LetterButoons.indexOf(note) > -1) {
        return false;
      }
      return toPrct(velocity);
    },

    100: function(type, note, velocity) {
      if (KP3LetterButoons.indexOf(note) > -1) {
        return true;
      }
      return toPrct(velocity);
    },

    127: function(type, note, velocity) {
      if (KP3ToggleButoons.indexOf(note) > -1) {
        return true;
      }
      return toPrct(velocity);
    }
  },

  signalNames: [
    'buttonA:noteOn',
    'buttonA:noteOff',
    'buttonB:noteOn',
    'buttonB:noteOff',
    'buttonC:noteOn',
    'buttonC:noteOff',
    'buttonD:noteOn',
    'buttonD:noteOff',

    'num1:noteOn',
    'num1:noteOff',
    'num2:noteOn',
    'num2:noteOff',
    'num3:noteOn',
    'num3:noteOff',
    'num4:noteOn',
    'num4:noteOff',
    'num5:noteOn',
    'num5:noteOff',
    'num6:noteOn',
    'num6:noteOff',
    'num7:noteOn',
    'num7:noteOff',
    'num8:noteOn',
    'num8:noteOff',

    'pad:noteOn',
    'pad:noteOff',

    'padX:change',
    'padY:change',
    'pad72:change',
    'pad73:change',
    'pad74:change',
    'pad75:change',
    'pad76:change',

    'effectKnob:change',
    'effectSlider:change'
  ]
};

function _result(note, data) {
  // that sucks! KP3
  if (data[0] === 192) {
    return 'bpmKnob';
  }

  var val = mappings.note[''+note];

  if (typeof val === 'function') {
    return val(data[0], data[1], data[2]);
  }

  return val;
}

module.exports = function(data) {
  var type = data[0] || 0;
  if (type === 248) { return {}; }

  var note = data[1] || 0;
  var velocity = data[2] || 0;

  var name = _result(note, data);
  if (name === 'bpmKnob') {
    velocity = note;
  }
  return {
    name: name,
    velocity: velocity,
    type: type
  };
};
module.exports.note = mappings.note;
module.exports.prefix = mappings.prefix;


/***/ }),

/***/ 693:
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function toPrct(val) {
  return (100 / 127) * (val || 0);
}

var mappings = {
  prefix: 'nk2',

  type: {
    128: 'noteOn',
    144: 'noteOff',
    176: 'change',
    192: 'search',
    248: 'idle'
  },

  note: {
    0: 'slider1',
    1: 'slider2',
    2: 'slider3',
    3: 'slider4',
    4: 'slider5',
    5: 'slider6',
    6: 'slider7',
    7: 'slider8',

    16: 'knob1',
    17: 'knob2',
    18: 'knob3',
    19: 'knob4',
    20: 'knob5',
    21: 'knob6',
    22: 'knob7',
    23: 'knob8',

    32: 's1',
    33: 's2',
    34: 's3',
    35: 's4',
    36: 's5',
    37: 's6',
    38: 's7',
    39: 's8',

    41: 'play',
    42: 'stop',
    43: 'rewind',
    44: 'forward',
    45: 'record',
    46: 'cycle',

    48: 'm1',
    49: 'm2',
    50: 'm3',
    51: 'm4',
    52: 'm5',
    53: 'm6',
    54: 'm7',
    55: 'm8',

    58: 'trackprevious',
    59: 'tracknext',
    60: 'markerset',
    61: 'markerprevious',
    62: 'markernext',

    64: 'r1',
    65: 'r2',
    66: 'r3',
    67: 'r4',
    68: 'r5',
    69: 'r6',
    70: 'r7',
    71: 'r8'
  },

  velocity: {
    0: function(type, note, velocity) {
      if (note > 23) {
        return false;
      }
      return velocity;
    },

    127: function(type, note, velocity) {
      if (note > 23) {
        return true;
      }
      return toPrct(velocity);
    }
  }
};

module.exports = function(data) {
  var type = data[0] || 0;
  if (type === 248) { return {}; }

  var note = data[1] || 0;
  var velocity = data[2] || 0;

  var name = mappings.note[note];
  // console.info('nk2 MIDI evt on %s (%s) => %s', name, note, velocity, type);
  return {
    name: name,
    velocity: velocity,
    type: type
  };
};
module.exports.note = mappings.note;
module.exports.prefix = mappings.prefix;


/***/ }),

/***/ 694:
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* global module, console */


function toPrct(val) {
  return (100 / 127) * (val || 0);
}

var mappings = {
  prefix: '<something>',

  type: {
    128: 'noteOn',
    144: 'noteOff',
    176: 'change',
    192: 'search',
    248: 'idle'
  },

  note: {
    0: 'pA1',
    1: 'pA2',
    2: 'pA3',
    3: 'pA4',
    4: 'pA5',
    5: 'pA6',
    6: 'pA7',
    7: 'pA8',

    16: 'pB1',
    17: 'pB2',
    18: 'pB3',
    19: 'pB4',
    20: 'pB5',
    21: 'pB6',
    22: 'pB7',
    23: 'pB8',

    32: 'pC1',
    33: 'pC2',
    34: 'pC3',
    35: 'pC4',
    36: 'pC5',
    37: 'pC6',
    38: 'pC7',
    39: 'pC8',

    48: 'pD1',
    49: 'pD2',
    50: 'pD3',
    51: 'pD4',
    52: 'pD5',
    53: 'pD6',
    54: 'pD7',
    55: 'pD8',

    64: 'pE1',
    65: 'pE2',
    66: 'pE3',
    67: 'pE4',
    68: 'pE5',
    69: 'pE6',
    70: 'pE7',
    71: 'pE8',

    80: 'pF1',
    81: 'pF2',
    82: 'pF3',
    83: 'pF4',
    84: 'pF5',
    85: 'pF6',
    86: 'pF7',
    87: 'pF8',

    96: 'pI1',
    97: 'pI2',
    98: 'pI3',
    99: 'pI4',
    100: 'pI5',
    101: 'pI6',
    102: 'pI7',
    103: 'pI8',

    112: 'pJ1',
    113: 'pJ2',
    114: 'pJ3',
    115: 'pJ4',
    116: 'pJ5',
    117: 'pJ6',
    118: 'pJ7',
    119: 'pJ8',
  },

  velocity: {
    0: function(type, note, velocity) {
      if (note > 23) {
        return false;
      }
      return velocity;
    },

    127: function(type, note, velocity) {
      if (note > 23) {
        return true;
      }
      return toPrct(velocity);
    }
  },

  signalNames: [
  ]
};

module.exports = function(data) {
  var type = data[0] || 0;
  if (type === 248) { return {}; }

  var note = data[1] || 0;
  var velocity = data[2] || 0;

  var name = mappings.note[note];
  return {
    name: name,
    velocity: velocity,
    type: type
  };
};
module.exports.note = mappings.note;
module.exports.prefix = mappings.prefix;


/***/ }),

/***/ 695:
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var SignalState = __webpack_require__(652);

var BeatState = SignalState.types.beat = SignalState.extend({
  initialize: function() {
    SignalState.prototype.initialize.apply(this, arguments);
    this.listenTo(this.collection, 'frametime', function(frametime) {
      this.frametime = frametime;
    });
  },

  session: {
    frametime: ['number', true, 0]
  },

  mappable: {
    source: ['result', 'timeBetweenBeats', 'beatNum'],
    target: ['input']
  },

  derived: {
    result: {
      deps: ['timeBetweenBeats', 'frametime'],
      fn: function() {
        return this.computeSignal();
      }
    },
    beatNum: {
      deps: ['timeBetweenBeats', 'frametime'],
      fn: function() {
        return this.frametime ? Math.floor(this.frametime / this.timeBetweenBeats) : 0;
      }
    },
    timeBetweenBeats: {
      deps: ['input'],
      fn: function() {
        return (60 * 1000) / Math.max(this.input, 1);
      }
    }
  },

  computeSignal: function() {
    var ft = this.frametime;
    var tbb = this.timeBetweenBeats;
    return !ft ? 0 : (100 - (((ft % tbb) / tbb) * 100));
  }
});

module.exports = BeatState;

/***/ }),

/***/ 696:
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var assign = __webpack_require__(33);
var DetailsView = __webpack_require__(655);
var SignalDetailsView = DetailsView.extend({
  derived: {
    modelPath: {
      deps: [],
      fn: function() {
        return 'signals.' + this.model.getId();
      }
    }
  },

  bindings: assign({
    'model.name': '[data-hook=name]'
  }, DetailsView.prototype.bindings)
});
module.exports = SignalDetailsView;

/***/ }),

/***/ 697:
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var SignalState = __webpack_require__(652);

var _360 = {
  type: 'number',
  required: true,
  default: 180,
  min: 0,
  max: 360
};
var _100 = {
  type: 'number',
  required: true,
  default: 100,
  min: 0,
  max: 100
};

var HSLASignalState = SignalState.types.hsla = SignalState.extend({
  props: {
    hue: _360,
    saturation: _100,
    lightness: _100,
    alpha: _100
  },

  mappable: {
    source: ['result', 'hue', 'saturation', 'lightness', 'alpha'],
    target: ['hue', 'saturation', 'lightness', 'alpha']
  },

  derived: {
    result: {
      deps: ['hue', 'saturation', 'lightness', 'alpha'],
      fn: function() {
        return this.computeSignal();
      }
    }
  },
  // parseInput: function() {
  //   var values = _colorValues(this.input);
  //   return {
  //     hue: values[0],
  //     saturation: values[1],
  //     lightness: values[2],
  //     alpha: values[3]
  //   };
  // },
  computeSignal: function() {
    return 'hsla(' + Math.round(this.hue) + ',' + Math.round(this.saturation) + '%,' + Math.round(this.lightness) + '%,' + (Math.round(this.alpha) / 100) + ')';
  }
});

module.exports = HSLASignalState;

/***/ }),

/***/ 698:
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var SignalState = __webpack_require__(652);
var _255 = {
  type: 'number',
  required: true,
  default: 180,
  min: 0,
  max: 255
};
var _100 = {
  type: 'number',
  required: true,
  default: 100,
  min: 0,
  max: 100
};
var RGBASignalState = SignalState.types.rgba = SignalState.extend({
  props: {
    red: _255,
    green: _255,
    blue: _255,
    alpha: _100
  },

  mappable: {
    source: ['result', 'red', 'green', 'blue', 'alpha'],
    target: ['red', 'green', 'blue', 'alpha']
  },

  derived: {
    result: {
      deps: ['red', 'green', 'blue', 'alpha'],
      fn: function() {
        return this.computeSignal();
      }
    }
  },
  // parseInput: function() {
  //   var values = _colorValues(this.input);
  //   return {
  //     red: values[0],
  //     green: values[1],
  //     blue: values[2],
  //     alpha: values[3]
  //   };
  // },
  computeSignal: function() {
    return 'rgba(' + Math.round(this.red) + ',' + Math.round(this.green) + ',' + Math.round(this.blue) + ',' + (Math.round(this.alpha) / 100) + ')';
  }
});
module.exports = RGBASignalState;

/***/ }),

/***/ 699:
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var View = __webpack_require__(648);

var SignalControlView = __webpack_require__(265);
__webpack_require__(275);
__webpack_require__(267);
__webpack_require__(276);

var SignalsView = View.extend({
  commands: {
    'click [name="add-signal"]': 'addSignal _addSignal'
  },
  events:{
    'focus [data-hook="signal-type"]': '_suggestSignalType'
  },

  _suggestSignalType: function() {
    var helper = this.parent.suggestionHelper;
    var el = this.queryByHook('signal-type');
    helper.attach(this.queryByHook('signal-type'), function(selected) {
      el.value = selected;
      helper.detach();
    }).fill([
      'default',
      'beat',
      'hsla',
      'rgba'
    ]);
  },

  _addSignal: function() {
    var typeEl = this.queryByHook('signal-type');
    var nameEl = this.queryByHook('signal-name');
    var type = typeEl.value;
    var name = nameEl.value;
    return {
      signal: {
        type: type,
        name: name
      }
    };
  },

  subviews: {
    items: {
      selector: '.items',
      waitFor: 'el',
      prepareView: function(el) {
        return this.renderCollection(this.collection, function (opts) {
          var type = opts.model.getType();
          var Constructor = SignalControlView.types[type] || SignalControlView;
          return new Constructor(opts);
        }, el);
      }
    }
  },

  template: `
    <section class="row signals">
      <header class="columns">
        <div class="column">
          <input data-hook="signal-name" placeholder="Name" type="text"/>
        </div>
        <div class="column">
          <input data-hook="signal-type" placeholder="Type" type="text"/>
        </div>
        <div class="column no-grow">
          <button name="add-signal" class="vfi-plus"></button>
        </div>
      </header>
      <div class="items"></div>
    </section>
  `
});
module.exports = SignalsView;

/***/ })

});
//# sourceMappingURL=3-build.js.map