(function(){

  'use strict';

  /**
   * Data model for visualization
   * Data is loaded from an external .csv file
   */
  var Model = {

    dataSrc: 'data/stations4.csv'

  };

  /**
   * Controller for the map visualization
   */
  var Controller = {

    data: null, // to be populated with data from external .csv resource

    params: {
      width: 1200,
      height: 900
    },

    /**
     * Initialize the controller
     */
    init: function(){

      this.makeMap();

      // Initialize the views 
      View.init();
      NavigationView.init();

      this.loadData();

    },

    loadData: function(){

      var self = this;

      d3.csv( Model.dataSrc , function(error, data) {

        if (error) {
          console.log(error);
        } else {
          self.data = data;
          View.render('TSR');
        } 

      });

    },

    /**
     * Rerender dots based on whether user has selected TSR or # of products
     * @param {string} type - TSR or products
     */
    updateBubbleSizes: function(type){
      View.render(type);
    },

    /**
     * Filter which stations should be rendered based on user input.
     * @param {string} str - Name of the filter to apply
     */
    switchFilters: function(str){
      d3.selectAll('.hidden').classed('hidden', false);
      switch (str){
        case 'corepub':
          View.filter('Core Publisher')
          break;
        case 'composer':
          View.filter('Composer Pro');
          break;
        case 'springboard':
          View.filter('Springboard Donation Forms');
          break;
        default: 
          d3.selectAll('.hidden').classed('hidden', false);
      }
    },

    getData: function(){
      return this.data;
    },

    /**
     * Get map projection based on d3.geo module
     * @returns {object} - an instance of d3.geo.albersUsa
     */
    getProjection: function(){
      return this.projection;
    },

    /**
     * Load mapping data and tell view to render map
     */
    makeMap: function(){

      var scale = 1.5; // make map larger than default.

      // set projection
      this.projection = d3.geo.albersUsa();

      this.projection.scale(1000 * scale);
      this.projection.translate([400*scale,250*scale]); 

      var path = d3.geo.path().projection(this.projection);

      d3.json("data/us.json", function (error, topology) {
        View.renderMap(topology, path);
      });
    },

  };

  /**
   * Map View with dots representing stations
   */
  var View = {

    tooltip: null,

    max: 100,

    min: 0,

    projection: null,

    /**
     * Create markup for tooltip based on station data
     * @param {obj} d - data object for selected station.
     * @returns {string} markup - Text for the tooltip.
     */
    getTooltipMarkup: function(d){

      var mk = "<h3>title</h3>" +
        "<h5>Uses numProducts DS products</h5>" + 
        "<img src='imgsrc'>";

      var mapObj = {
        title: d.name.replace(/-FM|-AM/, ''),
        imgsrc: "http://media.npr.org/images/stations/logos/" + 
              d.name.toLowerCase().replace('-','_') + ".gif",
        numProducts: d['total products']
      };

      return mk.replace(/title|numProducts|imgsrc/gi, function(matched){
        return mapObj[matched];
      });

    },

    /**
     * Initialize View
     * Create tooltip; append <svg> and <g> to the DOM.
     */
    init: function(){

      // Create tool tip
      this.tooltip = d3.select("body").append("div")   
        .attr("class", "tooltip")               
        .style("opacity", 0);

      this.svg = d3.select("body").append("svg")
          .attr("width", Controller.params.width)
          .attr("height", Controller.params.height);

      this.g = this.svg.append('g')
              .call(d3.behavior.zoom()
                  .scaleExtent([1, 10])
                  .on("zoom", zoom)
              );

      this.projection = Controller.getProjection();
    },

    /**
     * Render the map
     * @param {object} topology - data from US map
     * @param {object} path - outline data based on geo projection (e.g. Albers)
     */
    renderMap: function(topology, path){
       this.g.selectAll("path")
            .data(topojson.feature(topology, topology.objects.states).features)
            .enter().append("path")
            .attr("d", path);
    },

    /**
     * Hide and show station dots based on user interaction
     */
    filter: function(filterText){
      var dots = this.svg.selectAll("circle").data(Controller.getData());
      dots.filter(function(d) { 
          if (d[filterText]==0) { 
            return this;
          } else {
            return null;
          }
        })
        .classed('hidden', true);
    },

    /**
     * Render dots on the map
     * @param {string} type - Render dot size according to TSR or some other property
     */
    render: function(type){

      var self = this;

      var div = this.tooltip,
          _data = Controller.getData();

      var dots = this.svg.selectAll("circle").data(_data);

      var renderFunc; 

      if (type == 'TSR'){
        renderFunc = 'renderByTSR';
      } else {
        renderFunc = 'renderByProducts';
      }

      this[renderFunc](dots); //this[getScaleFn](dots);

      dots.on("mouseover", function(d){ 
          d3.select(this).classed('active', true);
          div.transition()        
            .duration(200)      
            .style("opacity", .9); 
          var markup = self.getTooltipMarkup(d);
          div.html(markup)
            .style("left", (d3.event.pageX) + "px")     
            .style("top", (d3.event.pageY - 28) + "px");    
        })
        .on("mouseout", function(d){
          d3.select(this).classed('active', false);
          div.transition()        
            .duration(200)      
            .style("opacity", 0); 
        })
        .on("click", function(d){
          console.dir(d['product names'].split(', '));
        });

      dots.each(function(d,i){
        var node = d3.select(this);
        var r = node.attr("r"),
          nx1 = node.attr("cx") - r,
          nx2 = node.attr("cx") + r,
          ny1 = node.attr("cy") - r,
          ny2 = node.attr("cy") + r;
      });
    },

    /**
     * Render dot sizes based on TSR
     * @param {obj} dots - data mapped to <circle> elements
     * TODO: refactor out duplication between this function and renderbyproducts
     */
    renderByTSR: function(dots){

      var projection = Controller.getProjection();

      var max = d3.max(Controller.getData(), function(d) {
        return Number(d.TSR);
      });

      var min = d3.min(Controller.getData(), function(d) {
        return Number(d.TSR);
      });

      var scale = d3.scale.linear(),
          domain = scale.domain([min, max]),
          range = scale.range([2, 36]);
       
      dots.enter()
        .append("circle")
        .attr("cx", function (d) { return projection([d.longitude,d.latitude])[0]; })
        .attr("cy", function (d) { return projection([d.longitude,d.latitude])[1]; })
        .attr("r", 0)
        .attr("fill", "hsla(205,75%,60%,1")
        .transition()
          .duration(1250)
          .attr("r", function(d) {
            return scale(d.TSR);
          });

        dots.transition()
          .delay(function(d, i){
              return i*4;
          })
          .ease("bounce")
          .duration(500)
          .attr("r", function(d) {
            return scale(d.TSR);
            });
    },

    renderByProducts: function(dots){

      var projection = Controller.getProjection();

      var max = d3.max(Controller.getData(), function(d) {
        return Number(d['total products']);
      });

      var min = d3.min(Controller.getData(), function(d) {
        return Number(d['total products']);
      });

      var scale = d3.scale.linear(),
          domain = scale.domain([min, max]),
          range = scale.range([2, 36]);
       
      dots.enter()
        .append("circle")
        .attr("cx", function (d) { return projection([d.longitude,d.latitude])[0]; })
        .attr("cy", function (d) { return projection([d.longitude,d.latitude])[1]; })
        .attr("r", 0)
        .attr("fill", "hsla(205,75%,60%,1")
        .transition()
          .duration(1250)
          .attr("r", function(d) {
            return scale(d['total products']);
          });

        dots.transition()
          .delay(function(d, i){
              return i*4;
          })
          .ease("bounce")
          .duration(500)
          .attr("r", function(d) {
            return scale(d['total products']);
            });

    }

  }

  var NavigationView = {

    init: function(){
      
      $('[data-filter=all]').addClass('active');

      $('[data-filter]').on('click', function(e){
        if (!$(this).hasClass('active')){
          $('.active').removeClass('active');
          $(this).addClass('active');  
          Controller.switchFilters($(this).attr('data-filter'));
        }
      });

    }

  }

  Controller.init();

  $('input:radio').on('click', function(e){
    if(e.target.checked){
      Controller.updateBubbleSizes(e.target.value);
    }
  })

  // Replace source
  $('img').error(function(){
    $(this).hide();
  });

  function zoom() {
      g.attr("transform", "translate("
              + d3.event.translate
              + ")scale(" + d3.event.scale + ")");
  }

})();