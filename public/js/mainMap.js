//tippecanoe geo_timeseries_masked_original.json -pf -pk -Bg -d9 -D7 -g4 -rg -o t.mbtiles
// how to do it with leaflet -
/*var map = L.map("map-container").setView([51.505, -0.09], 13);

L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
    attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
    maxZoom: 18,
    id: 'kjjj11223344.p8g6k9ha',
    accessToken: "pk.eyJ1Ijoia2pqajExMjIzMzQ0IiwiYSI6ImNpbDJqYXZ6czNjdWd2eW0zMTA2aW1tNXUifQ.cPofQqq5jqm6l4zix7k6vw"
}).addTo(map);*/

// TODO: date functions need serious refactoring

var currentPoint = 1;
var currentArea = null;
var file = "/home/vagrant/code/insar_map_mvc/public/json/geo_timeseries_masked.h5test_chunk_";
var firstToggle = true;
var myPolygon = null;
var areaAttributesPopup = new AreaAttributesPopup();

// take an array of displacement values and return velocity standard deviation (confuses the heck out of me)
var getStandardDeviation = function(displacements, slope) {
    var v_std = 0.0;
    for (i = 0; i < displacements.length; i++) {
        v_std += (Math.abs(slope - displacements[i]) * Math.abs(slope - displacements[i]));
    }
    return Math.sqrt(v_std / (displacements.length - 1));
}

// falk's date string is in format yyyymmdd - ex: 20090817 
var customDateStringToJSDate = function(dateString) {
    var year = dateString.substr(0, 4);
    var month = dateString.substr(4, 2);
    var day = dateString.substr(6, 2);
    return new Date(year, month - 1, day);
}

// take an array of these string dates and return an array of date objects
var convertStringsToDateArray = function(date_string_array) {
    var date_array = [];
    for (var i = 0; i < date_string_array.length; i++) {
        date_array.push(customDateStringToJSDate(date_string_array[i].toString()));
    }
    return date_array;
}

// find how many days have elapsed in a date object
var getDaysElapsed = function(date) {
    var date2 = new Date(date.getFullYear(), 01, 1);
    var timeDiff = Math.abs(date.getTime() - date2.getTime());
    return Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
}

// take displacements, decimal dates, and slope of linear regression line
// returns array of numbers = (displacements - slope * decimal dates)
var getlinearDetrend = function(displacements, decimal_dates, slope) {
    detrend_array = [];
    for (i = 0; i < decimal_dates.length; i++) {
        detrend = displacements[i] - (slope * (decimal_dates[i] - decimal_dates[0]))
        detrend_array.push(detrend);
    }
    return detrend_array;
}

var dateToDecimal = function(date) {
    return date.getFullYear() + getDaysElapsed(date) / 365;
}

// convert date in decimal - for example, 20060131 is Jan 31, 2006
// 31 days have passed so decimal format = [2006 + (31/365)] = 2006.0849
// take an array of date objects and return an array of date decimals
var convertDatesToDecimalArray = function(date_array) {
    var decimals = [];
    for (i = 0; i < date_array.length; i++) {
        decimals.push(dateToDecimal(date_array[i]));
    }
    return decimals;
}

// takes displacements and dates, returns slope and y intercept in array
function calcLinearRegression(displacements, decimal_dates) {
    data = [];
    for (i = 0; i < decimal_dates.length; i++) {
        // data.push([displacements[i], decimal_dates[i]]);
        data.push([decimal_dates[i], displacements[i]]);
    }
    var result = regression('linear', data);
    return result;
}

// takes slope, y-intercept; decimal_dates and chart_data(displacement) must
// this.start and end around bounds of the sliders
function getRegressionChartData(slope, y, decimal_dates, chart_data) {
    var data = [];
    var first_date = chart_data[0][0];
    var first_reg_displacement = slope * decimal_dates[0] + y;
    var last_date = chart_data[chart_data.length - 1][0];
    var last_reg_displacement = slope * decimal_dates[decimal_dates.length - 1] + y;
    data.push([first_date, first_reg_displacement]);
    data.push([last_date, last_reg_displacement]);
    return data;
}

// returns an array of [date, displacement] objects
function getDisplacementChartData(displacements, dates) {
    var data = [];
    for (i = 0; i < dates.length; i++) {
        var year = parseInt(dates[i].toString().substr(0, 4));
        var month = parseInt(dates[i].toString().substr(4, 2));
        var day = parseInt(dates[i].toString().substr(6, 2));
        data.push([Date.UTC(year, month - 1, day), displacements[i]]);
    }
    return data;
}

