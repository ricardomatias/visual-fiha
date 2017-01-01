'use strict';
var View = VFDeps.View;

var LayerControlView = require('./../layer/control-view');
require('./../layer/canvas/control-view');

var LayersView = View.extend({
  autoRender: true,

  events: {
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

  template: '<div class="row layers">'+
              '<div class="section-name gutter-vertical">Layers</div>'+
              '<div class="columns">'+
                '<div class="column">' +
                  '<input data-hook="layer-name" placeholder="Name" type="text"/>'+
                '</div>' +
                '<div class="column">' +
                  '<input data-hook="layer-type" placeholder="Type" type="text"/>'+
                '</div>' +
                '<div class="column no-grow">'+
                  '<button name="add-layer" class="vfi-plus"></button>'+
                '</div>'+
              '</div>'+
              '<div class="items"></div>'+
            '</div>',

  render: function() {
    if (!this.rendered) {
      this.renderWithTemplate();
    }
    return this;
  }
});
module.exports = LayersView;