function MapController(loadJSONFunc) {
    // my mapbox api key
    mapboxgl.accessToken = "pk.eyJ1Ijoia2pqajExMjIzMzQ0IiwiYSI6ImNpbDJqYXZ6czNjdWd2eW0zMTA2aW1tNXUifQ.cPofQqq5jqm6l4zix7k6vw";
    this.startingZoom = 1.6;
    this.startingCoords = [0, 30];
    // the map
    this.map = null;
    this.geoJSONSource = null;
    this.geodata = null;
    this.geoDataMap = {};
    // maps maintain insertion order. especially useful for maintaining layer orders
    this.layers_ = new Map();
    this.sources = new Map(); // we use this map as a queue of modes, where the last entry is the recoloring mode we are in
    this.loadJSONFunc = loadJSONFunc;
    this.tileURLID = "kjjj11223344.4avm5zmh";
    this.tileJSON = null;
    this.clickLocationMarker = {
        type: "geojson",
        data: {}
    };
    this.clickLocationMarker2 = {
        type: "geojson",
        data: {}
    };
    this.selector = null;
    this.areaFilterSelector = null;
    this.zoomOutZoom = 7.0;
    this.graphsController = new GraphsController(this);
    this.areas = null;
    this.areaFeatures = null;
    this.allAreaFeatures = null;
    this.colorScale = new ColorScale(-2.00, 2.00, "color-scale");
    this.colorScale.onScaleChange(function(minValue, maxValue) {
        // if they are loaded, refresh them. if aren't loaded, nothing
        // will happen
        this.refreshDataset();
        this.thirdPartySourcesController.refreshmidasGpsStationMarkers();
        var selectedColoring = $("#seismicity-color-on-dropdown").val();
        this.thirdPartySourcesController.recolorSeismicities(selectedColoring);

        // if time is selected, convert to milliseconds
        if (selectedColoring == "time") {
            this.seismicityGraphsController.createChart(selectedColoring, "depth-vs-long-graph", null, null);
            this.seismicityGraphsController.createChart(selectedColoring, "lat-vs-depth-graph", null, null);
        } else {
            this.seismicityGraphsController.createChart(selectedColoring, "cumulative-events-vs-date-graph", null, null);
            this.seismicityGraphsController.createChart(selectedColoring, "lat-vs-long-graph", null, null);
        }
    }.bind(this));
    this.colorOnDisplacement = false;
    this.lastAreasRequest = null;

    this.areaMarkerLayer = new AreaMarkerLayer(this);

    this.thirdPartySourcesController = new ThirdPartySourcesController(this);
    this.seismicityGraphsController = new CustomSliderSeismicityController();

    this.areaPopup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false
    });

    this.elevationPopup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false
    });

    this.gpsStationNamePopup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false
    });

    this.gpsStationPopup = new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: false
    });

    this.cancellableAjax = new CancellableAjax();

    this.previousZoom = this.startingZoom;

    this.addSource = function(id, source) {
        this.sources.set(id, source);
        this.map.addSource(id, source);
    };

    this.removeSource = function(id) {
        this.sources.delete(id);
        this.map.removeSource(id);
    };

    this.addLayer = function(newLayer, before) {
        // handle when before layerID is supplied
        if (before) {
            var tempLayers = new Map();
            this.layers_.forEach(function(layer, layerID) {
                if (layerID === before) {
                    tempLayers.set(newLayer.id, newLayer);
                }

                tempLayers.set(layerID, layer);
            });
            this.layers_ = tempLayers;
        } else {
            this.layers_.set(newLayer.id, newLayer);
        }
        this.map.addLayer(newLayer, before);
    };

    this.removeLayer = function(id) {
        this.layers_.delete(id);
        this.map.removeLayer(id);
    };

    this.getInsarLayers = function() {
        var pointLayers = [];

        if (currentArea) {
            for (var i = 1; i <= currentArea.properties.num_chunks; i++) {
                pointLayers.push("chunk_" + i);
            }

            return pointLayers;
        }
        return null;
    };

    this.getCurrentMode = function() {
        var allSources = Array.from(this.sources);

        for (var i = allSources.length - 1; i >= 0; i--) {
            var latestMode = allSources[i][0];
            if (this.thirdPartySourcesController.seismicities.includes(latestMode)) {
                return "seismicity";
            }

            if (this.thirdPartySourcesController.gps.includes(latestMode)) {
                return "gps";
            }

            if (latestMode === "insar_vector_source") {
                return "insar";
            }
        }

        // otherwise
        return null;
    };

    this.getLayerIDsInCurrentMode = function() {
        var allSources = Array.from(this.sources);

        for (var i = allSources.length - 1; i >= 0; i--) {
            var latestMode = allSources[i][0];
            if (this.thirdPartySourcesController.seismicities.includes(latestMode)) {
                var activeLayers = [];
                this.thirdPartySourcesController.seismicities.forEach(function(layerID) {
                    if (this.map.getLayer(layerID)) {
                        activeLayers.push(layerID);
                    }
                }.bind(this));
                return activeLayers;
            }

            if (this.thirdPartySourcesController.gps.includes(latestMode)) {
                var activeLayers = [];
                this.thirdPartySourcesController.gps.forEach(function(layerID) {
                    if (this.map.getLayer(layerID)) {
                        activeLayers.push(layerID);
                    }
                }.bind(this));
                return this.thirdPartySourcesController.gps;
            }

            if (latestMode === "insar_vector_source") {
                return this.getInsarLayers();
            }
        }

        // otherwise
        return null;
    };

    this.disableInteractivity = function() {
        this.map.dragPan.disable();
        this.map.scrollZoom.disable();
        this.map.doubleClickZoom.disable();
    };

    this.enableInteractivity = function() {
        this.map.dragPan.enable();
        this.map.scrollZoom.enable();
        this.map.doubleClickZoom.enable();
    };

    // an alternative: http://wiki.openstreetmap.org/wiki/Zoom_levels
    // don't know if formula applies to gl js projection, though
    this.calculateDegreesPerPixelAtCurrentZoom = function(lat) {
        var deltaPixels = 100.0;
        var point1Projected = { x: 0.0, y: 0.0 };
        var point2Projected = { x: 0.0, y: deltaPixels };

        var point1UnProjected = this.map.unproject(point1Projected);
        var point2UnProjected = this.map.unproject(point2Projected);

        // we only care about delta degrees in y direction. if innacurate,
        // take x direction into account
        // we do 1 - 2 because y axis, and thus unprojected points, is reversed
        var deltaDegrees = point1UnProjected.lat - point2UnProjected.lat;

        return deltaDegrees / deltaPixels;
    };

    this.clickOnAPoint = function(e) {
        var features = this.map.queryRenderedFeatures(e.point);

        if (!features.length) {
            return;
        }

        var feature = features[0];
        var id = feature.layer.id;

        if (id === "gpsStations" || id === "midas") {
            var coordinates = feature.geometry.coordinates;
            this.gpsStationPopup.remove();
            this.gpsStationPopup.setLngLat(coordinates)
                .setHTML(feature.properties.popupHTML)
                .addTo(this.map);

            return;
        }

        if (this.getCurrentMode() === "gps" && id === "midas-arrows") {
            this.thirdPartySourcesController.subtractArrowMagnitudeFromArrows(feature);
        }

        // clicked on area marker, reload a new area.
        var markerSymbol = feature.properties["marker-symbol"];
        if (markerSymbol == "marker" || markerSymbol == "fillPolygon") {
            this.removePoints();

            this.removeTouchLocationMarkers();
            this.clickOnAnAreaMarker(e);
            return;
        }

        var long = feature.geometry.coordinates[0];
        var lat = feature.geometry.coordinates[1];
        var pointNumber = feature.properties.p;

        currentPoint = pointNumber;

        if (pointNumber === undefined || pointNumber === null || feature.layer.id == "contours" || feature.layer.id == "contour_label") {
            return;
        }

        var title = pointNumber.toString();
        var query = {
            "area": currentArea.properties.unavco_name,
            "pointNumber": pointNumber
        };

        var chartContainer = "chartContainer";
        var clickMarker = this.clickLocationMarker;
        var markerSymbol = "cross";

        if (this.graphsController.selectedGraph == "Bottom Graph") {
            chartContainer = "chartContainer2";
            clickMarker = this.clickLocationMarker2;
            markerSymbol += "Red";
        }

        var layerID = this.graphsController.selectedGraph;

        clickMarker.data = {
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [long, lat]
                },
                "properties": {
                    "marker-symbol": markerSymbol
                }
            }]
        };

        // show cross on clicked point
        if (this.map.getLayer(layerID)) {
            this.removeSourceAndLayer(layerID);
        }

        this.addSource(layerID, clickMarker);
        this.addLayer({
            "id": layerID,
            "type": "symbol",
            "source": layerID,
            "layout": {
                "icon-image": "{marker-symbol}-15",
            }
        });

        var pointDetailsHtml = lat.toFixed(5) + ", " + long.toFixed(5);

        $("#point-details").html(pointDetailsHtml);

        $("#search-form-and-results-minimize-button").click();

        // load displacements from server, and then show on graph
        loadJSONFunc(query, "point", function(response) {
            $("#graph-div-maximize-button").click();

            var json = JSON.parse(response);
            this.graphsController.JSONToGraph(json, chartContainer, e);

            // request elevation of point from google api
            var elevationGetter = new google.maps.ElevationService;
            elevationGetter.getElevationForLocations({
                "locations": [{ lat: lat, lng: long }]
            }, function(results, status) {
                if (status === google.maps.ElevationStatus.OK) {
                    // redundant but to avoid race conditions between two successive clicks
                    $("#point-details").html(pointDetailsHtml);
                    $("#point-details").append("<br>Elevation: " + results[0].elevation.toFixed(0) + " meters");
                } else {
                    console.log(status);
                }
            });
        }.bind(this));
    };

    this.determineZoomOutZoom = function() {
        // memorize the zoom we clicked at, but only if it's more zoomed out than
        // the flyTo zoom when an area is loaded
        var currentZoom = this.map.getZoom();
        if (currentZoom <= 7.0) {
            // prevent zoom below 0.5, as floating point inaccuracies can cause bugs at most zoomed out level
            if (currentZoom <= 0.5) {
                this.zoomOutZoom = 0.5;
            } else {
                this.zoomOutZoom = this.map.getZoom();
            }
        }
    };

    this.getMarkersAtSameLocationAsMarker = function(marker, markers) {
        var markersAtPoint = [];
        var lat = marker.geometry.coordinates[1];
        var long = marker.geometry.coordinates[0];

        for (var i = 0; i < markers.length; i++) {
            var curMarkerLat = markers[i].geometry.coordinates[1];
            var curMarkerLong = markers[i].geometry.coordinates[0];

            if (curMarkerLat = lat && curMarkerLong == long) {
                markersAtPoint.push(markers[i]);
            }
        }

        return markersAtPoint;
    };

    this.getFirstPolygonFrameAtPoint = function(features) {
        for (var i = 0; i < features.length; i++) {
            if (features[i].properties["marker-symbol"] == "fillPolygon") {
                return features[i];
            }
        }

        return null;
    };

    this.leftClickOnAPoint = function(e) {
        this.clickOnAPoint(e);
    };

    this.rightClickOnAPoint = function(e) {
        if (secondGraphToggleButton.toggleState == ToggleStates.ON) {
            this.clickOnAPoint(e);
        }
    };

    this.pointClicked = function() {
        return this.map.getLayer("Top Graph") || this.map.getLayer("Bottom Graph");
    };

    this.getSubsetFeatures = function(feature) {
        var attributesController = new AreaAttributesController(this, feature);

        // if we have data_footprint, then show all data footprints associated
        // with this area's scene_footprint
        var scene_footprint = attributesController.getAttribute("scene_footprint");
        var subsetFeatures = this.areaMarkerLayer.mapSceneAndDataFootprints[scene_footprint];

        return subsetFeatures;
    };

    this.addSubsetSwaths = function(feature, populateSearchTable) {
        var subsetFeatures = this.getSubsetFeatures(feature);
        if (subsetFeatures) {
            subsetFeatures = subsetFeatures.slice(0); // clone it to prevent infinite loop when we add to the hashmap
            var json = {
                "areas": subsetFeatures
            };
            this.addSwathsFromJSON(json, null, populateSearchTable);
        }
    };

    this.loadDataSetFromFeature = function(feature, initialZoom) {
        var tileJSON = {
            "minzoom": 0,
            "maxzoom": 14,
            "center": [130.308838,
                32.091882, 14
            ],
            "bounds": null,
            "tiles": [
                "http://129.171.60.12:8888/" + feature.properties.unavco_name +
                "/{z}/{x}/{y}.pbf"
            ],
            "vector_layers": []
        };

        if (this.pointsLoaded()) {
            this.removePoints();
            this.removeTouchLocationMarkers();
        }

        currentArea = feature;

        // make streets toggle button be only checked one
        $("#streets").prop("checked", true);
        for (var i = 1; i <= feature.properties.num_chunks; i++) {
            var layer = { "id": "chunk_" + i, "description": "", "minzoom": 0, "maxzoom": 14, "fields": { "c": "Number", "m": "Number", "p": "Number" } };
            tileJSON.vector_layers.push(layer);
        }

        areaAttributesPopup.show(feature);

        this.colorScale.show();

        // when we click, we don't reset the highlight of modified markers one final time
        this.areaMarkerLayer.resetHighlightsOfAllMarkers();
        // get a recolor selector
        var button = $("#polygon-button");
        button.attr("data-original-title", "Select Points");
        this.selector.disableSelectMode(); // in case it is selected
        this.selector.removeEventListeners(); // remove old event listeners
        this.selector = new FeatureSelector();
        this.selector.map = this;
        this.selector.associatedButton = button;
        this.selector.prepareEventListeners(); // and add new ones

        this.colorScale.defaultValues(); // set default values in case they were modified by another area
        this.selector.reset(currentArea);
        $("#color-on-dropdown").val("velocity");
        this.colorScale.setTitle("LOS Velocity [cm/yr]");

        this.thirdPartySourcesController.removemidasGpsStationMarkers();
        midasStationsToggleButton.set("off");

        this.addDataset(tileJSON);

        this.map.once("data", function(event) {
            this.removeAreaMarkers();

            overlayToggleButton.set("on");

            // in case it's up
            this.gpsStationPopup.remove();
            window.setTimeout(function() {
                var zoom = 8.0;

                // quickly switching between areas? don't reset zoom
                if (this.anAreaWasPreviouslyLoaded()) {
                    zoom = this.map.getZoom();
                }

                if (initialZoom) {
                    zoom = initialZoom;
                }
                // set our tilejson to the one we've loaded. this will make sure anAreaWasPreviouslyLoaded method returns true after the
                // first time a dataset is selected
                this.tileJSON = tileJSON;

                var centerOfDataset = feature.properties.centerOfDataset;

                if (typeof centerOfDataset === "string") {
                    centerOfDataset = JSON.parse(centerOfDataset);
                }

                var long = centerOfDataset[0];
                var lat = centerOfDataset[1];

                this.map.flyTo({
                    center: [long, lat],
                    zoom: zoom
                });

                var attributesController = new AreaAttributesController(this, feature);
                attributesController.processAttributes();
                this.areaMarkerLayer.setAreaRowHighlighted(feature.properties.unavco_name);
                // in case someone called loading screen
                hideLoadingScreen();
            }.bind(this), 1000);
        }.bind(this));
    };

    this.clickOnAnAreaMarker = function(e) {
        var features = this.map.queryRenderedFeatures(e.point);

        if (!features.length) {
            return;
        }

        var layerID = "touchLocation";

        var frameFeature = this.getFirstPolygonFrameAtPoint(features);
        if (frameFeature) {
            var subsetFeatures = this.getSubsetFeatures(frameFeature);

            // if dataset has child features then it must have more than 1 according to Yunjun, otherwise, the child
            // isn't really a child
            var haveSubsets = subsetFeatures && subsetFeatures.length > 1;
            if (haveSubsets) {
                this.removeAreaMarkers();
                this.addSubsetSwaths(frameFeature, false);
            } else {
                this.determineZoomOutZoom();

                var feature = frameFeature;

                var unavco_name = feature.properties.unavco_name;
                var project_name = feature.properties.project_name;
                var lat = feature.geometry.coordinates[0];
                var long = feature.geometry.coordinates[1];
                var num_chunks = feature.properties.num_chunks;
                var attributeKeys = feature.properties.attributekeys;
                var attributeValues = feature.properties.attributevalues;

                var markerID = feature.properties.layerID;

                this.loadDataSetFromFeature(feature);
            }
        }
    };

    this.getMapBaseStyle = function(tileset) {
        var layers = [];
        var layer = {
            "id": "simple-tiles",
            "type": "raster",
            "source": "raster-tiles",
            "minzoom": 0,
            "maxzoom": 22
        };

        layers.push(layer);
        var style = {
            version: 8,
            sprite: getRootUrl() + "maki/makiIcons",
            glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
            sources: {
                "raster-tiles": {
                    "type": "raster",
                    "url": "mapbox://" + tileset,
                    "tileSize": 256
                },
                'Mapbox Terrain V2': {
                    type: 'vector',
                    url: 'mapbox://mapbox.mapbox-terrain-v2'
                }
            },
            layers: layers
        };

        return { style: style, layers: layers };
    };

    this.setBaseMapLayer = function(mapType) {
        var tileset = 'mapbox.' + mapType;
        var styleAndLayer = this.getMapBaseStyle(tileset);
        styleAndLayer.layers.forEach(function(layer) {
            this.layers_.set(layer.id, layer);
        }.bind(this));

        var baseStyle = styleAndLayer.style;
        var sources = styleAndLayer.style.sources;
        for (var sourceID in sources) {
            if (sources.hasOwnProperty(sourceID)) {
                this.sources.set(sourceID, sources[sourceID]);
            }
        }

        this.sources.forEach(function(source, sourceID) {
            baseStyle.sources[sourceID] = source;
        });

        baseStyle.layers = [];
        this.layers_.forEach(function(layer, layerID) {
            baseStyle.layers.push(layer);
        });

        this.map.setStyle(styleAndLayer.style);
    };

    // extremas: current min = -0.02 (blue), current max = 0.02 (red)
    this.addDataset = function(data) {
        this.colorScale.setTopAsMax(true);
        this.colorOnDisplacement = false;
        var stops = this.colorScale.getMapboxStops();

        this.addSource('insar_vector_source', {
            type: 'vector',
            tiles: data['tiles'],
            minzoom: data['minzoom'],
            maxzoom: data['maxzoom'],
            bounds: data['bounds']
        });

        data['vector_layers'].forEach(function(el) {
            var layer = {
                id: el['id'],
                source: 'insar_vector_source',
                'source-layer': el['id'],
                type: 'circle',
                layout: {
                    'visibility': 'visible'
                },
                paint: {
                    'circle-color': {
                        property: 'm',
                        stops: stops
                    },
                    'circle-radius': {
                        // for an explanation of this array see here:
                        // https://www.mapbox.com/blog/data-driven-styling/
                        stops: [
                            [5, 2],
                            [8, 2],
                            [13, 8],
                            [21, 16],
                            [34, 32]
                        ]
                    }
                }
            }
            this.addLayer(layer);
        }.bind(this));
    };

    this.polygonToLineString = function(polygonGeoJSON) {
        var lineStringGeoJSON = {
            type: "LineString",
            coordinates: []
        };
        var coordinates = polygonGeoJSON.coordinates[0];
        for (var i = 0; i < coordinates.length; i++) {
            lineStringGeoJSON.coordinates.push(coordinates[i]);
        }

        return lineStringGeoJSON;
    };

    this.addSwathsFromJSON = function(json, toExclude, populateSearchTable) {
        var areaMarker = {
            type: "geojson",
            cluster: false,
            clusterRadius: 10,
            data: {}
        };
        var features = [];

        var attributesController = new AreaAttributesController(this, json.areas[0]);
        var searchFormController = new SearchFormController();

        this.areaMarkerLayer.emptyLayers();
        // clear the map so we can add new keys and values to it
        this.areaMarkerLayer.mapSceneAndDataFootprints = {};

        for (var i = 0; i < json.areas.length; i++) {
            var area = json.areas[i];

            var lat = area.geometry.coordinates[1];
            var long = area.geometry.coordinates[0];

            attributesController.setArea(area);
            var attributes = attributesController.getAllAttributes();

            var scene_footprint = attributesController.getAttribute("scene_footprint");
            var polygonGeoJSON = Terraformer.WKT.parse(scene_footprint);
            var lineStringGeoJSON = this.polygonToLineString(polygonGeoJSON);

            var properties = area.properties;

            var id = "areas" + properties.unavco_name;
            var polygonID = "areas" + properties.unavco_name + "fill"
            var center = area.properties.centerOfDataset ?
                area.properties.centerOfDataset : area.geometry.coordinates;

            var feature = {
                "type": "Feature",
                "geometry": polygonGeoJSON,
                "properties": {
                    "marker-symbol": "marker",
                    "layerID": id,
                    "centerOfDataset": center,
                    "unavco_name": properties.unavco_name,
                    "region": properties.region,
                    "project_name": properties.project_name,
                    "num_chunks": properties.num_chunks,
                    "country": properties.country,
                    "decimal_dates": properties.decimal_dates,
                    "string_dates": properties.string_dates,
                    "attributekeys": properties.attributekeys,
                    "attributevalues": properties.attributevalues,
                    "extra_attributes": properties.extra_attributes,
                    "plot_attributes": properties.plot_attributes
                }
            };

            var siblingAlreadyThere = false;
            if (attributesController.areaHasAttribute("data_footprint")) {
                var data_footprint = attributesController.getAttribute("data_footprint");
                // make the scene footprint the previous data_footprint and delete the data_footprint
                var featureClone = JSON.parse(JSON.stringify(feature));
                featureClone.properties.extra_attributes.scene_footprint = data_footprint;
                featureClone.properties.extra_attributes.data_footprint = null;

                if (!this.areaMarkerLayer.mapSceneAndDataFootprints[scene_footprint]) {
                    this.areaMarkerLayer.mapSceneAndDataFootprints[scene_footprint] = [featureClone];
                } else {
                    siblingAlreadyThere = true;
                    this.areaMarkerLayer.mapSceneAndDataFootprints[scene_footprint].push(featureClone);
                }
            }

            if (!siblingAlreadyThere) {
                features.push(feature);

                var swathWidth = 3;
                var swath = new Swath(this, attributes.mission, swathWidth, feature, id);
                this.areaMarkerLayer.addSwath(swath);
                // exclude this area from showing on the map, but we still want to add it
                // to our areaFeatures array so we can highlight the current area
                if (!toExclude || !toExclude.includes(area.properties.unavco_name)) {
                    swath.display();
                }
            }
        }

        if (populateSearchTable) {
            searchFormController.populateSearchResultsTable(features);
        }
        this.areaFeatures = features;
        populateSearchAutocomplete();

        // add the markers representing the available areas
        areaMarker.data = {
            "type": "FeatureCollection",
            "features": features
        };

        return features;
    };

    this.loadAreaMarkersExcluding = function(toExclude, after) {
        if (this.lastAreasRequest) {
            this.lastAreasRequest.abort();
            this.lastAreasRequest = null;
        }

        this.lastAreasRequest = $.ajax({
            url: "/areas",
            success: function(response) {
                var json = response;
                if (!this.areas) {
                    this.areas = json;
                }

                var features = this.addSwathsFromJSON(json, toExclude, true);

                if (after) {
                    after(features);
                }
                this.lastAreasRequest = null;
            }.bind(this),
            error: function(xhr, ajaxOptions, thrownError) {
                console.log("failed " + xhr.responseText);
            }
        });
    };

    this.loadAreaMarkers = function(after) {
        this.loadAreaMarkersExcluding(null, after);
    };

    this.removeAreaMarkers = function() {
        this.areaMarkerLayer.emptyLayers();
        this.areaFeatures = [];
    };

    // until mapbox api gives us a way to determine when all points of mbtiles
    // have finished fully rendering.
    this.onDatasetRendered = function(callback) {
        var renderHandler = function() {
            if (this.map.loaded()) {
                callback(renderHandler);
            }
        }.bind(this);
        this.map.on("render", renderHandler);
    };

    this.loadSwathsInCurrentViewport = function(populateTable) {
        var bounds = this.map.getBounds();
        var bbox = [bounds._ne, bounds._sw];
        this.areaFilterSelector.filterAreasInBrowser(bbox, populateTable);

    };

    this.addMapToPage = function(containerID) {
        var startingOptions = urlOptions.startingView;
        try {
            this.startingCoords = new mapboxgl.LngLat(startingOptions.lng, startingOptions.lat);
            this.startingZoom = parseFloat(startingOptions.zoom);
        } catch (error) {
            this.startingZoom = 1.6;
            this.startingCoords = [0, 30];
        }

        this.map = new mapboxgl.Map({
            container: containerID, // container id
            center: this.startingCoords, // this.starting position
            zoom: this.startingZoom, // this.starting zoom
            attributionControl: false
        }).addControl(new mapboxgl.AttributionControl({
            compact: true
        }));

        this.map.once("load", function() {
            this.colorScale.initVisualScale();
            this.map.getCanvas().style.cursor = 'auto';
            this.selector = new FeatureSelector();
            this.selector.map = this;
            this.selector.associatedButton = $("#polygon-button");
            this.selector.prepareEventListeners();
            this.loadAreaMarkers(function(areaFeatures) {
                this.allAreaFeatures = areaFeatures;
                var options = urlOptions.startingDatasetOptions;
                if (options.startDataset) {
                    for (var i = 0; i < areaFeatures.length; i++) {
                        if (areaFeatures[i].properties.unavco_name === options.startDataset) {
                            showLoadingScreen("Loading requested dataset...", null);
                            this.loadDataSetFromFeature(areaFeatures[i], options.zoom);
                            break;
                        }
                    }
                }
            }.bind(this));
            this.areaFilterSelector = new AreaFilterSelector();
            this.areaFilterSelector.map = this;
        }.bind(this));

        this.setBaseMapLayer("streets");

        this.map.addControl(new mapboxgl.NavigationControl());

        // disable rotation gesture
        this.map.dragRotate.disable();
        // and box zoom
        this.map.boxZoom.disable();

        this.leftClickOnAPoint = this.leftClickOnAPoint.bind(this);
        this.map.on('click', this.leftClickOnAPoint);
        this.map.on('click', function() { fullyHideSearchBars(); });

        //this.map.on("contextmenu", this.rightClickOnAPoint);

        this.map.on('mousemove', function(e) {
            var features = this.map.queryRenderedFeatures(e.point);

            // mouse not under a marker, clear all popups
            if (!features.length) {
                this.areaPopup.remove();
                this.gpsStationNamePopup.remove();
                this.areaMarkerLayer.resetHighlightsOfAllMarkers();
                this.areaMarkerLayer.resetHighlightsOfAllAreaRows(currentArea);
                this.map.getCanvas().style.cursor = 'auto';
                return;
            }
            var frameFeature = this.getFirstPolygonFrameAtPoint(features);
            if (frameFeature) {
                this.areaMarkerLayer.resetHighlightsOfAllMarkers();
                this.areaMarkerLayer.resetHighlightsOfAllAreaRows(null);
                this.areaMarkerLayer.setAreaRowHighlighted(frameFeature.properties.unavco_name);
                this.areaMarkerLayer.setPolygonHighlighted(frameFeature.properties.layerID, "rgba(0, 0, 255, 0.3)");
                this.map.getCanvas().style.cursor = "pointer";
                var rowID = frameFeature.properties.unavco_name;
                this.areaMarkerLayer.setAreaRowHighlighted(rowID);
                var subsetFeatures = this.getSubsetFeatures(frameFeature);
                var haveSubsets = subsetFeatures && subsetFeatures.length > 1;
                if (haveSubsets && $("#search-form-and-results-container").hasClass("maximized")) {
                    var searchFormController = new SearchFormController();
                    $(".show-children-button#" + rowID).mouseover();
                    searchFormController.populateSubsetPopup(frameFeature, subsetFeatures);
                }
            } else if (!this.selector.selecting()) {
                var featureViewOptions = this.thirdPartySourcesController.featureToViewOptions(features[0]);
                if (featureViewOptions.coordinates) {
                    // this.gpsStationNamePopup.remove();
                    this.gpsStationNamePopup.setLngLat(featureViewOptions.coordinates)
                        .setHTML(featureViewOptions.html)
                        .addTo(this.map);
                } else {
                    this.areaMarkerLayer.resetHighlightsOfAllMarkers();
                    this.areaMarkerLayer.resetHighlightsOfAllAreaRows(currentArea);
                }
                this.map.getCanvas().style.cursor = featureViewOptions.cursor;
            }
        }.bind(this));

        this.map.on('zoomend', function() {
            var currentZoom = this.map.getZoom();

            if (this.areaSwathsLoaded() && !$("#dataset-frames-toggle-button").hasClass("toggled")) {
                this.loadSwathsInCurrentViewport(true);
            }
            // reshow area markers once we zoom out enough
            if (currentZoom < this.zoomOutZoom) {
                if (this.pointsLoaded()) {
                    this.reset();
                    // otherwise, points aren't loaded, but area previously was active
                } else if (this.anAreaWasPreviouslyLoaded()) {
                    this.removeAreaPopups();
                    this.loadAreaMarkers(null);
                    this.map.off("click", this.leftClickOnAPoint);
                }
            }

            if (!this.selector.recoloring()) {
                if (this.selector.inSelectMode()) {
                    this.selector.disableSelectMode();
                }

                if (this.colorOnDisplacement) {
                    this.colorDatasetOnVelocity();
                }
            }

            if (this.map.getSource("onTheFlyJSON")) {
                this.removeSourceAndLayer("onTheFlyJSON");
            }

            if (this.thirdPartySourcesController.midasArrows) {
                this.thirdPartySourcesController.updateArrowLengths();
            }

            this.previousZoom = currentZoom;
        }.bind(this));

        this.map.on("dragend", function(e) {
            if (e.source === "recenter") {
                return;
            }

            this.map.setCenter(this.map.getCenter().wrap(), {
                source: "recenter"
            });

            if (this.areas && !$("#dataset-frames-toggle-button").hasClass("toggled")) {
                this.loadSwathsInCurrentViewport(true);
            }
        }.bind(this));
    };

    this.colorDatasetOnDisplacement = function(startDate, endDate) {
        this.colorOnDisplacement = true;
        this.selector.recolorOnDisplacement(startDate, endDate, "Recoloring in progress... for fast zoom, switch to velocity or disable or deselect on the fly coloring", "ESCAPE to interrupt");
        this.colorScale.setTitle("LOS Displacement (cm)");
    };

    this.colorDatasetOnVelocity = function() {
        this.colorOnDisplacement = false;
        if (this.map.getSource("onTheFlyJSON")) {
            this.removeSource("onTheFlyJSON");
            this.removeLayer("onTheFlyJSON");
        }
        this.colorScale.setTitle("LOS Velocity [cm/yr]");
    };

    this.pointsLoaded = function() {
        return this.map.getSource("insar_vector_source") != null;
    };

    this.areaSwathsLoaded = function() {
        // we always have areas0 at minimum if areas swaths loaded
        // how to avoid checking points loaded? remove area sources when
        // we click on a point
        return !this.areaMarkerLayer.empty() && !this.pointsLoaded();
    };

    this.anAreaWasPreviouslyLoaded = function() {
        return this.tileJSON != null;
    };

    this.removePoints = function() {
        if (!this.pointsLoaded()) {
            return;
        }

        this.removeSource("insar_vector_source");

        for (var i = 1; i <= currentArea.properties.num_chunks; i++) {
            this.removeLayer("chunk_" + i);
        }

        if (this.map.getSource("onTheFlyJSON")) {
            this.removeSourceAndLayer("onTheFlyJSON");
        }
    }

    this.removeTouchLocationMarkers = function() {
        // remove selected point marker if it exists, and create a new GeoJSONSource for it
        // prevents crash of "cannot read property 'send' of undefined"
        var layerID = "Top Graph";
        if (this.map.getLayer(layerID)) {
            this.removeLayer(layerID);
            this.removeSource(layerID);

            this.clickLocationMarker = {
                type: "geojson",
                data: {}
            };
        }

        layerID = "Bottom Graph";
        if (this.map.getLayer(layerID)) {
            this.removeLayer(layerID);
            this.removeSource(layerID);

            this.clickLocationMarker2 = {
                type: "geojson",
                data: {}
            };
        }
    };

    this.removeAreaPopups = function() {
        // remove popup which shows area attributes
        $("#area-attributes-div-minimize-button").click();
        // and the graphs
        $("#graph-div-minimize-button").click();

        // and color scale, but only if midas is not up
        if (!this.thirdPartySourcesController.midasLoaded()) {
            this.colorScale.remove();
        }
    };

    this.reset = function() {
        this.removePoints();
        currentArea = null;
        this.removeTouchLocationMarkers();
        this.selector.cleanup();
        // incase they are up
        this.elevationPopup.remove();
        this.gpsStationPopup.remove();
        this.gpsStationNamePopup.remove();

        this.thirdPartySourcesController.removeAll();

        this.colorDatasetOnVelocity();

        this.loadAreaMarkers(null);

        this.removeAreaPopups();
        $("#search-form-and-results-minimize-button").click();
        this.seismicityGraphsController.hideChartContainers();

        $("#point-details").empty();

        overlayToggleButton.set("off");
        this.tileJSON = null;
        this.colorOnDisplacement = false;

        fullyHideSearchBars();
    };

    this.addContourLines = function() {
        this.addLayer({
            'id': 'contours',
            'type': 'line',
            'source': 'Mapbox Terrain V2',
            'source-layer': 'contour',
            'layout': {
                'visibility': 'visible',
                'line-join': 'round',
                'line-cap': 'round'
            },
            'paint': {
                'line-color': '#877b59',
                'line-width': 1
            }
        });
        this.addLayer({
            "id": "contour_label",
            "type": "symbol",
            "source": "Mapbox Terrain V2",
            "source-layer": "contour",
            "minzoom": 0,
            "maxzoom": 22,
            "filter": ["all", ["==", "$type", "Polygon"],
                ["==", "index", 5]
            ],
            "layout": {
                "symbol-placement": "line",
                "text-field": "{ele}",
                "text-font": ["Open Sans Regular,   Arial Unicode MS Regular"],
                "text-letter-spacing": 0,
                "text-line-height": 1.6,
                "text-max-angle": 10,
                "text-rotation-alignment": "map"
            },
            "paint": {
                //"text-size": 0
            },
            "paint.contours": {
                "text-opacity": 1,
                "text-halo-blur": 0,
                //"text-size": 12,
                "text-halo-width": 1,
                "text-halo-color": "#333",
                "text-color": "#00fcdc"
            }
        });
    };

    this.removeContourLines = function() {
        this.removeLayer("contours");
        this.removeLayer("contour_label");
    };

    this.prettyPrintProjectName = function(projectName) {
        var trackIndex = projectName.indexOf("T");
        var frameIndex = projectName.indexOf("F");
        var trackNumber = projectName.substring(trackIndex + 1, frameIndex);
        var regionName = projectName.substring(0, trackIndex);

        var prettyPrintedName = regionName;


        // sometimes there is only one track number instead of framenumber_framenumber - look for "_"
        var regex = /_/;

        var underscoreFound = projectName.match(regex);

        var firstFrame = null;
        var lastFrame = null;
        var frames = null;
        var frameNumbers = null;
        var missionIndex = 0;

        // multiple tracks
        if (underscoreFound) {
            regex = /F\d+_\d+/;

            frames = projectName.match(regex);
            frameNumbers = frames[0].split("_");
            firstFrame = frameNumbers[0];
            lastFrame = frameNumbers[1];
            missionIndex = regionName.length + firstFrame.length + lastFrame.length + 1 + trackNumber.length;
        } else {
            regex = /F\d+/;
            frames = projectName.match(regex);
            frameNumbers = frames[0].split("_");
            firstFrame = frames[0];
            lastFrame = frames[0];
            missionIndex = regionName.length + firstFrame.length + trackNumber.length;
        }

        var mission = projectName.substring(missionIndex + 1, projectName.length);
        var missionType = mission.charAt(mission.length - 1);
        var missionSatellite = mission.substring(0, mission.length - 1);
        mission = mission.substring(0, mission.length - 1);
        mission += " " + missionType;

        prettyPrintedName += " " + mission + " T" + trackNumber;

        var name = {
            fullPrettyName: prettyPrintedName,
            missionSatellite: missionSatellite,
            region: regionName,
            missionType: missionType,
            trackNumber: trackNumber,
            frameNumbers: [firstFrame, lastFrame]
        };

        return name;
    };

    this.refreshDataset = function() {
        var stops = this.colorScale.getMapboxStops();

        this.layers_.forEach(function(layer, layerID) {
            if (this.map.getPaintProperty(layerID, "circle-color")) {
                this.map.setPaintProperty(layerID, "circle-color", {
                    "property": 'm',
                    "stops": stops
                });
            }
        }.bind(this));

        if (this.map.getLayer("onTheFlyJSON")) {
            this.map.setPaintProperty("onTheFlyJSON", "circle-color", {
                "property": 'm',
                "stops": stops
            });
        }
    };

    this.removeSourceAndLayer = function(name) {
        if (this.map.getSource(name)) {
            this.removeSource(name);
        }

        if (this.map.getLayer(name)) {
            this.removeLayer(name);
        }
    };

    // if after is supplied, it must hide loading screen
    this.subsetDataset = function(bbox, after) {
        showLoadingScreen("Subsetting Dataset", "ESCAPE to interrupt");
        // too many vector layers leads to browser running out of memory
        // when we set filter
        if (this.tileJSON.vector_layers.length > 1) {
            hideLoadingScreen();
            if (after) {
                after();
            }
            return;
        }
        var sw = {
            lng: bbox[0],
            lat: bbox[1]
        };
        var ne = {
            lng: bbox[2],
            lat: bbox[3]
        };
        var polygonVertices = this.selector.getVerticesOfSquareBbox([sw, ne]);
        var serverBboxCoords = this.selector.verticesOfBboxToLineString(polygonVertices);
        this.cancellableAjax.ajax({
            url: "/WebServicesBox/" + currentArea.properties.unavco_name + "/" + serverBboxCoords,
            success: function(response) {
                var pointIDs = response;
                if (pointIDs.length == 0) {
                    hideLoadingScreen();
                    if (after) {
                        after();
                    }
                    return;
                }
                var filter = ["in", "p"].concat(pointIDs);
                for (var i = 0; i < this.tileJSON.vector_layers.length; i++) {
                    var layerID = this.tileJSON.vector_layers[i].id;
                    if (!this.map.getFilter(layerID)) {
                        this.map.setFilter(layerID, filter);
                    }
                }

                // after must hide loading screen, otherwise we do it
                if (after) {
                    if (this.map.loaded()) {
                        after();
                    } else {
                        this.onDatasetRendered(function(callback) {
                            this.map.off("render", callback);
                            after();
                        }.bind(this));
                    }
                } else {
                    hideLoadingScreen();
                }
            }.bind(this),
            error: function(xhr, ajaxOptions, thrownError) {
                console.log("failed " + xhr.responseText);
            }.bind(this)
        }, function() {
            hideLoadingScreen();
        });
    };
}


// function to use AJAX to load json from that same website - I looked online and AJAX is basically just used
// to asynchronously load data using javascript from a server, in our case, our local website
function loadJSON(arg, param, callback) {
    var fullQuery = param + "/"

    for (var key in arg) {
        fullQuery += arg[key] + "/"
    }

    console.log(fullQuery);
    var xobj = new XMLHttpRequest();
    xobj.overrideMimeType("application/json");
    xobj.open('GET', fullQuery, true); // Replace 'my_data' with the path to your file
    xobj.onreadystatechange = function() {
        if (xobj.readyState == 4 && xobj.status == "200") {
            // Required use of an anonymous callback as .open will NOT return a value but simply returns undefined in asynchronous mode
            callback(xobj.responseText);
        }
    };
    xobj.send(null);
}
